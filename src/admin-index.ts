import { join } from "node:path";
import type {
  SerializedEnvelope,
  StorageIndexDefinition,
  StorageIndexOptions,
  StorageIndexRecord,
  StorageIndexStatus,
  StorageTarget,
} from "@sprengmeister/graphvault/internal/core/types";
import type { StorageLayout } from "@sprengmeister/graphvault/internal/storage/storage-layout";
import {
  buildStorageIndexRecord,
  resolveStorageIndexOptions,
  storageIndexStatus,
  type ResolvedStorageIndexOptions,
} from "@sprengmeister/graphvault/internal/storage/storage-index";

export type AdminIndexMode = "off" | "auto" | "configured";
export type AdminIndexConsistency = "strict" | "committed";
export type AdminIndexDefinition = StorageIndexDefinition;
export type AdminIndexOptions = StorageIndexOptions;
export type ResolvedAdminIndexOptions = ResolvedStorageIndexOptions;
export type AdminStorageIndexRecord = StorageIndexRecord;
export type AdminIndexStatus = StorageIndexStatus;

export interface AdminIndexDetails {
  file: string;
  status: AdminIndexStatus;
  configured: ResolvedAdminIndexOptions;
  record?: AdminIndexRecordSummary;
  topTypes: Array<{ type: string; count: number }>;
  topProperties: Array<{ key: string; type: string; path: string; value: string; count: number }>;
  topOutgoing: Array<{ objectId: string; edgeCount: number }>;
  advancedDefinitions: AdminAdvancedIndexSummary[];
  advancedStatistics: Array<{ name: string; entries: number; keys: number; maxBucketSize: number; averageBucketSize: number; selectivity: number }>;
}

interface AdminIndexRecordSummary {
  transactionId: number;
  createdAt: string;
  mode: Exclude<AdminIndexMode, "off">;
  envelopeHash: string;
  indexedProperties: AdminIndexDefinition[];
  advancedDefinitions: number;
}

interface AdminAdvancedIndexSummary {
  name: string;
  kind: string;
  target: string;
  keys: number;
  entries: number;
  selectivity: number;
  maxBucketSize: number;
}

export function resolveAdminIndexOptions(options: boolean | AdminIndexOptions | undefined): ResolvedAdminIndexOptions {
  return resolveStorageIndexOptions(options);
}

export async function readAdminIndexRecord(target: StorageTarget, layout: StorageLayout): Promise<AdminStorageIndexRecord | undefined> {
  try {
    const value = JSON.parse(await target.readText(adminIndexFile(layout))) as AdminStorageIndexRecord;
    return value?.format === "graphvault-index" && value.version === 2 ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function writeAdminIndexRecord(
  target: StorageTarget,
  layout: StorageLayout,
  envelope: SerializedEnvelope,
  transactionId: number,
  options: ResolvedAdminIndexOptions,
): Promise<AdminStorageIndexRecord | undefined> {
  const record = buildStorageIndexRecord(envelope, transactionId, options);
  if (!record) {
    await target.remove(adminIndexFile(layout)).catch(() => undefined);
    return undefined;
  }
  await target.writeTextAtomic(adminIndexFile(layout), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function describeAdminIndex(
  layout: StorageLayout,
  options: ResolvedAdminIndexOptions,
  record: AdminStorageIndexRecord | undefined,
  transactionId: number,
): AdminIndexDetails {
  const effectiveOptions = effectiveAdminIndexOptions(options, record);
  return {
    file: adminIndexFile(layout),
    status: storageIndexStatus({ options: effectiveOptions, record, transactionId }),
    configured: effectiveOptions,
    ...(record ? { record: summarizeRecord(record) } : {}),
    topTypes: topEntries(record?.byType ?? {}, "type").map(({ key, count }) => ({ type: key, count })),
    topProperties: topEntries(record?.byProperty ?? {}, "property").map(({ key, count }) => ({ key, ...splitPropertyIndexKey(key), count })),
    topOutgoing: topEntries(record?.outgoing ?? {}, "edge").map(({ key, count }) => ({ objectId: key, edgeCount: count })),
    advancedDefinitions: summarizeAdvancedDefinitions(record),
    advancedStatistics: summarizeAdvancedStatistics(record),
  };
}

export function adminIndexFile(layout: StorageLayout): string {
  return "indexFile" in layout && typeof layout.indexFile === "string" ? layout.indexFile : join(layout.storageDirectory, "index.json");
}

function summarizeRecord(record: AdminStorageIndexRecord): AdminIndexRecordSummary {
  return {
    transactionId: record.transactionId,
    createdAt: record.createdAt,
    mode: record.mode,
    envelopeHash: record.envelopeHash,
    indexedProperties: record.indexedProperties,
    advancedDefinitions: record.advanced?.definitions.length ?? 0,
  };
}

function effectiveAdminIndexOptions(options: ResolvedAdminIndexOptions, record: AdminStorageIndexRecord | undefined): ResolvedAdminIndexOptions {
  if (!record || options.mode === "off") {
    return options;
  }
  const definitions = record.advanced?.definitions ?? [];
  return {
    mode: record.mode,
    consistency: options.consistency,
    properties: record.indexedProperties,
    advanced: {
      composites: definitions.filter((definition) => definition.kind === "composite" && definition.paths?.length).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        paths: definition.paths ?? [],
        ...(definition.unique ? { unique: definition.unique } : {}),
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
      ranges: definitions.filter((definition) => definition.kind === "range" && definition.path).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        path: definition.path ?? "",
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
      text: definitions.filter((definition) => definition.kind === "text" && definition.path).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        path: definition.path ?? "",
        ...(definition.caseSensitive ? { caseSensitive: definition.caseSensitive } : {}),
        ...(definition.minGram ? { minGram: definition.minGram } : {}),
        ...(definition.maxGram ? { maxGram: definition.maxGram } : {}),
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
      fullText: definitions.filter((definition) => definition.kind === "fullText" && definition.path).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        path: definition.path ?? "",
        ...(definition.caseSensitive ? { caseSensitive: definition.caseSensitive } : {}),
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
      unique: definitions.filter((definition) => definition.kind === "unique" && (definition.path || definition.paths?.length)).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        ...(definition.path ? { path: definition.path } : {}),
        ...(definition.paths?.length ? { paths: definition.paths } : {}),
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
      expressions: definitions.filter((definition) => definition.kind === "expression" && definition.expression).map((definition) => ({
        ...(definition.name ? { name: definition.name } : {}),
        ...(definition.type ? { type: definition.type } : {}),
        expression: definition.expression ?? { fn: "lower", path: "" },
        ...(definition.unique ? { unique: definition.unique } : {}),
        ...(definition.sparse ? { sparse: definition.sparse } : {}),
        ...(definition.partial ? { partial: definition.partial } : {}),
      })),
    },
  };
}

function summarizeAdvancedDefinitions(record: AdminStorageIndexRecord | undefined): AdminAdvancedIndexSummary[] {
  if (!record?.advanced) {
    return [];
  }
  return record.advanced.definitions.map((definition) => {
    const statistics = record.advanced?.statistics[definition.name];
    return {
      name: definition.name,
      kind: definition.kind,
      target: advancedTarget(definition),
      keys: advancedKeyCount(record, definition.name, definition.kind),
      entries: statistics?.entries ?? 0,
      selectivity: statistics?.selectivity ?? 0,
      maxBucketSize: statistics?.maxBucketSize ?? 0,
    };
  });
}

function summarizeAdvancedStatistics(record: AdminStorageIndexRecord | undefined): AdminIndexDetails["advancedStatistics"] {
  return Object.entries(record?.advanced?.statistics ?? {})
    .map(([name, statistics]) => ({ name, ...statistics }))
    .sort((left, right) => right.entries - left.entries || left.name.localeCompare(right.name))
    .slice(0, 24);
}

function advancedTarget(definition: NonNullable<AdminStorageIndexRecord["advanced"]>["definitions"][number]): string {
  if (definition.paths?.length) {
    return `${definition.type ? `${definition.type}.` : ""}${definition.paths.join(" + ")}`;
  }
  if (definition.path) {
    return `${definition.type ? `${definition.type}.` : ""}${definition.path}`;
  }
  if (definition.expression) {
    return `${definition.expression.fn}(${definition.type ? `${definition.type}.` : ""}${definition.expression.path})`;
  }
  return "-";
}

function advancedKeyCount(record: AdminStorageIndexRecord, name: string, kind: string): number {
  const advanced = record.advanced;
  if (!advanced) return 0;
  switch (kind) {
    case "composite":
      return Object.keys(advanced.composite[name] ?? {}).length;
    case "range":
      return advanced.range[name]?.length ?? 0;
    case "text":
      return Object.keys(advanced.text[name] ?? {}).length;
    case "fullText":
      return Object.keys(advanced.fullText[name] ?? {}).length;
    case "unique":
      return Object.keys(advanced.unique[name] ?? {}).length;
    case "expression":
      return Object.keys(advanced.expression[name] ?? {}).length;
    default:
      return 0;
  }
}

function topEntries(record: Record<string, readonly unknown[]>, kind: string): Array<{ key: string; count: number }> {
  return Object.entries(record)
    .map(([key, values]) => ({ key, count: values.length }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, kind === "property" ? 24 : 12);
}

function splitPropertyIndexKey(key: string): { type: string; path: string; value: string } {
  const [type = "*", path = "", ...valueParts] = key.split("\u0000");
  return { type, path, value: valueParts.join("\u0000") };
}
