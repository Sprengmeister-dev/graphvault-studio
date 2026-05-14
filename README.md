# GraphVault Studio

[![CI](https://github.com/Sprengmeister-dev/graphvault-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Sprengmeister-dev/graphvault-studio/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-3c7a52)
![TypeScript](https://img.shields.io/badge/TypeScript-first-315c92)
![License](https://img.shields.io/badge/license-MIT-2f2f2f)

GraphVault Studio is the graphical admin client for [GraphVault](https://github.com/Sprengmeister-dev/graphvault-library) stores. It lets you inspect, search, verify, maintain, back up, and carefully edit object graph data without pretending the store is a table database.

![GraphVault Studio screenshot](./assets/studio-screenshot.png)

```bash
git clone https://github.com/Sprengmeister-dev/graphvault-studio.git
cd graphvault-studio
npm ci
npm run demo:store
npx graphvault-studio --dir ./graphvault-studio-demo-store --port 4177 --allow-mutations --confirm-token confirm
```

Open `http://127.0.0.1:4177` and try the search, hierarchy, parent path, GVQL, verification, and editable-field flows against a real demo object graph.

## Why Not Just Use A Normal Database Admin Tool?

Database admin tools are great when your data is records, rows, documents, or key-value entries. GraphVault stores a live object graph: a root object, nested structures, references, shared children, multiple parents, class metadata, transactions, manifests, and object records. A normal SQL or document browser cannot show that shape honestly.

Studio is useful when you need to answer questions like:

- what object is this reference pointing to?
- how do I get from this object back to the root?
- which parents directly reference this object?
- what did the latest transaction write?
- does the store verify cleanly?
- can I make a small controlled data correction without hand-writing field paths and JSON?

It is deliberately generic. It does not assume customers, orders, tickets, CMS pages, or any other application domain. It works with object paths, values, types, references, transactions, and graph relationships.

## Features

- root-first hierarchy browser
- search across encoded paths and values
- parent path lookup from object to root
- support for objects with multiple direct parents
- paged object browser for large stores
- depth-limited graph/subtree view for large stores and REST-style graph slices
- persistent index administration with status, top indexed keys, configuration, and rebuild support
- GVQL query console for graph queries and batch-update previews
- editable primitive fields with preview and confirmation-token safety
- reads and writes versioned GraphVault object records used by crash-safe 0.2+ stores
- admin mutations use writer locks, WAL prepare/commit records, and fencing-token validation when the installed GraphVault Library supports it
- admin mutations preserve GraphVault's SHA-256 transaction hash chain for audit-oriented stores
- direct edits and committed GVQL updates can attach actor, reason, source, and trace metadata to the transaction record
- operational hardening KPIs and an Operations view for WAL mode, pending WAL recovery, writer lock status, mutation mode, and latest transaction
- production safety score with concrete warnings for WAL, stale-lock recovery, verification, and transaction hash-chain readiness
- visible GraphVault Library compatibility status, including warnings for older runtime packages
- verification, maintenance, backup, transaction and journal views
- optional bearer-token protection with viewer, operator, and admin roles
- zero frontend build step; the UI is embedded in the TypeScript package

## Install

From npm:

```bash
npm install graphvault-studio
```

GraphVault Studio requires Node.js 20 or newer. The npm package is scoped, but the executable remains the short `graphvault-studio` command.

## Run

### Demo Store

Create a realistic demo store with shared owners, categories, document links, tags, dates, metrics, and multiple parent paths:

```bash
npm run demo:store
npx graphvault-studio --dir ./graphvault-studio-demo-store --port 4177 --allow-mutations --confirm-token confirm
```

### File-Based Store

The CLI reads a local GraphVault storage directory. This is the common setup for a service, desktop app, or local development environment.

```bash
npx graphvault-studio --dir ./data --port 4177
```

Run a non-interactive health check without opening the web UI:

```bash
npx graphvault-studio --dir ./data --doctor
```

For CI, deployment checks, or monitoring jobs, use JSON output:

```bash
npx graphvault-studio --dir ./data --doctor --json
```

The doctor command verifies the store, evaluates the production safety profile, and exits with code `2` if verification fails or the store is classified as unsafe.

Mutation APIs are opt-in:

```bash
npx graphvault-studio \
  --dir ./data \
  --port 4177 \
  --allow-mutations \
  --confirm-token confirm
```

Optional auth:

```bash
GRAPHVAULT_ADMIN_TOKEN=secret npx graphvault-studio --dir ./data
```

Role-based tokens:

```bash
npx graphvault-studio \
  --dir ./data \
  --viewer-token view-secret \
  --operator-token ops-secret \
  --admin-token admin-secret \
  --allow-mutations \
  --confirm-token confirm
```

- viewer: read-only API and UI access.
- operator: viewer access plus maintenance and backup endpoints.
- admin: full access, including committed direct edits and GVQL mutations.

For critical stores, run Studio with mutations behind authentication and a confirmation token:

```bash
GRAPHVAULT_ADMIN_ROLE_TOKEN=secret npx graphvault-studio \
  --dir ./data \
  --allow-mutations \
  --confirm-token "$(openssl rand -hex 16)"
```

Studio mutation commits are written through the same storage-level safety shape expected from GraphVault deployments: writer lock, WAL prepare, data write, WAL commit marker, transaction journal, parent index, current pointer, and manifest publish as the final visibility step. With GraphVault Library 0.2 or newer, fencing tokens prevent stale recovered writers from publishing or releasing newer locks.

Then open:

```text
http://127.0.0.1:4177
```

## Documentation

- [GVQL examples](./docs/GVQL.md) - ready-to-run query and mutation-preview examples for Studio.
- [Remote and custom storage](./docs/REMOTE_STORAGE.md) - programmatic server setup with HTTP, S3-compatible, SQL, or custom targets.
- [Release notes](./docs/RELEASE_NOTES_0.1.0.md) - package overview for the first public release.
- [Publishing checklist](./docs/PUBLISHING.md) - local release checks, tagging, npm provenance, and GitHub topics.

## Relationship To GraphVault Library

The storage engine lives in [graphvault-library](https://github.com/Sprengmeister-dev/graphvault-library). Studio is intentionally separate so applications can depend on the lightweight persistence library without bundling an admin UI.

## Developer Notes

- Studio is a pure TypeScript package with no frontend build toolchain.
- The UI is served from the embedded admin server, so `npx graphvault-studio --dir ./data` is enough to inspect a store.
- The HTTP API exposes bounded graph slices through `/api/subtree?depth=2` and `/api/objects/:id/subtree?depth=2`, which is useful when you want to preview what an external REST endpoint would return.
- The Overview API and UI report the installed GraphVault Library version and warn when it is older than the recommended runtime for the current Studio build.
- The package depends on GraphVault Library for storage layout, verification, parent index reading, and storage targets.
- Run `npm test` to type-check, emit `dist/`, create a real store, exercise the admin client, and verify the embedded HTTP API.
- Run `npm run package:smoke` before publishing to install the generated tarball into a fresh temporary project and verify the CLI plus public programmatic API as a consumer would use them.
- CI runs on Node.js 20 and 22.
