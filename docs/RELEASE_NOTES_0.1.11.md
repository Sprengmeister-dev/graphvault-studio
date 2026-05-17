# GraphVault Studio 0.1.11 Release Notes

GraphVault Studio 0.1.11 adds first-class support for GraphVault Library 0.2.9 storage constraints.

## What Changed

- Added a Constraint Workbench that reads the persisted `constraints.json` contract from the active store.
- Added `/api/constraints` for automation and admin dashboards.
- Studio mutations and committed GVQL updates now validate persisted constraints before WAL prepare.
- Successful Studio commits refresh `constraints.json` alongside parent and query indexes.
- The demo store now includes realistic required, unique, enum, min, and reference-existence constraints.
- Studio now recommends and tests against `@sprengmeister/graphvault` 0.2.9.

## Why It Matters

Admin edits should not bypass the invariants enforced by the runtime library. With this release, Studio can inspect those invariants and uses them as a commit gate for direct edits and GVQL mutations.
