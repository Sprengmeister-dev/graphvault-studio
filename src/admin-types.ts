import type {
  EncodedNode,
  EncodedValue,
  ObjectRecord,
  StorageTarget,
  TransactionRecord,
  TypeDictionary,
  VerificationResult,
} from "@sprengmeister/graphvault/internal/core/types";

export type { GvqlResult } from "@sprengmeister/graphvault/internal/gvql/gvql";

export interface StorageAdminClientOptions {
  storageDirectory: string;
  storageTarget?: StorageTarget;
  channelCount?: number;
  allowMutations?: boolean;
  lockTimeoutMs?: number;
  staleLockTimeoutMs?: number;
  transactionLog?: "full" | "off";
}

export interface AdminStorageHardening {
  mutationsAllowed: boolean;
  transactionLog: "full" | "off";
  writerLock: "enabled";
  fencingTokens: "used-when-supported";
  staleLockRecovery: boolean;
}

export interface AdminSummary {
  storageDirectory: string;
  transactionId: number;
  currentSnapshot?: string;
  objectCount: number;
  latestTransaction?: TransactionRecord;
  typeDictionary?: TypeDictionary;
  hardening: AdminStorageHardening;
  operations: AdminOperationalStatus;
  verification?: VerificationResult;
  verificationSkipped?: boolean;
}

export interface AdminOperationalStatus {
  transactionLog: "full" | "off";
  mutationsAllowed: boolean;
  lockTimeoutMs: number;
  staleLockTimeoutMs?: number;
  walPrepareFiles: number;
  walCommitFiles: number;
  latestWalTransactionId: number;
  latestJournalTransactionId: number;
  publishedTransactionId: number;
  pendingWalCommits: number;
  checkedIntegrityHashes?: number;
  status: "healthy" | "recovery-pending";
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
  depth?: number;
  complete?: boolean;
  rootObjectId?: string;
  nodes: AdminGraphNode[];
  edges: AdminGraphEdge[];
  truncatedReferences?: AdminSubtreeReference[];
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

export interface AdminSubtreeReference {
  fromObjectId: string;
  toObjectId: string;
  path: string;
  depth: number;
}

export interface AdminSubtree {
  root: EncodedValue;
  rootObjectId?: string;
  transactionId: number;
  depth: number;
  complete: boolean;
  objectIds: string[];
  nodes: AdminGraphNode[];
  edges: AdminGraphEdge[];
  truncatedReferences: AdminSubtreeReference[];
  envelope: {
    format: "graphvault";
    version: 1;
    createdAt: string;
    root: EncodedValue;
    nodes: Record<string, EncodedNode>;
  };
}

export interface AdminMutation {
  objectId: string;
  path: string;
  value: unknown;
  metadata?: AdminTransactionMetadata;
}

export interface AdminTransactionMetadata {
  actor?: string;
  reason?: string;
  source?: string;
  traceId?: string;
  tags?: string[];
  attributes?: Record<string, string | number | boolean | null>;
}

export interface AdminMutationPreview {
  objectId: string;
  path: string;
  before: EncodedValue;
  after: EncodedValue;
}

export type AdminObjectRecord = ObjectRecord;
