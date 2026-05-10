import { rm } from "node:fs/promises";
import { EmbeddedStorage } from "@sprengmeister/graphvault";

class Workspace {
  constructor(name) {
    this.name = name;
    this.documents = [];
    this.owners = [];
    this.categories = [];
  }
}

class Owner {
  constructor(id, name, region) {
    this.id = id;
    this.name = name;
    this.region = region;
  }
}

class Category {
  constructor(slug, label) {
    this.slug = slug;
    this.label = label;
  }
}

class Document {
  constructor(id, title, owner, category, status, views) {
    this.id = id;
    this.title = title;
    this.owner = owner;
    this.category = category;
    this.status = status;
    this.views = views;
    this.tags = new Set();
    this.related = [];
    this.metrics = { score: views / 100, revisions: Math.max(1, Math.round(views / 30)) };
    this.createdAt = new Date(1_765_000_000_000 + views * 60_000);
  }
}

const storageDirectory = process.argv[2] ?? "./graphvault-studio-demo-store";
await rm(storageDirectory, { recursive: true, force: true });

const root = new Workspace("GraphVault product docs");
root.owners.push(new Owner("owner-platform", "Platform Team", "EU"));
root.owners.push(new Owner("owner-tools", "Developer Tools", "US"));
root.categories.push(new Category("architecture", "Architecture"));
root.categories.push(new Category("operations", "Operations"));
root.categories.push(new Category("admin", "Admin tooling"));

for (let index = 0; index < 36; index++) {
  const owner = root.owners[index % root.owners.length];
  const category = root.categories[index % root.categories.length];
  const status = index % 11 === 0 ? "archived" : index % 5 === 0 ? "review" : "published";
  const document = new Document(`doc-${String(index + 1).padStart(3, "0")}`, `GraphVault guide ${index + 1}`, owner, category, status, 20 + index * 17);
  document.tags.add(index % 2 === 0 ? "typescript" : "storage");
  document.tags.add(category.slug);
  root.documents.push(document);
}

for (let index = 1; index < root.documents.length; index++) {
  root.documents[index].related.push(root.documents[index - 1]);
  if (index > 4 && index % 4 === 0) {
    root.documents[index].related.push(root.documents[index - 4]);
  }
}

const storage = await EmbeddedStorage.start({
  storageDirectory,
  root,
  types: [
    { name: "Workspace", ctor: Workspace },
    { name: "Owner", ctor: Owner },
    { name: "Category", ctor: Category },
    { name: "Document", ctor: Document },
  ],
});

await storage.storeRoot();
await storage.shutdown();

console.log(`Demo store created at ${storageDirectory}`);
console.log("Run: npx graphvault-studio --dir " + storageDirectory + " --port 4177 --allow-mutations --confirm-token confirm");
