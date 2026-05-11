# GraphVault Studio 0.1.0 Release Notes

GraphVault Studio 0.1.0 is the first public graphical admin client for GraphVault object graph stores.

## What Is Included

- Root-first hierarchy browser for object graphs.
- Search across paths, values, ids, types, references, and encoded object data.
- Parent-path lookup from an object back toward the root, including multiple direct parents.
- Paged object browser for large stores.
- Depth-limited subtree API and graph slice view for large stores.
- GVQL console for graph queries and dry-run batch mutation previews.
- Controlled primitive-field editing with confirmation-token safety.
- Verification, maintenance, backup, transaction, journal, graph, type dictionary, and object detail views.
- CLI and programmatic server startup.
- Local filesystem, custom, remote, S3-compatible, HTTP, and SQL-backed storage through GraphVault storage targets.

## Install

```bash
npm install graphvault-studio
```

The package is ready for npm registry publishing with the CLI binary:

```bash
npx graphvault-studio --dir ./data --port 4177
```

## Demo

```bash
npm ci
npm run demo:store
npx graphvault-studio --dir ./graphvault-studio-demo-store --port 4177 --allow-mutations --confirm-token confirm
```

Open `http://127.0.0.1:4177`.

## Recommended GitHub Topics

`typescript`, `admin-ui`, `developer-tools`, `graph-database`, `object-graph`, `storage-browser`, `database-admin`, `gvql`, `local-first`, `nestjs`
