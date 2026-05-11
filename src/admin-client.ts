import { join } from "node:path";
import { copyStorageTargetTree, LocalFilesystemTarget } from "@sprengmeister/graphvault/internal/storage/storage-target";
import { StorageLayout } from "@sprengmeister/graphvault/internal/storage/storage-layout";
import { StorageReader } from "@sprengmeister/graphvault/internal/storage/storage-reader";
import { StorageWriter } from "@sprengmeister/graphvault/internal/storage/storage-writer";
import { verifyStorage } from "@sprengmeister/graphvault/internal/storage/storage-verifier";
import { buildParentIndexRecord } from "@sprengmeister/graphvault/internal/storage/storage-parent-index";
import { executeGvqlStatement, parseGvql } from "@sprengmeister/graphvault/internal/gvql/gvql";
import {
  envelopeHash,
  transactionRecordHash,
  transactionHashPayload,
  verifyAdminIntegrity,
  type IntegrityTransactionRecord,
} from "./admin-integrity.js";
import { graphvaultLibraryCompatibility } from "./admin-compatibility.js";
import { referencedChildren, summarizeNode, visitNode } from "./admin-inspection.js";
import { encodeAdminValue, getNodePath, setNodePath } from "./admin-mutation.js";
import { pathFromObjectToRoot } from "./admin-parent-index.js";
import { loadAdminSubtree } from "./admin-subtree.js";
import {
  envelopeFromAdminManifest,
  readAdminObjectRecord,
  writeAdminManifest,
  writeAdminObjectRecords,
  type VersionedStorageManifest,
} from "./admin-storage-io.js";
import type {
  BackupResult,
  MaintenanceResult,
  ObjectRecord,
  ParentIndexRecord,
  SerializedEnvelope,
  StorageManifest,
  StorageTarget,
  StorageTargetLock,
  StoreMode,
  TransactionRecord,
  TypeDictionary,
  VerificationResult,
} from "@sprengmeister/graphvault/internal/core/types";
import type { GvqlExecutionOptions, GvqlResult } from "@sprengmeister/graphvault/internal/gvql/gvql";

import type {
  AdminGraph,
  AdminGraphEdge,
  AdminGraphNode,
  AdminHierarchyPath,
  AdminHierarchyPathItem,
  AdminMutation,
  AdminMutationPreview,
  AdminObjectChild,
  AdminObjectListItem,
  AdminObjectPage,
  AdminObjectParent,
  AdminOperationalStatus,
  AdminProductionSafety,
  AdminProductionSafetyIssue,
  AdminRootReference,
  AdminSearchResult,
  AdminSummary,
  AdminSubtree,
  AdminStorageHardening,
  AdminTransactionMetadata,
  StorageAdminClientOptions,
} from "./admin-types.js";

type MaybeFencedLock = StorageTargetLock & {
  fencingToken?: number;
  assertValid?: () => Promise<void>;
};

interface StudioWalPrepareRecord {
  format: "graphvault-wal";
  version: 1;
  status: "prepared";
  transactionId: number;
  preparedAt: string;
  snapshotFile: string;
  objectIds: string[];
  mode: StoreMode;
  targetCount: number;
  envelope: SerializedEnvelope;
}

interface StudioWalCommitRecord {
  format: "graphvault-wal";
  version: 1;
  status: "committed";
  transactionId: number;
  committedAt: string;
  prepareFile: string;
}

export type {
  AdminGraph,
  AdminGraphEdge,
  AdminGraphNode,
  AdminHierarchyPath,
  AdminHierarchyPathItem,
  AdminMutation,
  AdminMutationPreview,
  GvqlResult,
  AdminObjectChild,
  AdminObjectListItem,
  AdminObjectPage,
  AdminObjectParent,
  AdminOperationalStatus,
  AdminRootReference,
  AdminSearchResult,
  AdminSummary,
  AdminSubtree,
  StorageAdminClientOptions,
} from "./admin-types.js";

export class StorageAdminClient {
  private readonly target: StorageTarget;
  private readonly layout: StorageLayout;
  private readonly reader: StorageReader;
  private readonly writer: StorageWriter;
  private readonly allowMutations: boolean;
  private parentIndex: ParentIndexRecord | undefined;

  constructor(private readonly options: StorageAdminClientOptions) {
    this.target = options.storageTarget ?? new LocalFilesystemTarget();
    this.layout = new StorageLayout(options.storageDirectory, options.channelCount ?? 1);
    this.reader = new StorageReader(this.target, this.layout);
    this.writer = new StorageWriter(this.target, this.layout);
    this.allowMutations = options.allowMutations ?? false;
  }

  async summary(options: { verify?: boolean } = {}): Promise<AdminSummary> {
    const manifest = await this.requireManifest();
    const [currentSnapshot, latestTransaction, typeDictionary] = await Promise.all([
      this.reader.readCurrentPointer(),
      this.reader.readLatestTransactionRecord(),
      this.readTypeDictionary(),
    ]);
    const verification = options.verify === false ? undefined : await this.verify();
    const hardening = this.hardening();
    const operations = await this.operations(manifest, latestTransaction);
    return {
      storageDirectory: this.options.storageDirectory,
      transactionId: manifest.transactionId,
      ...(currentSnapshot ? { currentSnapshot } : {}),
      objectCount: manifest.objectIds.length,
      library: graphvaultLibraryCompatibility(),
      ...(latestTransaction ? { latestTransaction } : {}),
      ...(typeDictionary ? { typeDictionary } : {}),
      hardening,
      operations,
      productionSafety: this.productionSafety(hardening, operations, verification),
      ...(verification ? { verification } : { verificationSkipped: true }),
    };
  }

  async listObjects(): Promise<AdminObjectListItem[]> {
    return (await this.listObjectPage()).items;
  }

  async listObjectPage(options: { offset?: number; limit?: number } = {}): Promise<AdminObjectPage> {
    const manifest = await this.requireManifest();
    const items: AdminObjectListItem[] = [];
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(500, Math.max(1, options.limit ?? manifest.objectIds.length));
    for (const objectId of manifest.objectIds.slice(offset, offset + limit)) {
      const record = await this.readObjectRecord(manifest, objectId);
      items.push({
        objectId,
        kind: record.node.kind,
        ...(record.node.kind === "object" && record.node.type ? { type: record.node.type } : {}),
        transactionId: record.transactionId,
        preview: summarizeNode(record.node),
      });
    }
    return { offset, limit, total: manifest.objectIds.length, items };
  }

  async getObject(objectId: string): Promise<ObjectRecord> {
    return this.readObjectRecord(await this.requireManifest(), objectId);
  }

  async rootReference(): Promise<AdminRootReference> {
    const manifest = await this.requireManifest();
    return {
      root: manifest.root,
      ...(manifest.root && typeof manifest.root === "object" && "$ref" in manifest.root ? { rootObjectId: manifest.root.$ref } : {}),
    };
  }

  async listObjectChildren(objectId: string): Promise<AdminObjectChild[]> {
    const manifest = await this.requireManifest();
    const record = await this.readObjectRecord(manifest, objectId);
    const children: AdminObjectChild[] = [];
    for (const [path, to] of referencedChildren(record.node)) {
      const child = await this.readObjectRecord(manifest, to);
      children.push({
        from: objectId,
        to,
        path,
        kind: child.node.kind,
        ...(child.node.kind === "object" && child.node.type ? { type: child.node.type } : {}),
        preview: summarizeNode(child.node),
      });
    }
    return children;
  }

  async hierarchyPath(targetObjectId: string): Promise<AdminHierarchyPath> {
    const manifest = await this.requireManifest();
    const index = await this.parentIndexFor(manifest);
    return pathFromObjectToRoot(index, targetObjectId, (objectId) => this.readObjectRecord(manifest, objectId));
  }

  async graph(): Promise<AdminGraph> {
    const manifest = await this.requireManifest();
    const envelope = await this.envelopeFromManifest(manifest);
    const nodes: AdminGraphNode[] = [];
    const edges: AdminGraphEdge[] = [];
    for (const [objectId, node] of Object.entries(envelope.nodes)) {
      nodes.push({
        objectId,
        kind: node.kind,
        ...(node.kind === "object" && node.type ? { type: node.type } : {}),
      });
      visitNode(node, (path, value) => {
        if (value && typeof value === "object" && "$ref" in value) {
          edges.push({ from: objectId, to: value.$ref, path });
        }
      });
    }
    return { root: envelope.root, nodes, edges };
  }

  async subtree(options: { rootObjectId?: string; depth?: number } = {}): Promise<AdminSubtree> {
    const manifest = await this.requireManifest();
    return loadAdminSubtree(manifest, (objectId) => this.readObjectRecord(manifest, objectId), options);
  }

  async search(query: string, options: { limit?: number } = {}): Promise<AdminSearchResult[]> {
    const manifest = await this.requireManifest();
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const limit = Math.min(500, Math.max(1, options.limit ?? 500));
    const results: AdminSearchResult[] = [];
    for (const objectId of manifest.objectIds) {
      const record = await this.readObjectRecord(manifest, objectId);
      visitNode(record.node, (path, value) => {
        if (results.length >= limit) {
          return;
        }
        const preview = JSON.stringify(value);
        if (path.toLowerCase().includes(needle) || preview.toLowerCase().includes(needle)) {
          results.push({ objectId, path, preview: preview.slice(0, 240) });
        }
      });
      if (results.length >= limit) {
        break;
      }
    }
    return results;
  }

  async gvql(query: string, options: GvqlExecutionOptions & { metadata?: AdminTransactionMetadata } = {}): Promise<GvqlResult> {
    const manifest = await this.requireManifest();
    const envelope = await this.envelopeFromManifest(manifest);
    const statement = parseGvql(query);
    const result = executeGvqlStatement(envelope, statement, {
      ...options,
      allowMutations: this.allowMutations && statement.kind === "update" && !options.dryRun,
    });
    if (result.kind === "update" && !result.dryRun) {
      await this.commitEnvelope(manifest.transactionId, envelope, "standard", result.changes.length, options.metadata);
      this.parentIndex = undefined;
    }
    return result;
  }

  async listTransactions(): Promise<TransactionRecord[]> {
    const records: TransactionRecord[] = [];
    for (const file of await this.reader.readDirectoryIfExists(this.layout.transactionsDirectory)) {
      if (!file.endsWith(".json")) {
        continue;
      }
      try {
        const record = JSON.parse(await this.target.readText(join(this.layout.transactionsDirectory, file))) as TransactionRecord;
        if (record.format === "graphvault-transaction") {
          records.push(record);
        }
      } catch {
        // Ignore partial records in admin listing as the runtime recovery path does.
      }
    }
    return records.sort((a, b) => b.transactionId - a.transactionId);
  }

  async readJournal(): Promise<string> {
    try {
      return await this.target.readText(this.layout.journalFile);
    } catch {
      return "";
    }
  }

  async readTypeDictionary(): Promise<TypeDictionary | undefined> {
    try {
      if (!(await this.target.exists(this.layout.typeDictionaryFile))) {
        return undefined;
      }
      return JSON.parse(await this.target.readText(this.layout.typeDictionaryFile)) as TypeDictionary;
    } catch {
      return undefined;
    }
  }

  async verify(): Promise<VerificationResult> {
    let manifest: VersionedStorageManifest | undefined;
    const result = await verifyStorage({
      target: this.target,
      lazyDirectory: this.layout.lazyDirectory,
      readManifest: async () => {
        manifest = await this.reader.readManifest() as VersionedStorageManifest | undefined;
        return manifest;
      },
      readLatestTransactionRecord: () => this.reader.readLatestTransactionRecord(),
      readObjectRecord: (objectId) => {
        if (!manifest) {
          throw new Error("Storage manifest not found or unreadable.");
        }
        return this.readObjectRecord(manifest, objectId);
      },
    }) as VerificationResult & { checkedIntegrityHashes?: number; warnings?: string[] };
    result.warnings ??= [];
    if (manifest) {
      const integrity = await verifyAdminIntegrity({
        target: this.target,
        layout: this.layout,
        manifest,
        transactions: await this.listTransactions() as IntegrityTransactionRecord[],
      });
      result.checkedIntegrityHashes = (result.checkedIntegrityHashes ?? 0) + integrity.checkedIntegrityHashes;
      result.warnings.push(...integrity.warnings);
      result.errors.push(...integrity.errors);
      result.ok = result.errors.length === 0;
    } else {
      result.checkedIntegrityHashes ??= 0;
    }
    return result;
  }

  async maintain(options: { keepSnapshots?: number } = {}): Promise<MaintenanceResult> {
    this.assertMutationsAllowed();
    const garbageCollection = await this.collectGarbage();
    const compaction = await this.compact(options.keepSnapshots ?? 2);
    return { garbageCollection, compaction, verification: await this.verify() };
  }

  async backup(destination: { storageDirectory: string; storageTarget?: StorageTarget }): Promise<BackupResult> {
    const filesCopied = await copyStorageTargetTree(
      this.target,
      destination.storageTarget ?? new LocalFilesystemTarget(),
      this.options.storageDirectory,
      destination.storageDirectory,
    );
    const manifest = await this.requireManifest();
    return { filesCopied, transactionId: manifest.transactionId };
  }

  async previewMutation(mutation: AdminMutation): Promise<AdminMutationPreview> {
    const manifest = await this.requireManifest();
    const envelope = await this.envelopeFromManifest(manifest);
    const node = envelope.nodes[mutation.objectId];
    if (!node) {
      throw new Error(`Object ${mutation.objectId} does not exist.`);
    }
    return {
      objectId: mutation.objectId,
      path: mutation.path,
      before: getNodePath(node, mutation.path),
      after: encodeAdminValue(mutation.value),
    };
  }

  async mutate(mutation: AdminMutation): Promise<TransactionRecord> {
    this.assertMutationsAllowed();
    const manifest = await this.requireManifest();
    const envelope = await this.envelopeFromManifest(manifest);
    const node = envelope.nodes[mutation.objectId];
    if (!node) {
      throw new Error(`Object ${mutation.objectId} does not exist.`);
    }
    setNodePath(node, mutation.path, encodeAdminValue(mutation.value));
    const record = await this.commitEnvelope(manifest.transactionId, envelope, "standard", 1, mutation.metadata);
    this.parentIndex = undefined;
    return record;
  }

  private async commitEnvelope(
    expectedTransactionId: number,
    envelope: SerializedEnvelope,
    mode: StoreMode,
    targetCount: number,
    metadata?: AdminTransactionMetadata,
  ): Promise<TransactionRecord> {
    await this.target.ensureDirectory(this.walDirectory);
    const lock = await this.acquireWriteLock();
    try {
      const latestManifest = await this.requireManifest();
      if (latestManifest.transactionId !== expectedTransactionId) {
        throw new Error(`Store changed concurrently. Expected transaction ${expectedTransactionId}, found ${latestManifest.transactionId}.`);
      }
      const transactionId = expectedTransactionId + 1;
      const snapshotFile = `snapshot-${String(transactionId).padStart(12, "0")}.json`;
      const objectIds = Object.keys(envelope.nodes).sort((a, b) => Number(a) - Number(b));
      const prepareFile = `transaction-${String(transactionId).padStart(12, "0")}.prepare.json`;
      if (this.transactionLogEnabled) {
        await this.writeWalJson(prepareFile, {
          format: "graphvault-wal",
          version: 1,
          status: "prepared",
          transactionId,
          preparedAt: new Date().toISOString(),
          snapshotFile,
          objectIds,
          mode,
          targetCount,
          envelope,
        } satisfies StudioWalPrepareRecord);
      }
      await writeAdminObjectRecords(this.target, this.layout, envelope, transactionId, objectIds);
      await this.writer.writeJson(join(this.layout.snapshotsDirectory, snapshotFile), envelope);
      await this.assertLockValid(lock);
      if (this.transactionLogEnabled) {
        await this.writeWalJson(`transaction-${String(transactionId).padStart(12, "0")}.commit.json`, {
          format: "graphvault-wal",
          version: 1,
          status: "committed",
          transactionId,
          committedAt: new Date().toISOString(),
          prepareFile,
        } satisfies StudioWalCommitRecord);
      }
      await this.assertLockValid(lock);
      const previousTransaction = (await this.listTransactions())[0] as IntegrityTransactionRecord | undefined;
      const record: IntegrityTransactionRecord = {
        format: "graphvault-transaction",
        version: 1,
        transactionId,
        committedAt: new Date().toISOString(),
        snapshotFile,
        objectIds,
        mode,
        targetCount,
        ...(metadata ? { metadata } : {}),
        envelopeHash: envelopeHash(envelope),
        ...(previousTransaction?.transactionHash ? { previousHash: previousTransaction.transactionHash } : {}),
      };
      record.transactionHash = transactionRecordHash(transactionHashPayload(record));
      await this.writer.writeTransactionRecord(record);
      await this.assertLockValid(lock);
      await this.writer.writeParentIndex(envelope, transactionId);
      await this.assertLockValid(lock);
      await this.target.writeTextAtomic(this.layout.currentFile, snapshotFile);
      await writeAdminManifest(this.target, this.layout, envelope, transactionId, record.transactionHash);
      return record;
    } finally {
      await lock.release();
    }
  }

  private async requireManifest(): Promise<VersionedStorageManifest> {
    const manifest = await this.reader.readManifest() as VersionedStorageManifest | undefined;
    if (!manifest) {
      throw new Error("Storage manifest not found or unreadable.");
    }
    return manifest;
  }

  private readObjectRecord(manifest: VersionedStorageManifest, objectId: string): Promise<ObjectRecord> {
    return readAdminObjectRecord(this.target, this.layout, manifest, objectId);
  }

  private envelopeFromManifest(manifest: VersionedStorageManifest): Promise<SerializedEnvelope> {
    return envelopeFromAdminManifest(this.target, this.layout, manifest);
  }

  private get walDirectory(): string {
    return join(this.options.storageDirectory, "wal");
  }

  private get transactionLogEnabled(): boolean {
    return (this.options.transactionLog ?? "full") === "full";
  }

  private hardening(): AdminStorageHardening {
    return {
      mutationsAllowed: this.allowMutations,
      transactionLog: this.options.transactionLog ?? "full",
      writerLock: "enabled",
      fencingTokens: "used-when-supported",
      staleLockRecovery: typeof this.options.staleLockTimeoutMs === "number",
    };
  }

  private async operations(manifest: VersionedStorageManifest, latestTransaction?: TransactionRecord): Promise<AdminOperationalStatus> {
    const walFiles = await this.reader.readDirectoryIfExists(this.walDirectory);
    const prepareFiles = walFiles.filter((file) => file.endsWith(".prepare.json"));
    const commitFiles = walFiles.filter((file) => file.endsWith(".commit.json"));
    const publishedTransactionId = manifest.transactionId;
    let latestWalTransactionId = 0;
    let pendingWalCommits = 0;
    for (const file of commitFiles) {
      try {
        const record = JSON.parse(await this.target.readText(join(this.walDirectory, file))) as StudioWalCommitRecord;
        if (record.format !== "graphvault-wal" || record.status !== "committed") {
          continue;
        }
        latestWalTransactionId = Math.max(latestWalTransactionId, record.transactionId);
        if (record.transactionId > publishedTransactionId) {
          pendingWalCommits++;
        }
      } catch {
        // Verification surfaces malformed WAL; the operations pane stays lightweight.
      }
    }
    return {
      transactionLog: this.options.transactionLog ?? "full",
      mutationsAllowed: this.allowMutations,
      lockTimeoutMs: this.options.lockTimeoutMs ?? 5_000,
      ...(typeof this.options.staleLockTimeoutMs === "number" ? { staleLockTimeoutMs: this.options.staleLockTimeoutMs } : {}),
      walPrepareFiles: prepareFiles.length,
      walCommitFiles: commitFiles.length,
      latestWalTransactionId,
      latestJournalTransactionId: latestTransaction?.transactionId ?? 0,
      publishedTransactionId,
      pendingWalCommits,
      checkedIntegrityHashes: manifest.latestTransactionHash ? 1 : 0,
      status: pendingWalCommits > 0 ? "recovery-pending" : "healthy",
    };
  }

  private productionSafety(
    hardening: AdminStorageHardening,
    operations: AdminOperationalStatus,
    verification?: VerificationResult,
  ): AdminProductionSafety {
    const issues: AdminProductionSafetyIssue[] = [];
    if (operations.pendingWalCommits > 0) {
      issues.push({
        code: "wal-recovery-pending",
        severity: "critical",
        message: `${operations.pendingWalCommits} committed WAL record(s) are newer than the published manifest.`,
        recommendation: "Run a writable GraphVault instance with WAL recovery enabled before exposing or mutating the store.",
      });
    }
    if (operations.transactionLog === "off") {
      issues.push({
        code: "transaction-log-disabled",
        severity: "critical",
        message: "The transaction log is disabled, so committed WAL recovery is not available.",
        recommendation: 'Use transactionLog: "full" for critical stores.',
      });
    }
    if (!hardening.staleLockRecovery) {
      issues.push({
        code: "stale-lock-recovery-disabled",
        severity: "warning",
        message: "Stale writer-lock recovery is not configured.",
        recommendation: "Configure staleLockTimeoutMs above the longest expected transaction runtime for multi-pod stores.",
      });
    }
    if (!operations.checkedIntegrityHashes) {
      issues.push({
        code: "hash-chain-missing",
        severity: "warning",
        message: "The summary did not find a transaction hash-chain head in the latest manifest.",
        recommendation: "Rewrite the store with a current GraphVault Library version to restore tamper-evident transaction history.",
      });
    }
    if (verification?.errors.length) {
      issues.push({
        code: "verification-errors",
        severity: "critical",
        message: `Verification reported ${verification.errors.length} error(s).`,
        recommendation: "Inspect verification details and restore or repair the store before serving critical traffic.",
      });
    }
    const verificationWarnings = verification && "warnings" in verification && Array.isArray(verification.warnings) ? verification.warnings : [];
    if (verificationWarnings.length) {
      issues.push({
        code: "verification-warnings",
        severity: "warning",
        message: `Verification reported ${verificationWarnings.length} warning(s).`,
        recommendation: "Review verification warnings before promoting the store to production.",
      });
    }
    if (this.allowMutations) {
      issues.push({
        code: "admin-mutations-enabled",
        severity: "info",
        message: "Studio mutation endpoints are enabled for this admin session.",
        recommendation: "Keep mutations behind admin authentication and a high-entropy confirmation token.",
      });
    }

    return {
      status: productionSafetyStatus(issues),
      score: productionSafetyScore(issues),
      summary: productionSafetySummary(issues),
      transactionLog: operations.transactionLog,
      mutationsAllowed: this.allowMutations,
      staleLockRecovery: hardening.staleLockRecovery,
      pendingRecovery: operations.pendingWalCommits > 0,
      hashChain: operations.checkedIntegrityHashes ? "present" : "missing",
      issues,
    };
  }

  private async acquireWriteLock(): Promise<MaybeFencedLock> {
    const acquireLock = this.target.acquireLock as (
      path: string,
      timeoutMs: number,
      options?: { staleLockTimeoutMs?: number },
    ) => Promise<MaybeFencedLock>;
    return acquireLock(this.layout.lockFile, this.options.lockTimeoutMs ?? 5_000, this.lockOptions());
  }

  private lockOptions(): { staleLockTimeoutMs?: number } {
    return typeof this.options.staleLockTimeoutMs === "number" ? { staleLockTimeoutMs: this.options.staleLockTimeoutMs } : {};
  }

  private async assertLockValid(lock: MaybeFencedLock): Promise<void> {
    if (lock.assertValid) {
      await lock.assertValid();
    }
  }

  private async writeWalJson(file: string, value: unknown): Promise<void> {
    await this.target.writeTextAtomic(join(this.walDirectory, file), `${JSON.stringify(value, null, 2)}\n`);
  }

  private async compact(keepLatest: number): Promise<{ kept: number; removed: number }> {
    const current = await this.reader.readCurrentPointer();
    if (!current) {
      return { kept: 0, removed: 0 };
    }
    const snapshots = (await this.target.list(this.layout.snapshotsDirectory))
      .filter((name) => name.startsWith("snapshot-") && name.endsWith(".json"))
      .sort();
    const keep = new Set(snapshots.slice(Math.max(0, snapshots.length - keepLatest)));
    keep.add(current);
    let removed = 0;
    for (const snapshot of snapshots) {
      if (!keep.has(snapshot)) {
        await this.target.remove(join(this.layout.snapshotsDirectory, snapshot));
        removed++;
      }
    }
    return { kept: snapshots.length - removed, removed };
  }

  private async collectGarbage(): Promise<MaintenanceResult["garbageCollection"]> {
    const manifest = await this.requireManifest();
    const liveJsonRecords = liveObjectRecordFiles(manifest, "json");
    const liveBinaryRecords = liveObjectRecordFiles(manifest, "bin");
    let keptObjects = 0;
    let removedObjects = 0;
    let keptBinaryObjects = 0;
    let removedBinaryObjects = 0;
    for (const directory of this.layout.objectRecordDirectories("json")) {
      for (const file of await this.reader.readDirectoryIfExists(directory)) {
        if (!file.endsWith(".json")) continue;
        if (liveJsonRecords.has(file)) keptObjects++;
        else {
          await this.target.remove(join(directory, file));
          removedObjects++;
        }
      }
    }
    for (const directory of this.layout.objectRecordDirectories("binary")) {
      for (const file of await this.reader.readDirectoryIfExists(directory)) {
        if (!file.endsWith(".bin")) continue;
        if (liveBinaryRecords.has(file)) keptBinaryObjects++;
        else {
          await this.target.remove(join(directory, file));
          removedBinaryObjects++;
        }
      }
    }
    return { keptObjects, removedObjects, keptBinaryObjects, removedBinaryObjects, keptLazyFiles: 0, removedLazyFiles: 0 };
  }

  private assertMutationsAllowed(): void {
    if (!this.allowMutations) {
      throw new Error("Admin mutations are disabled. Construct StorageAdminClient with allowMutations: true.");
    }
  }

  private async parentIndexFor(manifest: VersionedStorageManifest): Promise<ParentIndexRecord> {
    if (!this.parentIndex || this.parentIndex.transactionId !== manifest.transactionId) {
      const storedIndex = await this.reader.readParentIndex();
      if (storedIndex?.transactionId === manifest.transactionId) {
        this.parentIndex = storedIndex;
      } else {
        this.parentIndex = buildParentIndexRecord(await this.envelopeFromManifest(manifest), manifest.transactionId);
      }
    }
    return this.parentIndex;
  }
}

function liveObjectRecordFiles(manifest: VersionedStorageManifest, extension: "json" | "bin"): Set<string> {
  const files = new Set<string>();
  for (const objectId of manifest.objectIds) {
    files.add(`${objectId}.${extension}`);
    files.add(`${objectId}.${manifest.objectVersions?.[objectId] ?? manifest.transactionId}.${extension}`);
  }
  return files;
}

function productionSafetyStatus(issues: AdminProductionSafetyIssue[]): AdminProductionSafety["status"] {
  if (issues.some((issue) => issue.severity === "critical")) {
    return "unsafe";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "production-ready";
}

function productionSafetyScore(issues: AdminProductionSafetyIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === "critical") return total + 35;
    if (issue.severity === "warning") return total + 12;
    return total + 2;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function productionSafetySummary(issues: AdminProductionSafetyIssue[]): string {
  if (issues.some((issue) => issue.severity === "critical")) {
    return "Not safe for critical production writes until critical issues are resolved.";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "Usable with caveats; review warnings before using for critical or multi-pod stores.";
  }
  return "Configured for critical production use according to GraphVault Studio's local safety checks.";
}
