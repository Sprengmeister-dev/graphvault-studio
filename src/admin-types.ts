import type {
  EncodedNode,
  EncodedValue,
  ObjectRecord,
  StorageTarget,
  TransactionRecord,
  TypeDictionary,
  VerificationResult,
} from "graphvault/internal/types";

export type { GvqlResult } from "graphvault/internal/gvql";

export interface StorageAdminClientOptions {
  storageDirectory: string;
  storageTarget?: StorageTarget;
  channelCount?: number;
  allowMutations?: boolean;
}

export interface AdminSummary {
  storageDirectory: string;
  transactionId: number;
  currentSnapshot?: string;
  objectCount: number;
  latestTransaction?: TransactionRecord;
  typeDictionary?: TypeDictionary;
  verification?: VerificationResult;
  verificationSkipped?: boolean;
}

export interface AdminObjectListItem {
  objectId: string;
  kind: EncodedNode["kind"];
  type?: string;
  transactionId: number;
  preview: string;
}

export interface AdminObjectPage {
  offset: number;
  limit: number;
  total: number;
  items: AdminObjectListItem[];
}

export interface AdminObjectChild {
  from: string;
  to: string;
  path: string;
  kind: EncodedNode["kind"];
  type?: string;
  preview: string;
}

export interface AdminObjectParent {
  objectId: string;
  path: string;
  kind: EncodedNode["kind"];
  type?: string;
  transactionId: number;
  preview: string;
}

export interface AdminHierarchyPathItem {
  objectId: string;
  label: string;
  kind: EncodedNode["kind"];
  type?: string;
  transactionId: number;
  preview: string;
}

export interface AdminHierarchyPath {
  targetObjectId: string;
  found: boolean;
  items: AdminHierarchyPathItem[];
  directParents: AdminObjectParent[];
}

export interface AdminRootReference {
  root: EncodedValue;
  rootObjectId?: string;
}

export interface AdminSearchResult {
  objectId: string;
  path: string;
  preview: string;
}

export interface AdminGraph {
  root: EncodedValue;
  nodes: AdminGraphNode[];
  edges: AdminGraphEdge[];
}

export interface AdminGraphNode {
  objectId: string;
  kind: EncodedNode["kind"];
  type?: string;
}

export interface AdminGraphEdge {
  from: string;
  to: string;
  path: string;
}

export interface AdminMutation {
  objectId: string;
  path: string;
  value: unknown;
}

export interface AdminMutationPreview {
  objectId: string;
  path: string;
  before: EncodedValue;
  after: EncodedValue;
}

export type AdminObjectRecord = ObjectRecord;
