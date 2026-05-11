import { createHash } from "node:crypto";
import { join } from "node:path";
import type { SerializedEnvelope, StorageTarget, TransactionRecord } from "@sprengmeister/graphvault/internal/core/types";
import type { StorageLayout } from "@sprengmeister/graphvault/internal/storage/storage-layout";
import type { VersionedStorageManifest } from "./admin-storage-io.js";

export type IntegrityTransactionRecord = TransactionRecord & {
  envelopeHash?: string;
  previousHash?: string;
  transactionHash?: string;
};

export type IntegrityStorageManifest = VersionedStorageManifest & {
  latestTransactionHash?: string;
};

export function envelopeHash(envelope: SerializedEnvelope): string {
  return sha256Hex(canonicalJson(envelope));
}

export function transactionRecordHash(record: Omit<IntegrityTransactionRecord, "transactionHash">): string {
  return sha256Hex(canonicalJson(record));
}

export function transactionHashPayload(record: IntegrityTransactionRecord): Omit<IntegrityTransactionRecord, "transactionHash"> {
  const { transactionHash: _transactionHash, ...payload } = record;
  return payload;
}

export async function verifyAdminIntegrity(options: {
  target: StorageTarget;
  layout: StorageLayout;
  manifest: IntegrityStorageManifest;
  transactions: IntegrityTransactionRecord[];
}): Promise<{ checkedIntegrityHashes: number; warnings: string[]; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let checkedIntegrityHashes = 0;
  let previousHash: string | undefined;
  const records = [...options.transactions].sort((a, b) => a.transactionId - b.transactionId);
  for (const record of records) {
    if (record.previousHash || record.transactionHash) {
      if (record.previousHash !== previousHash) {
        errors.push(`Transaction ${record.transactionId} has an invalid previousHash.`);
      }
      if (!record.transactionHash) {
        errors.push(`Transaction ${record.transactionId} is missing transactionHash.`);
      } else {
        checkedIntegrityHashes++;
        if (record.transactionHash !== transactionRecordHash(transactionHashPayload(record))) {
          errors.push(`Transaction ${record.transactionId} has an invalid transactionHash.`);
        }
      }
    }
    if (record.envelopeHash) {
      try {
        const snapshot = JSON.parse(await options.target.readText(join(options.layout.snapshotsDirectory, record.snapshotFile))) as SerializedEnvelope;
        checkedIntegrityHashes++;
        if (record.envelopeHash !== envelopeHash(snapshot)) {
          errors.push(`Transaction ${record.transactionId} envelopeHash does not match ${record.snapshotFile}.`);
        }
      } catch {
        // Snapshot-free write profiles are valid.
      }
    }
    previousHash = record.transactionHash ?? previousHash;
  }
  const published = records.find((record) => record.transactionId === options.manifest.transactionId);
  if (options.manifest.latestTransactionHash) {
    checkedIntegrityHashes++;
    if (published?.transactionHash && options.manifest.latestTransactionHash !== published.transactionHash) {
      errors.push(`Manifest latestTransactionHash does not match transaction ${published.transactionId}.`);
    }
  }
  if (records.length > 0 && !records.at(-1)?.transactionHash) {
    warnings.push("Latest transaction record has no transactionHash; integrity-chain verification is limited for legacy data.");
  }
  return { checkedIntegrityHashes, warnings, errors };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
}
