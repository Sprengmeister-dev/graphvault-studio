import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmbeddedStorage } from "@sprengmeister/graphvault";
import { StorageAdminClient, startAdminServer } from "../dist/admin.js";
import { parseAdminCliArgs } from "../dist/admin-cli.js";

class Workspace {
  constructor(name) {
    this.name = name;
    this.documents = [];
  }
}

class Owner {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
}

class Document {
  constructor(id, title, owner, views = 0) {
    this.id = id;
    this.title = title;
    this.owner = owner;
    this.status = "draft";
    this.views = views;
  }
}

const types = [
  { name: "Workspace", ctor: Workspace },
  { name: "Owner", ctor: Owner },
  { name: "Document", ctor: Document },
];

const storageDirectory = await mkdtemp(join(tmpdir(), "graphvault-studio-smoke-"));

try {
  const root = new Workspace("Developer docs");
  const owner = new Owner("owner-1", "Platform Team");
  root.documents.push(new Document("doc-1", "Storage configuration", owner, 12));
  const review = new Document("doc-2", "Admin review", owner, 24);
  review.status = "published";
  review.archivedAt = "2026-05-10";
  root.documents.push(review);
  root.documents[0].related = [review];

  const storage = await EmbeddedStorage.start({ storageDirectory, root, types });
  await storage.storeRoot();
  await storage.shutdown();
  await convertStoreToVersionedObjectRecords(storageDirectory);

  const client = new StorageAdminClient({ storageDirectory, allowMutations: true });
  const summary = await client.summary();
  assert.equal(summary.objectCount > 0, true);
  assert.equal(summary.verification.ok, true);
  assert.equal(summary.hardening.transactionLog, "full");
  assert.equal(summary.hardening.writerLock, "enabled");
  assert.equal(summary.operations.transactionLog, "full");
  assert.equal(summary.operations.status, "healthy");
  assert.equal(summary.operations.pendingWalCommits, 0);
  assert.equal(summary.library.packageName, "@sprengmeister/graphvault");
  assert.equal(typeof summary.library.recommendedVersion, "string");
  assert.equal(["ok", "warning"].includes(summary.library.status), true);
  assert.equal(summary.productionSafety.status, "warning");
  assert.equal(summary.productionSafety.hashChain, "missing");
  assert.equal(summary.productionSafety.issues.some((issue) => issue.code === "stale-lock-recovery-disabled"), true);
  assert.equal(summary.productionSafety.issues.some((issue) => issue.code === "hash-chain-missing"), true);

  const rootReference = await client.rootReference();
  assert.equal(typeof rootReference.rootObjectId, "string");

  const rootOnlySubtree = await client.subtree({ rootObjectId: rootReference.rootObjectId, depth: 0 });
  assert.equal(rootOnlySubtree.depth, 0);
  assert.equal(rootOnlySubtree.objectIds.length, 1);
  assert.equal(rootOnlySubtree.complete, false);
  assert.equal(rootOnlySubtree.truncatedReferences.some((reference) => reference.path === "documents"), true);
  assert.equal(Object.keys(rootOnlySubtree.envelope.nodes).length, 1);

  const rootSlice = await client.subtree({ depth: 1 });
  assert.equal(rootSlice.rootObjectId, rootReference.rootObjectId);
  assert.equal(rootSlice.objectIds.length > rootOnlySubtree.objectIds.length, true);
  assert.equal(rootSlice.edges.some((edge) => edge.from === rootReference.rootObjectId), true);
  await assert.rejects(() => client.subtree({ rootObjectId: "missing", depth: 1 }), /not present in the current manifest/);

  const results = await client.search("configuration");
  assert.equal(results.length > 0, true);

  const page = await client.listObjectPage({ limit: 5 });
  assert.equal(page.total >= page.items.length, true);

  const gvql = await client.gvql('MATCH (doc:Document) WHERE doc.title CONTAINS "Storage" RETURN doc.id AS id, doc.title AS title');
  assert.equal(gvql.kind, "select");
  assert.deepEqual(gvql.rows, [{ id: "doc-1", title: "Storage configuration" }]);
  assert.equal(gvql.plan.candidateSource, "type-index");
  assert.equal(gvql.plan.returnedRows, 1);

  const multiMatch = await client.gvql(`
    MATCH (workspace:Workspace)-[:documents]->(items)-[:*]->(doc:Document), (doc)-[:owner]->(owner:Owner)
    WHERE workspace.name = "Developer docs" AND owner.name = "Platform Team"
    RETURN workspace.name AS workspace, doc.id AS id, owner.name AS owner
    ORDER BY doc.id ASC
  `);
  assert.equal(multiMatch.kind, "select");
  assert.deepEqual(multiMatch.rows, [
    { workspace: "Developer docs", id: "doc-1", owner: "Platform Team" },
    { workspace: "Developer docs", id: "doc-2", owner: "Platform Team" },
  ]);
  assert.equal(multiMatch.statement.matches.length, 2);
  assert.equal(multiMatch.plan.operations.includes("multi-match:2"), true);

  const optionalMatch = await client.gvql(`
    MATCH (doc:Document)
    OPTIONAL MATCH (doc)-[:related]->(items)-[:*]->(related:Document)
    RETURN doc.id AS id, related.id AS relatedId
    ORDER BY doc.id ASC
  `);
  assert.equal(optionalMatch.kind, "select");
  assert.deepEqual(optionalMatch.rows, [
    { id: "doc-1", relatedId: "doc-2" },
    { id: "doc-2", relatedId: undefined },
  ]);
  assert.equal(optionalMatch.statement.optionalMatches.length, 1);
  assert.equal(optionalMatch.plan.operations.includes("optional-match:doc"), true);

  const scalarFunctions = await client.gvql(
    `
      MATCH (doc:Document)
      WHERE lower(doc.title) CONTAINS lower($needle)
      RETURN doc.id AS id, upper(trim(doc.title)) AS title, length(doc.title) AS titleLength, coalesce(doc.archivedAt, "none") AS archived
    `,
    { parameters: { needle: "storage" } },
  );
  assert.equal(scalarFunctions.kind, "select");
  assert.deepEqual(scalarFunctions.rows, [
    {
      id: "doc-1",
      title: "STORAGE CONFIGURATION",
      titleLength: "Storage configuration".length,
      archived: "none",
    },
  ]);

  const paged = await client.gvql("MATCH (doc:Document) RETURN doc.id AS id ORDER BY doc.id ASC LIMIT 1 OFFSET 1");
  assert.equal(paged.kind, "select");
  assert.deepEqual(paged.rows, [{ id: "doc-2" }]);
  assert.equal(paged.plan.offset, 1);

  const metadata = await client.gvql("MATCH (doc:Document) RETURN doc.$id AS objectId, doc.$type AS type, doc.$kind AS kind ORDER BY doc.$id ASC LIMIT 1");
  assert.equal(metadata.kind, "select");
  assert.equal(typeof metadata.rows[0].objectId, "string");
  assert.equal(metadata.rows[0].type, "Document");
  assert.equal(metadata.rows[0].kind, "object");

  const metadataTypeIndex = await client.gvql('MATCH (node) WHERE node.$type IN ["Document"] RETURN count(*) AS count');
  assert.equal(metadataTypeIndex.kind, "select");
  assert.deepEqual(metadataTypeIndex.rows, [{ count: 2 }]);
  assert.equal(metadataTypeIndex.plan.candidateSource, "type-index");

  const distinct = await client.gvql("MATCH (doc:Document) RETURN DISTINCT doc.status AS status ORDER BY status ASC");
  assert.equal(distinct.kind, "select");
  assert.deepEqual(distinct.rows, [{ status: "draft" }, { status: "published" }]);
  assert.equal(distinct.plan.distinct, true);

  const distinctTypeCount = await client.gvql("MATCH (node) WHERE node.$type IS NOT NULL RETURN count(DISTINCT node.$type) AS types");
  assert.equal(distinctTypeCount.kind, "select");
  assert.deepEqual(distinctTypeCount.rows, [{ types: 3 }]);

  const nullFilter = await client.gvql("MATCH (doc:Document) WHERE doc.archivedAt IS NULL AND doc.status IS NOT NULL RETURN doc.id AS id ORDER BY doc.id ASC");
  assert.equal(nullFilter.kind, "select");
  assert.deepEqual(nullFilter.rows, [{ id: "doc-1" }]);

  const multiIndex = await client.gvql('MATCH (doc:Document) WHERE doc.status = "published" AND doc.id = "doc-2" RETURN doc.id AS id');
  assert.equal(multiIndex.kind, "select");
  assert.deepEqual(multiIndex.rows, [{ id: "doc-2" }]);
  assert.equal(multiIndex.plan.propertyIndexes.length, 2);

  const indexedIn = await client.gvql(
    'MATCH (doc:Document) WHERE doc.status IN ["draft", "published"] AND doc.id IN ["doc-1", "doc-2"] RETURN doc.id AS id ORDER BY doc.id ASC',
  );
  assert.equal(indexedIn.kind, "select");
  assert.deepEqual(indexedIn.rows, [{ id: "doc-1" }, { id: "doc-2" }]);
  assert.equal(indexedIn.plan.candidateSource, "property-index");
  assert.equal(indexedIn.plan.operations.includes("property-index-union:status:2"), true);
  assert.equal(indexedIn.plan.operations.includes("property-index-union:id:2"), true);

  const indexedOr = await client.gvql('MATCH (doc:Document) WHERE doc.id = "missing" OR doc.status = "published" RETURN doc.id AS id, doc.status AS status');
  assert.equal(indexedOr.kind, "select");
  assert.deepEqual(indexedOr.rows, [{ id: "doc-2", status: "published" }]);
  assert.equal(indexedOr.plan.candidateSource, "property-index");
  assert.equal(indexedOr.plan.operations.includes("index-or-union:2"), true);

  const parenthesizedWhere = await client.gvql(
    'MATCH (doc:Document) WHERE (doc.id = "doc-1" OR doc.status = "published") AND doc.views > 20 RETURN doc.id AS id ORDER BY doc.id ASC',
  );
  assert.equal(parenthesizedWhere.kind, "select");
  assert.deepEqual(parenthesizedWhere.rows, [{ id: "doc-2" }]);

  const notWhere = await client.gvql('MATCH (doc:Document) WHERE NOT (doc.status = "published" OR doc.views < 10) RETURN doc.id AS id');
  assert.equal(notWhere.kind, "select");
  assert.deepEqual(notWhere.rows, [{ id: "doc-1" }]);

  const computedReturn = await client.gvql("MATCH (doc:Document) RETURN doc.id AS id, (doc.views + $bonus) * 2 AS score ORDER BY score DESC LIMIT 1", {
    parameters: { bonus: 3 },
  });
  assert.equal(computedReturn.kind, "select");
  assert.deepEqual(computedReturn.rows, [{ id: "doc-2", score: 54 }]);

  const multiOrder = await client.gvql("MATCH (doc:Document) RETURN doc.status AS status, count(*) AS count GROUP BY doc.status ORDER BY count DESC, status ASC");
  assert.equal(multiOrder.kind, "select");
  assert.deepEqual(multiOrder.rows, [
    { status: "draft", count: 1 },
    { status: "published", count: 1 },
  ]);

  const aggregate = await client.gvql(
    `
      MATCH (doc:Document)
      RETURN doc.status AS status, count(*) AS count, sum(doc.views) AS total
      GROUP BY doc.status
      HAVING count >= $minimum
      ORDER BY total DESC
    `,
    { parameters: { minimum: 1 } },
  );
  assert.equal(aggregate.kind, "select");
  assert.deepEqual(aggregate.rows, [
    { status: "published", count: 1, total: 24 },
    { status: "draft", count: 1, total: 12 },
  ]);
  assert.equal(aggregate.plan.grouped, true);
  assert.equal(aggregate.plan.having, true);

  const parenthesizedHaving = await client.gvql(
    `
      MATCH (doc:Document)
      RETURN doc.status AS status, count(*) AS count, avg(doc.views) AS avgViews
      GROUP BY doc.status
      HAVING (status = "draft" OR status = "published") AND avgViews > 20
      ORDER BY status ASC
    `,
  );
  assert.equal(parenthesizedHaving.kind, "select");
  assert.deepEqual(parenthesizedHaving.rows, [{ status: "published", count: 1, avgViews: 24 }]);

  const notHaving = await client.gvql(
    `
      MATCH (doc:Document)
      RETURN doc.status AS status, count(*) AS count, avg(doc.views) AS avgViews
      GROUP BY doc.status
      HAVING NOT (status = "published" OR avgViews < 10)
      ORDER BY status ASC
    `,
  );
  assert.equal(notHaving.kind, "select");
  assert.deepEqual(notHaving.rows, [{ status: "draft", count: 1, avgViews: 12 }]);

  const preview = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" SET doc.status = "review" RETURN count(*) AS changed', {
    dryRun: true,
  });
  assert.equal(preview.kind, "update");
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, 1);
  assert.equal(preview.plan.candidateSource, "property-index");

  const arithmeticPreview = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" SET doc.views = (doc.views + $increment) * 2 RETURN doc.id AS id, doc.views AS views', {
    dryRun: true,
    parameters: { increment: 3 },
  });
  assert.equal(arithmeticPreview.kind, "update");
  assert.equal(arithmeticPreview.dryRun, true);
  assert.equal(arithmeticPreview.changed, 1);
  assert.equal(arithmeticPreview.changes[0].before, 24);
  assert.equal(arithmeticPreview.changes[0].after, 54);

  const removePreview = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" REMOVE doc.archivedAt RETURN count(*) AS changed', {
    dryRun: true,
  });
  assert.equal(removePreview.kind, "update");
  assert.equal(removePreview.dryRun, true);
  assert.equal(removePreview.changed, 1);
  assert.equal(removePreview.changes[0].before, "2026-05-10");

  const remove = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" REMOVE doc.archivedAt RETURN count(*) AS changed');
  assert.equal(remove.kind, "update");
  assert.equal(remove.changed, 1);

  const removedField = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" AND doc.archivedAt IS NULL RETURN doc.id AS id');
  assert.equal(removedField.kind, "select");
  assert.deepEqual(removedField.rows, [{ id: "doc-2" }]);

  const deletePreview = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" DELETE doc RETURN doc.id AS id', {
    dryRun: true,
  });
  assert.equal(deletePreview.kind, "update");
  assert.equal(deletePreview.dryRun, true);
  assert.deepEqual(deletePreview.rows, [{ id: "doc-2" }]);
  assert.equal(deletePreview.changes.some((change) => change.operation === "delete" && change.alias === "doc"), true);

  const deleted = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" DELETE doc RETURN doc.id AS id');
  assert.equal(deleted.kind, "update");
  assert.deepEqual(deleted.rows, [{ id: "doc-2" }]);

  const deletedField = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" RETURN doc.id AS id');
  assert.equal(deletedField.kind, "select");
  assert.deepEqual(deletedField.rows, []);

  const createPreview = await client.gvql(
    `
      MATCH (workspace:Workspace)
      WHERE workspace.name = "Developer docs"
      CREATE (doc:Document { id: "doc-3", title: "Release checklist", status: "draft", views: $views }) INTO workspace.documents
      RETURN doc.id AS id, doc.title AS title
    `,
    { dryRun: true, parameters: { views: 9 } },
  );
  assert.equal(createPreview.kind, "update");
  assert.equal(createPreview.dryRun, true);
  assert.deepEqual(createPreview.rows, [{ id: "doc-3", title: "Release checklist" }]);
  assert.equal(createPreview.changes.some((change) => change.operation === "create" && change.alias === "doc"), true);
  assert.equal(createPreview.changes.some((change) => change.operation === "attach" && change.path === "documents"), true);

  const created = await client.gvql(
    `
      MATCH (workspace:Workspace)
      WHERE workspace.name = "Developer docs"
      CREATE (doc:Document { id: "doc-3", title: "Release checklist", status: "draft", views: $views }) INTO workspace.documents
      RETURN doc.id AS id, doc.views AS views
    `,
    { parameters: { views: 9 } },
  );
  assert.equal(created.kind, "update");
  assert.deepEqual(created.rows, [{ id: "doc-3", views: 9 }]);

  const createdField = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-3" RETURN doc.title AS title, doc.views AS views');
  assert.equal(createdField.kind, "select");
  assert.deepEqual(createdField.rows, [{ title: "Release checklist", views: 9 }]);
  const walFiles = await readdir(join(storageDirectory, "wal"));
  assert.equal(walFiles.some((file) => file.endsWith(".prepare.json")), true);
  assert.equal(walFiles.some((file) => file.endsWith(".commit.json")), true);

  const mutationPreview = await client.previewMutation({ objectId: rootReference.rootObjectId, path: "name", value: "Developer docs" });
  assert.equal(mutationPreview.before, "Developer docs");
  const mutationRecord = await client.mutate({
    objectId: rootReference.rootObjectId,
    path: "name",
    value: "Developer docs",
    metadata: { actor: "admin@example.com", reason: "smoke test direct edit", source: "studio-smoke" },
  });
  assert.equal(typeof mutationRecord.transactionId, "number");
  assert.equal(mutationRecord.metadata.actor, "admin@example.com");
  assert.equal(mutationRecord.metadata.reason, "smoke test direct edit");
  assert.equal(typeof mutationRecord.envelopeHash, "string");
  assert.equal(typeof mutationRecord.transactionHash, "string");
  const postMutationManifest = JSON.parse(await readFile(join(storageDirectory, "manifest.json"), "utf8"));
  assert.equal(postMutationManifest.objectVersions[rootReference.rootObjectId], mutationRecord.transactionId);
  assert.equal(postMutationManifest.latestTransactionHash, mutationRecord.transactionHash);
  await readdir(join(storageDirectory, "objects-bin")).then((files) =>
    assert.equal(files.includes(`${rootReference.rootObjectId}.${mutationRecord.transactionId}.bin`), true),
  );
  const mutatedRootName = await client.gvql("MATCH (workspace:Workspace) RETURN workspace.name AS name");
  assert.deepEqual(mutatedRootName.rows, [{ name: "Developer docs" }]);
  const maintenance = await client.maintain({ keepSnapshots: 2 });
  assert.equal(maintenance.verification.ok, true);
  assert.equal(maintenance.verification.checkedIntegrityHashes > 0, true);
  const afterMaintenanceRootName = await client.gvql("MATCH (workspace:Workspace) RETURN workspace.name AS name");
  assert.deepEqual(afterMaintenanceRootName.rows, [{ name: "Developer docs" }]);

  const mergeExistingPreview = await client.gvql(
    `
      MATCH (workspace:Workspace)
      WHERE workspace.name = "Developer docs"
      MERGE (doc:Document { id: "doc-3", title: "Duplicate should not be created", status: "draft", views: 99 }) INTO workspace.documents ON doc.id
      RETURN doc.id AS id, doc.title AS title, doc.views AS views
    `,
    { dryRun: true },
  );
  assert.equal(mergeExistingPreview.kind, "update");
  assert.equal(mergeExistingPreview.changed, 0);
  assert.deepEqual(mergeExistingPreview.rows, [{ id: "doc-3", title: "Release checklist", views: 9 }]);

  const mergeNewPreview = await client.gvql(
    `
      MATCH (workspace:Workspace)
      WHERE workspace.name = "Developer docs"
      MERGE (doc:Document { id: "doc-4", title: "Idempotent import", status: "draft", views: 1 }) INTO workspace.documents ON doc.id
      RETURN doc.id AS id, doc.title AS title
    `,
    { dryRun: true },
  );
  assert.equal(mergeNewPreview.kind, "update");
  assert.deepEqual(mergeNewPreview.rows, [{ id: "doc-4", title: "Idempotent import" }]);
  assert.equal(mergeNewPreview.changes.some((change) => change.operation === "merge" && change.alias === "doc"), true);

  await assertAdminServer(storageDirectory);
  await assertAdminServerRbac(storageDirectory);
  assert.deepEqual(
    parseAdminCliArgs(["--dir", "data", "--viewer-token", "v", "--operator-token", "o", "--admin-token", "a"]).viewerToken,
    "v",
  );
} finally {
  await rm(storageDirectory, { recursive: true, force: true });
}

async function convertStoreToVersionedObjectRecords(storageDirectory) {
  const manifestPath = join(storageDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.objectVersions = {};
  for (const objectId of manifest.objectIds) {
    manifest.objectVersions[objectId] = manifest.transactionId;
    await copyFile(join(storageDirectory, "objects-bin", `${objectId}.bin`), join(storageDirectory, "objects-bin", `${objectId}.${manifest.transactionId}.bin`));
    await copyFile(join(storageDirectory, "objects", `${objectId}.json`), join(storageDirectory, "objects", `${objectId}.${manifest.transactionId}.json`));
    await rm(join(storageDirectory, "objects-bin", `${objectId}.bin`), { force: true });
    await rm(join(storageDirectory, "objects", `${objectId}.json`), { force: true });
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function assertAdminServer(storageDirectory) {
  let server;
  try {
    server = await startAdminServer({ storageDirectory, port: 0 });
    const response = await fetch(`${server.url}/api/summary`);
    assert.equal(response.status, 200);
    const apiSummary = await response.json();
    assert.equal(apiSummary.verification.ok, true);
    assert.equal(apiSummary.hardening.writerLock, "enabled");
    assert.equal(apiSummary.operations.status, "healthy");
    assert.equal(apiSummary.library.packageName, "@sprengmeister/graphvault");
    assert.equal(["production-ready", "warning", "unsafe"].includes(apiSummary.productionSafety.status), true);
    const rootResponse = await fetch(`${server.url}/api/root`);
    assert.equal(rootResponse.status, 200);
    const apiRoot = await rootResponse.json();
    const subtreeResponse = await fetch(`${server.url}/api/subtree?depth=0`);
    assert.equal(subtreeResponse.status, 200);
    const apiSubtree = await subtreeResponse.json();
    assert.equal(apiSubtree.objectIds.length, 1);
    assert.equal(apiSubtree.complete, false);
    const objectSubtreeResponse = await fetch(`${server.url}/api/objects/${encodeURIComponent(apiRoot.rootObjectId)}/subtree?depth=1`);
    assert.equal(objectSubtreeResponse.status, 200);
    const apiObjectSubtree = await objectSubtreeResponse.json();
    assert.equal(apiObjectSubtree.rootObjectId, apiRoot.rootObjectId);
    assert.equal(apiObjectSubtree.objectIds.length > 1, true);
    const operationsResponse = await fetch(`${server.url}/api/operations`);
    assert.equal(operationsResponse.status, 200);
    const operations = await operationsResponse.json();
    assert.equal(operations.pendingWalCommits, 0);
    const uiResponse = await fetch(server.url);
    assert.equal(uiResponse.status, 200);
    const html = await uiResponse.text();
    assert.equal(html.includes("Storage operations"), true);
    assert.equal(html.includes("production safety"), true);
    assert.equal(html.includes("Expandable lazy tree"), true);
    assert.equal(html.includes("hierarchyExpanded"), true);
    assert.equal(html.includes("Library"), true);
    assert.equal(html.includes("graphRoot"), true);
    assert.equal(html.includes("Load Graph Slice"), true);
    assert.equal(html.includes('id="gvqlExamples"'), true);
    assert.equal(html.includes("Scalar functions"), true);
    assert.equal(html.includes("CASE update"), true);
    assert.equal(html.includes("WITH pipeline"), true);
    assert.equal(html.includes("MERGE into collection"), true);
    assert.equal(html.includes("gvqlParameterEditor"), true);
    const gvqlResponse = await fetch(`${server.url}/api/gvql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "MATCH (doc:Document) RETURN doc.status AS status, count(*) AS count GROUP BY doc.status HAVING count >= 1 ORDER BY count DESC LIMIT 1 OFFSET 0",
        dryRun: true,
      }),
    });
    assert.equal(gvqlResponse.status, 200);
    const apiGvql = await gvqlResponse.json();
    assert.equal(apiGvql.kind, "select");
    assert.equal(apiGvql.plan.grouped, true);
    const withResponse = await fetch(`${server.url}/api/gvql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "MATCH (doc:Document) WITH doc.status AS status, count(*) AS count GROUP BY doc.status HAVING count >= 1 RETURN status, count ORDER BY count DESC",
        dryRun: true,
      }),
    });
    assert.equal(withResponse.status, 200);
    const apiWith = await withResponse.json();
    assert.equal(apiWith.kind, "select");
    assert.equal(apiWith.plan.operations.includes("with-project"), true);
    const mergeResponse = await fetch(`${server.url}/api/gvql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: 'MATCH (workspace:Workspace) WHERE workspace.name = "Developer docs" MERGE (doc:Document { id: "doc-3", title: "Duplicate", status: "draft", views: 99 }) INTO workspace.documents ON doc.id RETURN doc.id AS id, doc.title AS title',
        dryRun: true,
      }),
    });
    assert.equal(mergeResponse.status, 200);
    const apiMerge = await mergeResponse.json();
    assert.equal(apiMerge.kind, "update");
    assert.equal(apiMerge.changed, 0);
  } catch (error) {
    if (error?.code === "EPERM" && process.env.CI !== "true") {
      return;
    }
    throw error;
  } finally {
    await server?.close();
  }
}

async function assertAdminServerRbac(storageDirectory) {
  let server;
  const backupDirectory = await mkdtemp(join(tmpdir(), "graphvault-studio-rbac-backup-"));
  try {
    server = await startAdminServer({
      storageDirectory,
      port: 0,
      allowMutations: true,
      mutationConfirmToken: "confirm",
      accessTokens: [
        { token: "viewer", role: "viewer" },
        { token: "operator", role: "operator" },
        { token: "admin", role: "admin" },
      ],
    });
    assert.equal((await fetch(`${server.url}/api/summary`)).status, 401);
    const viewerSummary = await fetch(`${server.url}/api/summary?verify=false`, {
      headers: { authorization: "Bearer viewer" },
    });
    assert.equal(viewerSummary.status, 200);
    const viewerMaintenance = await fetch(`${server.url}/api/maintenance`, {
      method: "POST",
      headers: { authorization: "Bearer viewer", "content-type": "application/json" },
      body: JSON.stringify({ keepSnapshots: 2 }),
    });
    assert.equal(viewerMaintenance.status, 403);
    const operatorBackup = await fetch(`${server.url}/api/backup`, {
      method: "POST",
      headers: { authorization: "Bearer operator", "content-type": "application/json" },
      body: JSON.stringify({ storageDirectory: backupDirectory }),
    });
    assert.equal(operatorBackup.status, 200);
    const viewerCommit = await fetch(`${server.url}/api/gvql`, {
      method: "POST",
      headers: { authorization: "Bearer viewer", "content-type": "application/json" },
      body: JSON.stringify({
        query: 'MATCH (workspace:Workspace) SET workspace.name = "Blocked" RETURN workspace.name AS name',
        confirmToken: "confirm",
      }),
    });
    assert.equal(viewerCommit.status, 403);
    const adminCommit = await fetch(`${server.url}/api/gvql`, {
      method: "POST",
      headers: { authorization: "Bearer admin", "content-type": "application/json" },
      body: JSON.stringify({
        query: 'MATCH (workspace:Workspace) SET workspace.name = "Developer docs" RETURN workspace.name AS name',
        confirmToken: "confirm",
        metadata: { actor: "rbac-admin", reason: "smoke-test" },
      }),
    });
    assert.equal(adminCommit.status, 200);
  } catch (error) {
    if (error?.code === "EPERM" && process.env.CI !== "true") {
      return;
    }
    throw error;
  } finally {
    await server?.close();
    await rm(backupDirectory, { recursive: true, force: true });
  }
}
