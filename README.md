# GraphVault Studio

GraphVault Studio is the graphical admin client for [GraphVault](https://github.com/Sprengmeister-dev/graphvault-library) stores. It lets you inspect, search, verify, maintain, back up, and carefully edit object graph data without pretending the store is a table database.

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
- graph edge view
- editable primitive fields with preview and confirmation-token safety
- verification, maintenance, backup, transaction and journal views
- optional bearer-token protection

## Install

```bash
npm install graphvault-studio
```

## Run

```bash
npx graphvault-studio --dir ./data --port 4177
```

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

Then open:

```text
http://127.0.0.1:4177
```

## Relationship To GraphVault Library

The storage engine lives in [graphvault-library](https://github.com/Sprengmeister-dev/graphvault-library). Studio is intentionally separate so applications can depend on the lightweight persistence library without bundling an admin UI.
