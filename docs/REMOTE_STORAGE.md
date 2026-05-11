# Remote And Custom Storage

### Remote Or Custom Storage

For remote storage, start Studio programmatically and pass the same `storageTarget` adapter your app uses. `storageDirectory` is still required; for remote targets it acts as the key prefix or logical root path inside the target.

```ts
import { S3StorageTarget } from "@sprengmeister/graphvault";
import { startAdminServer } from "graphvault-studio";

await startAdminServer({
  storageDirectory: "prod/app-store",
  storageTarget: new S3StorageTarget({
    bucket: "graphvault-prod",
    prefix: "stores",
    client: s3ClientAdapter,
  }),
  port: 4177,
  authToken: process.env.GRAPHVAULT_ADMIN_TOKEN,
});
```

HTTP-backed storage works the same way:

```ts
import { HttpStorageTarget } from "@sprengmeister/graphvault";
import { startAdminServer } from "graphvault-studio";

await startAdminServer({
  storageDirectory: "main",
  storageTarget: new HttpStorageTarget({
    baseUrl: "https://storage.example.com/graphvault",
    headers: { authorization: `Bearer ${process.env.STORAGE_TOKEN}` },
  }),
  port: 4177,
});
```

SQL-backed storage uses an adapter around your database client:

```ts
import { SqlStorageTarget } from "@sprengmeister/graphvault";
import { startAdminServer } from "graphvault-studio";

await startAdminServer({
  storageDirectory: "main",
  storageTarget: new SqlStorageTarget({
    client: sqlClientAdapter,
    tableName: "graphvault_objects",
    lockTableName: "graphvault_locks",
  }),
  port: 4177,
});
```

For mutation endpoints, always set `allowMutations: true` and a `mutationConfirmToken`. For exposed or shared environments, also set authentication. The legacy `authToken` option grants admin access. Prefer role tokens when several people or tools use Studio:

```ts
await startAdminServer({
  storageDirectory: "main",
  storageTarget,
  allowMutations: true,
  mutationConfirmToken: process.env.GRAPHVAULT_ADMIN_CONFIRM_TOKEN,
  accessTokens: [
    { token: process.env.GRAPHVAULT_VIEWER_TOKEN!, role: "viewer" },
    { token: process.env.GRAPHVAULT_OPERATOR_TOKEN!, role: "operator" },
    { token: process.env.GRAPHVAULT_ADMIN_ROLE_TOKEN!, role: "admin" },
  ],
});
```

- `viewer`: read-only inspection, search, verification, transactions, journal, and GVQL dry-runs.
- `operator`: viewer plus maintenance and backup.
- `admin`: operator plus committed direct edits and GVQL mutations. Admin writes should still use a confirmation token.
