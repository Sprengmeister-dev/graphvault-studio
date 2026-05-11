# Changelog

## 0.1.2

- Publish the Studio CLI under the unscoped `graphvault-studio` npm package name for a reliable `npx graphvault-studio` install path.
- Add WAL-backed admin mutation commits with writer-lock protection and optional fencing-token validation.
- Add operational hardening information to the summary API, Studio KPI bar, `/api/operations`, and a dedicated Operations view.
- Publish `manifest.json` last for Studio mutation commits so late metadata failures remain recoverable instead of partially visible.

## 0.1.1

- Patch npm package metadata so the `graphvault-studio` CLI binary is preserved on publish.

## 0.1.0

- Initial GraphVault Studio package.
- Embedded graphical admin client for GraphVault stores.
- Root hierarchy browser, parent path lookup, search, graph view, paged object listing, verification, backup, maintenance, transactions, and journal views.
- Controlled primitive-field editing with mutation preview and optional confirmation token.
- CLI and programmatic server startup.
