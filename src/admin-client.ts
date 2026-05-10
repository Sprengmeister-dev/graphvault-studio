import { join } from "node:path";
import { copyStorageTargetTree, LocalFilesystemTarget } from "graphvault/internal/storage-target";
import { StorageLayout } from "graphvault/internal/storage-layout";
import { StorageReader } from "graphvault/internal/storage-reader";
import { StorageWriter } from "graphvault/internal/storage-writer";
import { verifyStorage } from "graphvault/internal/storage-verifier";
import { buildParentIndexRecord } from "graphvault/internal/storage-parent-index";
import { referencedChildren, summarizeNode, visitNode } from "./admin-inspection.js";
import { encodeAdminValue, getNodePath, setNodePath } from "./admin-mutation.js";
import { pathFromObjectToRoot } from "./admin-parent-index.js";
import type {
  BackupResult,
  MaintenanceResult,
  ObjectRecord,
  ParentIndexRecord,
  StorageManifest,
  StorageTarget,
  TransactionRecord,
  TypeDictionary,
  VerificationResult,
} from "graphvault/internal/types";

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
  AdminRootReference,
  AdminSearchResult,
  AdminSummary,
  StorageAdminClientOptions,
} from "./admin-types.js";

export type {
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
  AdminRootReference,
  AdminSearchResult,
  AdminSummary,
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
    return {
      storageDirectory: this.options.storageDirectory,
      transactionId: manifest.transactionId,
      ...(currentSnapshot ? { currentSnapshot } : {}),
      objectCount: manifest.objectIds.length,
      ...(latestTransaction ? { latestTransaction } : {}),
      ...(typeDictionary ? { typeDictionary } : {}),
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
      const record = await this.reader.readObjectRecord(objectId);
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
    return this.reader.readObjectRecord(objectId);
  }

  async rootReference(): Promise<AdminRootReference> {
    const manifest = await this.requireManifest();
    return {
      root: manifest.root,
      ...(manifest.root && typeof manifest.root === "object" && "$ref" in manifest.root ? { rootObjectId: manifest.root.$ref } : {}),
    };
  }

  async listObjectChildren(objectId: string): Promise<AdminObjectChild[]> {
    const record = await this.reader.readObjectRecord(objectId);
    const children: AdminObjectChild[] = [];
    for (const [path, to] of referencedChildren(record.node)) {
      const child = await this.reader.readObjectRecord(to);
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
    return pathFromObjectToRoot(index, targetObjectId, (objectId) => this.reader.readObjectRecord(objectId));
  }

  async graph(): Promise<AdminGraph> {
    const manifest = await this.requireManifest();
    const envelope = await this.reader.envelopeFromManifest(manifest);
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

  async search(query: string, options: { limit?: number } = {}): Promise<AdminSearchResult[]> {
    const manifest = await this.requireManifest();
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const limit = Math.min(500, Math.max(1, options.limit ?? 500));
    const results: AdminSearchResult[] = [];
    for (const objectId of manifest.objectIds) {
      const record = await this.reader.readObjectRecord(objectId);
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
    return verifyStorage({
      target: this.target,
      lazyDirectory: this.layout.lazyDirectory,
      readManifest: () => this.reader.readManifest(),
      readLatestTransactionRecord: () => this.reader.readLatestTransactionRecord(),
      readObjectRecord: (objectId) => this.reader.readObjectRecord(objectId),
    });
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
    const envelope = await this.reader.envelopeFromManifest(manifest);
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
    const envelope = await this.reader.envelopeFromManifest(manifest);
    const node = envelope.nodes[mutation.objectId];
    if (!node) {
      throw new Error(`Object ${mutation.objectId} does not exist.`);
    }
    setNodePath(node, mutation.path, encodeAdminValue(mutation.value));
    const transactionId = manifest.transactionId + 1;
    const snapshotFile = `snapshot-${String(transactionId).padStart(12, "0")}.json`;
    await this.writer.writeObjectRecords(envelope, transactionId, Object.keys(envelope.nodes));
    await this.writer.writeManifest(envelope, transactionId);
    await this.writer.writeParentIndex(envelope, transactionId);
    await this.writer.writeJson(join(this.layout.snapshotsDirectory, snapshotFile), envelope);
    await this.target.writeTextAtomic(this.layout.currentFile, snapshotFile);
    const record: TransactionRecord = {
      format: "graphvault-transaction",
      version: 1,
      transactionId,
      committedAt: new Date().toISOString(),
      snapshotFile,
      objectIds: Object.keys(envelope.nodes).sort((a, b) => Number(a) - Number(b)),
      mode: "standard",
      targetCount: 1,
    };
    await this.writer.writeTransactionRecord(record);
    this.parentIndex = undefined;
    return record;
  }

  private async requireManifest(): Promise<StorageManifest> {
    const manifest = await this.reader.readManifest();
    if (!manifest) {
      throw new Error("Storage manifest not found or unreadable.");
    }
    return manifest;
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
    const liveObjects = new Set(manifest.objectIds);
    let keptObjects = 0;
    let removedObjects = 0;
    let keptBinaryObjects = 0;
    let removedBinaryObjects = 0;
    for (const directory of this.layout.objectRecordDirectories("json")) {
      for (const file of await this.reader.readDirectoryIfExists(directory)) {
        if (!file.endsWith(".json")) continue;
        const objectId = file.slice(0, -".json".length);
        if (liveObjects.has(objectId)) keptObjects++;
        else {
          await this.target.remove(join(directory, file));
          removedObjects++;
        }
      }
    }
    for (const directory of this.layout.objectRecordDirectories("binary")) {
      for (const file of await this.reader.readDirectoryIfExists(directory)) {
        if (!file.endsWith(".bin")) continue;
        const objectId = file.slice(0, -".bin".length);
        if (liveObjects.has(objectId)) keptBinaryObjects++;
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

  private async parentIndexFor(manifest: StorageManifest): Promise<ParentIndexRecord> {
    if (!this.parentIndex || this.parentIndex.transactionId !== manifest.transactionId) {
      const storedIndex = await this.reader.readParentIndex();
      if (storedIndex?.transactionId === manifest.transactionId) {
        this.parentIndex = storedIndex;
      } else {
        this.parentIndex = buildParentIndexRecord(await this.reader.envelopeFromManifest(manifest), manifest.transactionId);
      }
    }
    return this.parentIndex;
  }
}
