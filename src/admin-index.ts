import { createHash } from "node:crypto";
import { join } from "node:path";
import type { EncodedNode, EncodedValue, SerializedEnvelope, StorageTarget } from "@sprengmeister/graphvault/internal/core/types";
import type { StorageLayout } from "@sprengmeister/graphvault/internal/storage/storage-layout";

export type AdminIndexMode = "off" | "auto" | "configured";
export type AdminIndexConsistency = "strict" | "committed";

export interface AdminIndexDefinition {
  type?: string;
  path: string;
}

export interface AdminIndexOptions {
  mode?: AdminIndexMode;
  consistency?: AdminIndexConsistency;
  properties?: Array<string | AdminIndexDefinition>;
}

export interface ResolvedAdminIndexOptions {
  mode: AdminIndexMode;
  consistency: AdminIndexConsistency;
  properties: AdminIndexDefinition[];
}

export interface AdminIndexEdge {
  from: string;
  to: string;
  path: string;
  label: string;
}

export interface AdminStorageIndexRecord {
  format: "graphvault-index";
  version: 1;
  transactionId: number;
  createdAt: string;
  envelopeHash: string;
  nodeCount: number;
  mode: Exclude<AdminIndexMode, "off">;
  indexedProperties: AdminIndexDefinition[];
  byType: Record<string, string[]>;
  byProperty: Record<string, string[]>;
  outgoing: Record<string, AdminIndexEdge[]>;
  incoming: Record<string, AdminIndexEdge[]>;
}

export interface AdminIndexStatus {
  enabled: boolean;
  mode: AdminIndexMode;
  consistency: AdminIndexConsistency;
  transactionId?: number;
  nodeCount: number;
  propertyKeys: number;
  edgeCount: number;
  source: "storage" | "missing" | "stale" | "disabled";
}

export interface AdminIndexDetails {
  file: string;
  status: AdminIndexStatus;
  configured: ResolvedAdminIndexOptions;
  record?: AdminIndexRecordSummary;
  topTypes: Array<{ type: string; count: number }>;
  topProperties: Array<{ key: string; type: string; path: string; value: string; count: number }>;
  topOutgoing: Array<{ objectId: string; edgeCount: number }>;
}

interface AdminIndexRecordSummary {
  transactionId: number;
  createdAt: string;
  mode: Exclude<AdminIndexMode, "off">;
  envelopeHash: string;
  indexedProperties: AdminIndexDefinition[];
}

export function resolveAdminIndexOptions(options: boolean | AdminIndexOptions | undefined): ResolvedAdminIndexOptions {
  if (options === false) {
    return { mode: "off", consistency: "strict", properties: [] };
  }
  if (options === true || !options) {
    return { mode: "auto", consistency: "strict", properties: [] };
  }
  return {
    mode: options.mode ?? (options.properties?.length ? "configured" : "auto"),
    consistency: options.consistency ?? "strict",
    properties: normalizeIndexDefinitions(options.properties ?? []),
  };
}

export async function readAdminIndexRecord(target: StorageTarget, layout: StorageLayout): Promise<AdminStorageIndexRecord | undefined> {
  try {
    const value = JSON.parse(await target.readText(adminIndexFile(layout))) as AdminStorageIndexRecord;
    return value?.format === "graphvault-index" && value.version === 1 ? value : undefined;
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
  if (options.mode === "off") {
    await target.remove(adminIndexFile(layout)).catch(() => undefined);
    return undefined;
  }
  const record = buildAdminIndexRecord(envelope, transactionId, options);
  await target.writeTextAtomic(adminIndexFile(layout), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function describeAdminIndex(
  layout: StorageLayout,
  options: ResolvedAdminIndexOptions,
  record: AdminStorageIndexRecord | undefined,
  transactionId: number,
): AdminIndexDetails {
  return {
    file: adminIndexFile(layout),
    status: adminIndexStatus(options, record, transactionId),
    configured: options,
    ...(record ? { record: summarizeRecord(record) } : {}),
    topTypes: topEntries(record?.byType ?? {}, "type").map(({ key, count }) => ({ type: key, count })),
    topProperties: topEntries(record?.byProperty ?? {}, "property").map(({ key, count }) => ({ key, ...splitPropertyIndexKey(key), count })),
    topOutgoing: topEntries(record?.outgoing ?? {}, "edge").map(({ key, count }) => ({ objectId: key, edgeCount: count })),
  };
}

export function adminIndexFile(layout: StorageLayout): string {
  return "indexFile" in layout && typeof layout.indexFile === "string" ? layout.indexFile : join(layout.storageDirectory, "index.json");
}

function buildAdminIndexRecord(
  envelope: SerializedEnvelope,
  transactionId: number,
  options: ResolvedAdminIndexOptions,
): AdminStorageIndexRecord {
  const byType = new Map<string, string[]>();
  const byProperty = new Map<string, string[]>();
  const outgoing = new Map<string, AdminIndexEdge[]>();
  const incoming = new Map<string, AdminIndexEdge[]>();
  const configured = configuredPropertyKeys(options.properties);

  for (const [objectId, node] of Object.entries(envelope.nodes)) {
    if (node.kind === "object" && node.type) {
      append(byType, node.type, objectId);
    }
    if (node.kind === "object") {
      for (const [path, value] of Object.entries(node.props)) {
        if (options.mode === "configured" && !configured.has(propertyKey(node.type, path)) && !configured.has(propertyKey(undefined, path))) {
          continue;
        }
        indexProperty(byProperty, node.type, path, encodedValueToJs(value), objectId);
      }
    }
    for (const edge of referencedEdges(objectId, node)) {
      append(outgoing, edge.from, edge);
      append(incoming, edge.to, edge);
    }
  }

  return {
    format: "graphvault-index",
    version: 1,
    transactionId,
    createdAt: new Date().toISOString(),
    envelopeHash: indexEnvelopeHash(envelope),
    nodeCount: Object.keys(envelope.nodes).length,
    mode: options.mode === "configured" ? "configured" : "auto",
    indexedProperties: options.properties,
    byType: mapToRecord(byType),
    byProperty: mapToRecord(byProperty),
    outgoing: mapToRecord(outgoing),
    incoming: mapToRecord(incoming),
  };
}

function adminIndexStatus(
  options: ResolvedAdminIndexOptions,
  record: AdminStorageIndexRecord | undefined,
  transactionId: number,
): AdminIndexStatus {
  if (options.mode === "off") {
    return { enabled: false, mode: "off", consistency: options.consistency, nodeCount: 0, propertyKeys: 0, edgeCount: 0, source: "disabled" };
  }
  if (!record) {
    return { enabled: true, mode: options.mode, consistency: options.consistency, nodeCount: 0, propertyKeys: 0, edgeCount: 0, source: "missing" };
  }
  return {
    enabled: true,
    mode: options.mode,
    consistency: options.consistency,
    transactionId: record.transactionId,
    nodeCount: record.nodeCount,
    propertyKeys: Object.keys(record.byProperty).length,
    edgeCount: Object.values(record.outgoing).reduce((count, edges) => count + edges.length, 0),
    source: record.transactionId === transactionId ? "storage" : "stale",
  };
}

function normalizeIndexDefinitions(properties: Array<string | AdminIndexDefinition>): AdminIndexDefinition[] {
  const seen = new Set<string>();
  const normalized: AdminIndexDefinition[] = [];
  for (const property of properties) {
    const definition = typeof property === "string" ? { path: property } : property;
    const path = definition.path?.trim();
    const type = definition.type?.trim();
    if (!path) continue;
    const key = propertyKey(type || undefined, path);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(type ? { type, path } : { path });
  }
  return normalized;
}

function configuredPropertyKeys(properties: AdminIndexDefinition[]): Set<string> {
  return new Set(properties.map((property) => propertyKey(property.type, property.path)));
}

function propertyKey(type: string | undefined, path: string): string {
  return `${type ?? "*"}\u0000${path}`;
}

function propertyIndexKey(type: string | undefined, path: string, value: unknown): string {
  return `${type ?? "*"}\u0000${path}\u0000${stableValueKey(value)}`;
}

function indexProperty(index: Map<string, string[]>, type: string | undefined, path: string, value: unknown, objectId: string): void {
  append(index, propertyIndexKey(undefined, path, value), objectId);
  if (type) {
    append(index, propertyIndexKey(type, path, value), objectId);
  }
}

function append<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function mapToRecord<T>(map: ReadonlyMap<string, readonly T[]>): Record<string, T[]> {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, [...value]]));
}

function indexEnvelopeHash(envelope: SerializedEnvelope): string {
  return createHash("sha256").update(JSON.stringify({ format: envelope.format, version: envelope.version, root: envelope.root, nodes: envelope.nodes })).digest("hex");
}

function encodedValueToJs(value: EncodedValue): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if ("$ref" in value) return { $ref: value.$ref };
  if (value.$type === "undefined") return undefined;
  if (value.$type === "number") return value.value === "NaN" ? Number.NaN : value.value === "Infinity" ? Infinity : value.value === "-Infinity" ? -Infinity : -0;
  if (value.$type === "bigint") return BigInt(value.value);
  if (value.$type === "date" || value.$type === "buffer" || value.$type === "arraybuffer" || value.$type === "sharedarraybuffer" || value.$type === "dataview" || value.$type === "typedarray") return value.value;
  if (value.$type === "regexp") return `/${value.source}/${value.flags}`;
  if (value.$type === "url" || value.$type === "urlsearchparams") return value.value;
  if (value.$type === "symbol") return value.key ? `Symbol(${value.key})` : "Symbol()";
  return value.message;
}

function stableValueKey(value: unknown): string {
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (value && typeof value === "object") return JSON.stringify(value);
  return `${typeof value}:${String(value)}`;
}

function referencedEdges(from: string, node: EncodedNode): AdminIndexEdge[] {
  const edges: AdminIndexEdge[] = [];
  visitEncodedNode(node, (path, value) => {
    if (value && typeof value === "object" && "$ref" in value) {
      edges.push({ from, to: value.$ref, path, label: edgeLabel(path) });
    }
  });
  return edges;
}

function visitEncodedNode(node: EncodedNode, visit: (path: string, value: EncodedValue) => void): void {
  if (node.kind === "array" || node.kind === "set") {
    node.items.forEach((value, index) => visit(`[${index}]`, value));
  } else if (node.kind === "map") {
    node.entries.forEach(([key, value], index) => {
      visit(`entries[${index}].key`, key);
      visit(`entries[${index}].value`, value);
    });
  } else if (node.kind === "object") {
    Object.entries(node.props).forEach(([key, value]) => visit(key, value));
    node.symbolProps?.forEach(([key, value], index) => {
      visit(`symbolProps[${index}].key`, key);
      visit(`symbolProps[${index}].value`, value);
    });
  }
}

function edgeLabel(path: string): string {
  const end = Math.min(...[path.indexOf("["), path.indexOf(".")].filter((value) => value >= 0));
  return Number.isFinite(end) ? path.slice(0, end) : path;
}

function summarizeRecord(record: AdminStorageIndexRecord): AdminIndexRecordSummary {
  return {
    transactionId: record.transactionId,
    createdAt: record.createdAt,
    mode: record.mode,
    envelopeHash: record.envelopeHash,
    indexedProperties: record.indexedProperties,
  };
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
