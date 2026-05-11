import { referencedChildren } from "./admin-inspection.js";
import type { VersionedStorageManifest } from "./admin-storage-io.js";
import type { AdminGraphEdge, AdminGraphNode, AdminSubtree, AdminSubtreeReference } from "./admin-types.js";
import type { EncodedNode, EncodedValue, ObjectRecord } from "@sprengmeister/graphvault/internal/core/types";

export interface AdminSubtreeOptions {
  rootObjectId?: string;
  depth?: number;
}

export async function loadAdminSubtree(
  manifest: VersionedStorageManifest,
  readObjectRecord: (objectId: string) => Promise<ObjectRecord>,
  options: AdminSubtreeOptions = {},
): Promise<AdminSubtree> {
  const depth = normalizeDepth(options.depth ?? 2);
  const rootObjectId = options.rootObjectId ?? objectIdFromRef(manifest.root);
  const root: EncodedValue = rootObjectId ? { $ref: rootObjectId } : manifest.root;
  if (!rootObjectId) {
    return {
      root,
      transactionId: manifest.transactionId,
      depth,
      complete: true,
      objectIds: [],
      nodes: [],
      edges: [],
      truncatedReferences: [],
      envelope: emptyEnvelope(manifest.createdAt, root),
    };
  }

  const knownObjectIds = new Set(manifest.objectIds);
  if (!knownObjectIds.has(rootObjectId)) {
    throw new Error(`Cannot load subtree: object "${rootObjectId}" is not present in the current manifest.`);
  }

  const encodedNodes: Record<string, EncodedNode> = {};
  const graphNodes: AdminGraphNode[] = [];
  const graphEdges: AdminGraphEdge[] = [];
  const truncatedReferences: AdminSubtreeReference[] = [];
  const queue: Array<{ objectId: string; depth: number }> = [{ objectId: rootObjectId, depth: 0 }];
  const queued = new Set([rootObjectId]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (!current) {
      continue;
    }
    const record = await readObjectRecord(current.objectId);
    encodedNodes[record.objectId] = record.node;
    graphNodes.push({
      objectId: record.objectId,
      kind: record.node.kind,
      ...(record.node.kind === "object" && record.node.type ? { type: record.node.type } : {}),
    });
    for (const [path, toObjectId] of referencedChildren(record.node)) {
      const reference = { fromObjectId: record.objectId, toObjectId, path, depth: current.depth + 1 };
      if (!knownObjectIds.has(toObjectId) || current.depth >= depth) {
        truncatedReferences.push(reference);
        continue;
      }
      graphEdges.push({ from: record.objectId, to: toObjectId, path });
      if (!queued.has(toObjectId)) {
        queued.add(toObjectId);
        queue.push({ objectId: toObjectId, depth: current.depth + 1 });
      }
    }
  }

  const objectIds = Object.keys(encodedNodes);
  return {
    root,
    rootObjectId,
    transactionId: manifest.transactionId,
    depth,
    complete: truncatedReferences.length === 0,
    objectIds,
    nodes: graphNodes,
    edges: graphEdges,
    truncatedReferences,
    envelope: {
      format: "graphvault",
      version: 1,
      createdAt: manifest.createdAt,
      root,
      nodes: encodedNodes,
    },
  };
}

function emptyEnvelope(createdAt: string, root: EncodedValue): AdminSubtree["envelope"] {
  return {
    format: "graphvault",
    version: 1,
    createdAt,
    root,
    nodes: {},
  };
}

function objectIdFromRef(value: EncodedValue): string | undefined {
  return value && typeof value === "object" && "$ref" in value ? value.$ref : undefined;
}

function normalizeDepth(depth: number): number {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new TypeError("Subtree depth must be a non-negative integer.");
  }
  return Math.min(depth, 12);
}
