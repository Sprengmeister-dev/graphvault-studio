import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmbeddedStorage } from "graphvault";
import { StorageAdminClient, startAdminServer } from "../dist/admin.js";

class Workspace {
  constructor(name) {
    this.name = name;
    this.documents = [];
  }
}

class Document {
  constructor(id, title, views = 0) {
    this.id = id;
    this.title = title;
    this.status = "draft";
    this.views = views;
  }
}

const types = [
  { name: "Workspace", ctor: Workspace },
  { name: "Document", ctor: Document },
];

const storageDirectory = await mkdtemp(join(tmpdir(), "graphvault-studio-smoke-"));

try {
  const root = new Workspace("Developer docs");
  root.documents.push(new Document("doc-1", "Storage configuration", 12));
  const review = new Document("doc-2", "Admin review", 24);
  review.status = "published";
  review.archivedAt = "2026-05-10";
  root.documents.push(review);

  const storage = await EmbeddedStorage.start({ storageDirectory, root, types });
  await storage.storeRoot();
  await storage.shutdown();

  const client = new StorageAdminClient({ storageDirectory, allowMutations: true });
  const summary = await client.summary();
  assert.equal(summary.objectCount > 0, true);
  assert.equal(summary.verification.ok, true);

  const rootReference = await client.rootReference();
  assert.equal(typeof rootReference.rootObjectId, "string");

  const results = await client.search("configuration");
  assert.equal(results.length > 0, true);

  const page = await client.listObjectPage({ limit: 5 });
  assert.equal(page.total >= page.items.length, true);

  const gvql = await client.gvql('MATCH (doc:Document) WHERE doc.title CONTAINS "Storage" RETURN doc.id AS id, doc.title AS title');
  assert.equal(gvql.kind, "select");
  assert.deepEqual(gvql.rows, [{ id: "doc-1", title: "Storage configuration" }]);
  assert.equal(gvql.plan.candidateSource, "type-index");
  assert.equal(gvql.plan.returnedRows, 1);

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
  assert.deepEqual(distinctTypeCount.rows, [{ types: 2 }]);

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

  const preview = await client.gvql('MATCH (doc:Document) WHERE doc.id = "doc-2" SET doc.status = "review" RETURN count(*) AS changed', {
    dryRun: true,
  });
  assert.equal(preview.kind, "update");
  assert.equal(preview.dryRun, true);
  assert.equal(preview.changed, 1);
  assert.equal(preview.plan.candidateSource, "property-index");

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

  await assertAdminServer(storageDirectory);
} finally {
  await rm(storageDirectory, { recursive: true, force: true });
}

async function assertAdminServer(storageDirectory) {
  let server;
  try {
    server = await startAdminServer({ storageDirectory, port: 0 });
    const response = await fetch(`${server.url}/api/summary`);
    assert.equal(response.status, 200);
    const apiSummary = await response.json();
    assert.equal(apiSummary.verification.ok, true);
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
  } catch (error) {
    if (error?.code === "EPERM" && process.env.CI !== "true") {
      return;
    }
    throw error;
  } finally {
    await server?.close();
  }
}
