# Contributing

Thanks for helping improve GraphVault Studio.

## Local Development

```bash
npm ci
npm test
```

`npm test` builds the TypeScript sources and runs a smoke test against a generated GraphVault store. It verifies the admin client, search, store verification, and the embedded HTTP API.

## Pull Request Checklist

- keep admin modules focused and avoid growing one large UI or server file unnecessarily
- preserve generic object graph wording rather than app-specific language
- check narrow and wide layouts when changing the embedded UI
- add or update a smoke test when API behavior changes
- run `npm test` before opening the PR

## Release Checklist

1. Update `CHANGELOG.md`.
2. Run `npm test`.
3. Run `npm run pack:dry-run` and inspect the packaged files.
4. Publish with an npm account that owns `@sprengmeister/graphvault-studio`.
