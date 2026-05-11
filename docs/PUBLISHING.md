# Publishing GraphVault Studio

This checklist keeps admin-client releases boring and repeatable.

## Release Discipline

Do not publish every UI fix immediately. Normal Studio polish should stay as regular commits on `main` until a maintainer explicitly asks for a release.

Use this rhythm:

1. Implement one or more changes.
2. Run the relevant local checks and browser verification for UI work.
3. Commit and push to `main`.
4. Keep `package.json` at the latest published version until release preparation starts.
5. Only when a release is requested, bump the package version, update the changelog/release notes, tag the exact commit, and publish once.

This avoids noisy npm patch releases and keeps `npx graphvault-studio` aligned with intentional release milestones instead of every small iteration.

## Preconditions

- `@sprengmeister/graphvault` has already been released.
- `package.json` has the intended `name`, `version`, `repository`, `homepage`, `bugs`, `license`, `engines`, `bin`, `exports`, and `files`.
- `CHANGELOG.md` and `docs/RELEASE_NOTES_0.1.0.md` describe the release.
- `NPM_TOKEN` is configured as a GitHub Actions repository secret for npm publishing.

## Local Release Check

Run these from the repository root:

```bash
npm ci
npm test
npm run demo:store
npm run pack:dry-run
npm run package:smoke
```

`npm test` includes `npm run compat:check`, which verifies that Studio's `@sprengmeister/graphvault` dependency range accepts the runtime version recommended by the current Studio build. If the check warns that the lockfile resolves an older GraphVault Library, publish or install the newer library before a production Studio release.

Inspect the dry-run file list and confirm it contains `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs`, `dist`, `examples`, logo/screenshot assets, and the `graphvault-studio` CLI entry point. `npm run package:smoke` installs the generated tarball into a fresh temporary project, verifies the CLI help output, imports the public programmatic API, creates a real GraphVault store, and exercises search plus bounded subtree loading through the installed package.

## Tagging

Create the release tag only after the local release check passes:

```bash
git tag -a v0.1.0 -m "GraphVault Studio 0.1.0"
git push origin v0.1.0
```

## Publishing

Use the GitHub Actions `Release` workflow with the matching tag input, for example `v0.1.0`.

The workflow checks out the tag, installs with `npm ci`, runs tests, creates the demo store, validates the npm tarball with `npm run pack:dry-run`, performs the fresh-install package smoke test, and publishes with npm provenance.

Only run the release workflow after the tag is intentionally created for a batched release. Do not use it as part of ordinary development or small follow-up fixes.

## Repository Visibility

Recommended GitHub topics:

```text
typescript, admin-ui, database-admin, graph-database, object-graph, storage-browser, gvql, developer-tools
```
