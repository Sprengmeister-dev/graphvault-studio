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
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.status = "draft";
  }
}

const types = [
  { name: "Workspace", ctor: Workspace },
  { name: "Document", ctor: Document },
];

const storageDirectory = await mkdtemp(join(tmpdir(), "graphvault-studio-smoke-"));

try {
  const root = new Workspace("Developer docs");
  root.documents.push(new Document("doc-1", "Storage configuration"));
  root.documents.push(new Document("doc-2", "Admin review"));

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
  } catch (error) {
    if (error?.code === "EPERM" && process.env.CI !== "true") {
      return;
    }
    throw error;
  } finally {
    await server?.close();
  }
}
