export interface StudioGvqlExample {
  name: string;
  query: string;
  parameters?: Record<string, unknown>;
}

export const STUDIO_GVQL_EXAMPLES: StudioGvqlExample[] = [
  { name: "Inspect nodes", query: "MATCH (node) RETURN node.$id AS objectId, node.$type AS type, node.$kind AS kind ORDER BY node.$id ASC LIMIT 25 OFFSET 0" },
  { name: "Filter types", query: 'MATCH (node) WHERE node.$type IN ["Document", "Workspace"] RETURN node.$id AS objectId, node.$type AS type ORDER BY node.$type ASC, node.$id ASC' },
  { name: "Distinct values", query: "MATCH (item) RETURN DISTINCT item.status AS status ORDER BY status ASC" },
  { name: "Type count", query: "MATCH (node) WHERE node.$type IS NOT NULL RETURN count(DISTINCT node.$type) AS types" },
  { name: "Nullable fields", query: "MATCH (item) WHERE item.archivedAt IS NULL AND item.status IS NOT NULL RETURN item.id AS id, item.title AS title ORDER BY item.id ASC" },
  { name: "Indexed IN", query: 'MATCH (item) WHERE item.status IN ["draft", "published"] AND item.id IN ["doc-1", "doc-2"] RETURN item.id AS id, item.status AS status ORDER BY item.id ASC' },
  { name: "Indexed OR", query: 'MATCH (item) WHERE item.id = "missing" OR item.status = "published" RETURN item.id AS id, item.status AS status' },
  { name: "Parentheses", query: 'MATCH (item) WHERE (item.status = "draft" OR item.status = "published") AND item.views > 20 RETURN item.id AS id, item.status AS status, item.views AS views' },
  { name: "NOT filter", query: 'MATCH (item) WHERE NOT (item.status = "published" OR item.views < 10) RETURN item.id AS id, item.status AS status, item.views AS views' },
  { name: "Computed score", query: "MATCH (item) RETURN item.id AS id, (item.views + $bonus) * 2 AS score ORDER BY score DESC LIMIT 25", parameters: { bonus: 5 } },
  { name: "Aggregate", query: "MATCH (item) RETURN item.status AS status, count(*) AS count GROUP BY item.status HAVING count > 1 ORDER BY count DESC, status ASC" },
  { name: "Aggregate NOT", query: 'MATCH (item) RETURN item.status AS status, count(*) AS count, avg(item.views) AS avgViews GROUP BY item.status HAVING NOT (status = "published" OR avgViews < 10) ORDER BY status ASC' },
  { name: "Traverse owner", query: 'MATCH (item)-[:owner]->(owner) WHERE owner.name = "Platform Team" RETURN item.title AS title' },
  { name: "Join patterns", query: 'MATCH (item)-[:owner]->(owner), (item)-[:category]->(category) WHERE owner.name = "Platform Team" AND category.slug = "guides" RETURN item.id AS id, item.title AS title, category.label AS category ORDER BY item.title ASC LIMIT 25' },
  { name: "Optional match", query: "MATCH (item) OPTIONAL MATCH (item)-[:related]->(items)-[:*]->(related) RETURN item.id AS id, related.id AS relatedId ORDER BY item.id ASC LIMIT 25" },
  {
    name: "Scalar functions",
    query: 'MATCH (item) WHERE lower(item.title) CONTAINS lower($needle) RETURN item.id AS id, upper(trim(item.title)) AS title, length(item.title) AS titleLength, coalesce(item.archivedAt, "none") AS archived ORDER BY item.id ASC',
    parameters: { needle: "storage" },
  },
  { name: "Preview SET", query: 'MATCH (item) WHERE item.status = "draft" SET item.status = "archived" RETURN count(*) AS changed' },
  { name: "Arithmetic SET", query: "MATCH (item) WHERE item.status = \"published\" SET item.views = (item.views + $increment) * 2 RETURN item.id AS id, item.views AS views", parameters: { increment: 5 } },
  { name: "REMOVE field", query: "MATCH (item) WHERE item.archivedAt IS NOT NULL REMOVE item.archivedAt RETURN count(*) AS changed" },
  { name: "DELETE object", query: 'MATCH (item) WHERE item.status = "archived" DELETE item RETURN item.id AS id' },
  { name: "CREATE into collection", query: 'MATCH (workspace:Workspace) WHERE workspace.name = "Developer docs" CREATE (item:Document { id: "doc-4", title: "Release checklist", status: "draft", views: 0 }) INTO workspace.documents RETURN item.id AS id, item.title AS title' },
];
