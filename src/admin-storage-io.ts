import { dirname, join } from "node:path";
import { decodeBinaryRecord, encodeBinaryRecord } from "@sprengmeister/graphvault/internal/core/binary-codec";
import type {
  ObjectRecord,
  SerializedEnvelope,
  StorageManifest,
  StorageTarget,
} from "@sprengmeister/graphvault/internal/core/types";
import type { StorageLayout } from "@sprengmeister/graphvault/internal/storage/storage-layout";

export type VersionedStorageManifest = StorageManifest & {
  objectVersions?: Record<string, number>;
  latestTransactionHash?: string;
};

export async function readAdminObjectRecord(
  target: StorageTarget,
  layout: StorageLayout,
  manifest: VersionedStorageManifest,
  objectId: string,
): Promise<ObjectRecord> {
  const version = manifest.objectVersions?.[objectId] ?? manifest.transactionId;
  return readVersionedObjectRecord(target, layout, objectId, version).catch(() => readUnversionedObjectRecord(target, layout, objectId));
}

export async function envelopeFromAdminManifest(
  target: StorageTarget,
  layout: StorageLayout,
  manifest: VersionedStorageManifest,
): Promise<SerializedEnvelope> {
  const nodes: SerializedEnvelope["nodes"] = {};
  for (const objectId of manifest.objectIds) {
    nodes[objectId] = (await readAdminObjectRecord(target, layout, manifest, objectId)).node;
  }
  return {
    format: "graphvault",
    version: 1,
    createdAt: manifest.createdAt,
    root: manifest.root,
    nodes,
  };
}

export async function writeAdminObjectRecords(
  target: StorageTarget,
  layout: StorageLayout,
  envelope: SerializedEnvelope,
  transactionId: number,
  objectIds: readonly string[],
): Promise<void> {
  const storedAt = new Date().toISOString();
  await Promise.all(
    objectIds.map(async (objectId) => {
      const node = envelope.nodes[objectId];
      if (!node) {
        return;
      }
      const record: ObjectRecord = {
        format: "graphvault-object",
        version: 1,
        objectId,
        transactionId,
        storedAt,
        node,
      };
      await Promise.all([
        target.writeBufferAtomic(versionedBinaryObjectPath(layout, objectId, transactionId), encodeBinaryRecord(record)),
        writeJson(target, versionedJsonObjectPath(layout, objectId, transactionId), record),
      ]);
    }),
  );
}

export async function writeAdminManifest(
  target: StorageTarget,
  layout: StorageLayout,
  envelope: SerializedEnvelope,
  transactionId: number,
  latestTransactionHash?: string,
): Promise<void> {
  const objectIds = Object.keys(envelope.nodes).sort((a, b) => Number(a) - Number(b));
  const objectVersions = Object.fromEntries(objectIds.map((objectId) => [objectId, transactionId]));
  await writeJson(target, layout.manifestFile, {
    format: "graphvault-manifest",
    version: 1,
    transactionId,
    createdAt: new Date().toISOString(),
    root: envelope.root,
    objectIds,
    objectVersions,
    ...(latestTransactionHash ? { latestTransactionHash } : {}),
  } satisfies VersionedStorageManifest);
}

async function readVersionedObjectRecord(
  target: StorageTarget,
  layout: StorageLayout,
  objectId: string,
  transactionId: number,
): Promise<ObjectRecord> {
  try {
    return decodeBinaryRecord<ObjectRecord>(await target.readBuffer(versionedBinaryObjectPath(layout, objectId, transactionId)));
  } catch {
    return JSON.parse(await target.readText(versionedJsonObjectPath(layout, objectId, transactionId))) as ObjectRecord;
  }
}

async function readUnversionedObjectRecord(target: StorageTarget, layout: StorageLayout, objectId: string): Promise<ObjectRecord> {
  try {
    return decodeBinaryRecord<ObjectRecord>(await target.readBuffer(layout.binaryObjectPath(objectId)));
  } catch {
    return JSON.parse(await target.readText(layout.objectRecordPath(objectId))) as ObjectRecord;
  }
}

function versionedJsonObjectPath(layout: StorageLayout, objectId: string, transactionId: number): string {
  return join(dirname(layout.objectRecordPath(objectId)), `${objectId}.${transactionId}.json`);
}

function versionedBinaryObjectPath(layout: StorageLayout, objectId: string, transactionId: number): string {
  return join(dirname(layout.binaryObjectPath(objectId)), `${objectId}.${transactionId}.bin`);
}

async function writeJson(target: StorageTarget, path: string, value: unknown): Promise<void> {
  await target.writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
