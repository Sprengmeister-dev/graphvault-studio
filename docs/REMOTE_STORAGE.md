# Remote And Custom Storage

### Remote Or Custom Storage

For remote storage, start Studio programmatically and pass the same `storageTarget` adapter your app uses. `storageDirectory` is still required; for remote targets it acts as the key prefix or logical root path inside the target.

```ts
import { S3StorageTarget } from "@sprengmeister/graphvault";
import { startAdminServer } from "@sprengmeister/graphvault-studio";

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
import { startAdminServer } from "@sprengmeister/graphvault-studio";

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
import { startAdminServer } from "@sprengmeister/graphvault-studio";

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

For mutation endpoints, always set `allowMutations: true` and a `mutationConfirmToken`. For exposed or shared environments, also set `authToken`.
