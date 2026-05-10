# GraphVault Studio GVQL Examples

## GVQL

Studio includes a GVQL console for GraphVault stores. It supports read queries and safe batch-update previews:

```sql
MATCH (node)
RETURN node.$id AS objectId, node.$type AS type, node.$kind AS kind
ORDER BY node.$id ASC
LIMIT 25
OFFSET 0
```

```sql
MATCH (node)
WHERE node.$type IN ["Document", "Workspace"]
RETURN node.$id AS objectId, node.$type AS type
ORDER BY node.$type ASC, node.$id ASC
```

```sql
MATCH (doc:Document)-[:owner]->(owner:Owner)
WHERE owner.name = "Platform Team"
RETURN doc.id AS id, doc.title AS title
ORDER BY doc.title ASC, doc.id ASC
LIMIT 25
OFFSET 0
```

```sql
MATCH (doc:Document)-[:owner]->(owner:Owner), (doc)-[:category]->(category:Category)
WHERE owner.name = "Platform Team" AND category.slug = "guides"
RETURN doc.id AS id, doc.title AS title, category.label AS category
ORDER BY doc.title ASC
LIMIT 25
```

```sql
MATCH (doc:Document)
OPTIONAL MATCH (doc)-[:related]->(items)-[:*]->(related:Document)
RETURN doc.id AS id, related.id AS relatedId
ORDER BY doc.id ASC
LIMIT 25
```

```sql
MATCH (doc:Document)
WHERE lower(doc.title) CONTAINS lower($needle)
RETURN doc.id AS id, upper(trim(doc.title)) AS title, length(doc.title) AS titleLength, coalesce(doc.archivedAt, "none") AS archived
ORDER BY doc.id ASC
```

```sql
MATCH (doc:Document)
RETURN DISTINCT doc.status AS status
ORDER BY status ASC
```

```sql
MATCH (node)
WHERE node.$type IS NOT NULL
RETURN count(DISTINCT node.$type) AS types
```

```sql
MATCH (doc:Document)
WHERE doc.archivedAt IS NULL AND doc.status IS NOT NULL
RETURN doc.id AS id, doc.title AS title
ORDER BY doc.id ASC
```

```sql
MATCH (doc:Document)
WHERE doc.status IN ["draft", "published"] AND doc.id IN ["doc-1", "doc-2"]
RETURN doc.id AS id, doc.status AS status
ORDER BY doc.id ASC
```

```sql
MATCH (doc:Document)
WHERE doc.id = "missing" OR doc.status = "published"
RETURN doc.id AS id, doc.status AS status
```

```sql
MATCH (doc:Document)
WHERE (doc.status = "draft" OR doc.status = "published") AND doc.views > 20
RETURN doc.id AS id, doc.status AS status, doc.views AS views
```

```sql
MATCH (doc:Document)
WHERE NOT (doc.status = "published" OR doc.views < 10)
RETURN doc.id AS id, doc.status AS status, doc.views AS views
```

```sql
MATCH (doc:Document)
RETURN doc.id AS id, (doc.views + $bonus) * 2 AS score
ORDER BY score DESC
LIMIT 25
```

```sql
MATCH (doc:Document)
WHERE doc.status IS NOT NULL
RETURN doc.id AS id,
  CASE
    WHEN doc.views >= 100 THEN "hot"
    WHEN doc.archivedAt IS NOT NULL THEN "archived"
    ELSE "active"
  END AS bucket
ORDER BY doc.id ASC
LIMIT 25
```

```sql
MATCH (doc:Document)
WHERE doc.status IS NOT NULL
WITH doc.status AS status, count(*) AS count, avg(doc.views) AS avgViews
GROUP BY doc.status
HAVING count > 0
RETURN status, count, avgViews
ORDER BY count DESC
```

```sql
MATCH (doc:Document)
WHERE doc.status IS NOT NULL
WITH doc.id AS id,
  CASE
    WHEN doc.views >= 100 THEN "hot"
    WHEN doc.archivedAt IS NOT NULL THEN "archived"
    ELSE "active"
  END AS bucket
WHERE bucket = "hot"
RETURN id, bucket
ORDER BY id ASC
```

```sql
MATCH (doc:Document)
WHERE doc.status = "draft"
SET doc.status = "archived"
RETURN count(*) AS changed
```

```sql
MATCH (doc:Document)
WHERE doc.status IS NOT NULL
SET doc.status =
  CASE
    WHEN doc.views >= 100 THEN "featured"
    WHEN doc.archivedAt IS NOT NULL THEN "archived"
    ELSE doc.status
  END
RETURN doc.id AS id, doc.status AS status
```

```sql
MATCH (doc:Document)
WHERE doc.status = "published"
SET doc.views = (doc.views + $increment) * 2
RETURN doc.id AS id, doc.views AS views
```

```sql
MATCH (doc:Document)
WHERE doc.archivedAt IS NOT NULL
REMOVE doc.archivedAt
RETURN count(*) AS changed
```

```sql
MATCH (doc:Document)
WHERE doc.status = "archived"
DELETE doc
RETURN doc.id AS id
```

```sql
MATCH (workspace:Workspace)
WHERE workspace.name = "Developer docs"
CREATE (doc:Document { id: "doc-4", title: "Release checklist", status: "draft", views: 0 }) INTO workspace.documents
RETURN doc.id AS id, doc.title AS title
```

```sql
MATCH (workspace:Workspace)
WHERE workspace.name = "Developer docs"
MERGE (doc:Document { id: "doc-4", title: "Release checklist", status: "draft", views: 0 }) INTO workspace.documents ON doc.id
RETURN doc.id AS id, doc.title AS title
```

Aggregate queries can be inspected directly in the same console:

```sql
MATCH (item)
RETURN item.status AS status, count(*) AS count
GROUP BY item.status
HAVING count > 1
ORDER BY count DESC, status ASC
```

```sql
MATCH (item)
RETURN item.status AS status, count(*) AS count, avg(item.views) AS avgViews
GROUP BY item.status
HAVING NOT (status = "published" OR avgViews < 10)
ORDER BY status ASC
```

`Run / Preview` executes read queries and dry-runs updates. `Commit GVQL` applies update statements only when Studio was started with mutation support and the confirmation token matches.

Each GVQL run includes an execution-plan row that shows whether Studio used a type index, primitive-property index, indexed `OR` union, or full scan, plus candidate and returned-row counts. That makes slow queries much easier to tune before they become production habits.
Use `LIMIT` and `OFFSET` in the console for predictable paging through large result sets. Query parameters such as `$needle` or `$increment` are detected automatically and shown as typed input fields, so you do not need to hand-edit a JSON payload for common runs. Comma-separated `MATCH` patterns let you express join-like graph queries where shared aliases must resolve to the same object. `OPTIONAL MATCH` keeps the primary rows visible when a relationship is missing. `WITH` pipelines let you name intermediate values, aggregate them, and filter row aliases before the final `RETURN`. Computed `RETURN` expressions, `CASE` buckets, and scalar functions such as `lower`, `upper`, `trim`, `length`, and `coalesce` are useful for quick scores, projections, normalization, and sanity checks without changing stored data. `RETURN DISTINCT` and `count(DISTINCT path)` are useful when you want compact lists or cardinality checks for values such as statuses, tenants, regions, types, or object categories. Parentheses and `NOT` in `WHERE` and `HAVING` make mixed filters predictable. `CREATE ... INTO`, idempotent `MERGE ... INTO ... ON`, arithmetic or conditional `SET` expressions, `IS NULL`, `IS NOT NULL`, `REMOVE`, and parent-aware `DELETE` make graph manipulation previewable before commit.
