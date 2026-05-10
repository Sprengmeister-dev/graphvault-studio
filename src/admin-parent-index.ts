import { summarizeNode } from "./admin-inspection.js";
import type { AdminHierarchyPath, AdminHierarchyPathItem, AdminObjectParent } from "./admin-types.js";
import type { ObjectRecord, ParentIndexRecord } from "graphvault/internal/types";

export async function directParentsFromIndex(
  index: ParentIndexRecord,
  objectId: string,
  readObjectRecord: (objectId: string) => Promise<ObjectRecord>,
): Promise<AdminObjectParent[]> {
  const parents: AdminObjectParent[] = [];
  for (const parent of index.parents[objectId] ?? []) {
    const record = await readObjectRecord(parent.parentObjectId);
    parents.push({
      objectId: record.objectId,
      path: parent.path,
      kind: record.node.kind,
      ...(record.node.kind === "object" && record.node.type ? { type: record.node.type } : {}),
      transactionId: record.transactionId,
      preview: summarizeNode(record.node),
    });
  }
  return parents;
}

export async function pathFromObjectToRoot(
  index: ParentIndexRecord,
  targetObjectId: string,
  readObjectRecord: (objectId: string) => Promise<ObjectRecord>,
): Promise<AdminHierarchyPath> {
  const directParents = await directParentsFromIndex(index, targetObjectId, readObjectRecord);
  if (!index.rootObjectId) {
    return { targetObjectId, found: false, items: [], directParents };
  }

  const target = await readPathItem(targetObjectId, "object", readObjectRecord);
  if (!target) {
    return { targetObjectId, found: false, items: [], directParents };
  }
  if (targetObjectId === index.rootObjectId) {
    return { targetObjectId, found: true, items: [{ ...target, label: "root" }], directParents };
  }

  const queue: Array<{ objectId: string; reverseItems: AdminHierarchyPathItem[] }> = [{ objectId: targetObjectId, reverseItems: [target] }];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift() as { objectId: string; reverseItems: AdminHierarchyPathItem[] };
    if (seen.has(current.objectId)) {
      continue;
    }
    seen.add(current.objectId);

    for (const parent of index.parents[current.objectId] ?? []) {
      const parentItem = await readPathItem(parent.parentObjectId, parent.parentObjectId === index.rootObjectId ? "root" : "object", readObjectRecord);
      if (!parentItem) {
        continue;
      }
      const [currentItem, ...remainingItems] = current.reverseItems;
      if (!currentItem) {
        continue;
      }
      const childItems = [{ ...currentItem, label: parent.path }, ...remainingItems];
      const nextItems = [parentItem, ...childItems];
      if (parent.parentObjectId === index.rootObjectId) {
        return { targetObjectId, found: true, items: nextItems, directParents };
      }
      queue.push({ objectId: parent.parentObjectId, reverseItems: nextItems });
    }
  }

  return { targetObjectId, found: false, items: [], directParents };
}

async function readPathItem(
  objectId: string,
  label: string,
  readObjectRecord: (objectId: string) => Promise<ObjectRecord>,
): Promise<AdminHierarchyPathItem | undefined> {
  try {
    const record = await readObjectRecord(objectId);
    return {
      objectId: record.objectId,
      label,
      kind: record.node.kind,
      ...(record.node.kind === "object" && record.node.type ? { type: record.node.type } : {}),
      transactionId: record.transactionId,
      preview: summarizeNode(record.node),
    };
  } catch {
    return undefined;
  }
}
