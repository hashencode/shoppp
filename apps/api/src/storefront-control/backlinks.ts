export interface StorefrontBacklinkDiagnostic {
  readonly code: "resource_referenced";
  readonly environment: "development" | "staging" | "production";
  readonly sourceDomain: "content" | "navigation" | "theme";
  readonly sourceId: string;
  readonly sourceItemId: string;
  readonly sourceVersion: number;
  readonly targetDomain: "article" | "collection" | "navigation" | "page" | "policy";
  readonly targetId: string;
  readonly targetVersion: number;
}

export function filterStorefrontBacklinks(
  diagnostics: readonly StorefrontBacklinkDiagnostic[],
  permissions: readonly AdminPermission[],
): StorefrontBacklinkDiagnostic[] {
  const allowed = new Set(permissions);
  return diagnostics.filter(({ sourceDomain }) => {
    if (sourceDomain === "navigation") return allowed.has("navigation.read");
    if (sourceDomain === "content") return allowed.has("content.read");
    return allowed.has("themes.read");
  });
}

interface NavigationReferenceRow {
  environment: StorefrontBacklinkDiagnostic["environment"];
  item_id: string;
  menu_id: string;
  menu_version: number;
  target_id: string;
  target_version: number;
}

function navigationDiagnostic(
  targetDomain: StorefrontBacklinkDiagnostic["targetDomain"],
  row: NavigationReferenceRow,
): StorefrontBacklinkDiagnostic {
  return {
    code: "resource_referenced",
    environment: row.environment,
    sourceDomain: "navigation",
    sourceId: row.menu_id,
    sourceItemId: row.item_id,
    sourceVersion: row.menu_version,
    targetDomain,
    targetId: row.target_id,
    targetVersion: row.target_version,
  };
}

async function navigationBacklinks(
  db: D1Database,
  table:
    | "navigation_article_references"
    | "navigation_collection_references"
    | "navigation_page_references"
    | "navigation_policy_references",
  targetDomain: "article" | "collection" | "page" | "policy",
  idColumn: "article_id" | "collection_id" | "page_id" | "policy_id",
  versionColumn: "article_version" | "collection_version" | "page_version" | "policy_version",
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  const rows = await db
    .prepare(
      `SELECT menu_id, menu_version, item_id, environment,
              ${idColumn} AS target_id, ${versionColumn} AS target_version
         FROM ${table}
        WHERE ${idColumn} = ? AND ${versionColumn} = ? AND environment = ?
        ORDER BY menu_id, menu_version, item_id`,
    )
    .bind(targetId, targetVersion, environment)
    .all<NavigationReferenceRow>();
  return rows.results.map((row) => navigationDiagnostic(targetDomain, row));
}

export function findPolicyBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  return navigationBacklinks(
    db,
    "navigation_policy_references",
    "policy",
    "policy_id",
    "policy_version",
    targetId,
    targetVersion,
    environment,
  );
}

export function findPageBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  return resourceBacklinks(db, "page", targetId, targetVersion, environment);
}

export function findArticleBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  return resourceBacklinks(db, "article", targetId, targetVersion, environment);
}

async function resourceBacklinks(
  db: D1Database,
  targetDomain: "article" | "page",
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  const navigation = await navigationBacklinks(
    db,
    targetDomain === "page" ? "navigation_page_references" : "navigation_article_references",
    targetDomain,
    targetDomain === "page" ? "page_id" : "article_id",
    targetDomain === "page" ? "page_version" : "article_version",
    targetId,
    targetVersion,
    environment,
  );
  const content = await db
    .prepare(
      `SELECT source_id, source_version, source_item_id FROM (
         SELECT page_id AS source_id, version AS source_version,
                json_extract(section.value, '$.id') AS source_item_id
           FROM content_page_versions, json_each(sections_json) section
          WHERE status = 'published'
            AND json_extract(section.value, '$.kind') = 'link'
            AND json_extract(section.value, '$.link.target.kind') = 'internal'
            AND json_extract(section.value, '$.link.target.reference.kind') = ?
            AND json_extract(section.value, '$.link.target.reference.id') = ?
         UNION ALL
         SELECT article_id AS source_id, version AS source_version,
                json_extract(section.value, '$.id') AS source_item_id
           FROM content_article_versions, json_each(sections_json) section
          WHERE status = 'published'
            AND json_extract(section.value, '$.kind') = 'link'
            AND json_extract(section.value, '$.link.target.kind') = 'internal'
            AND json_extract(section.value, '$.link.target.reference.kind') = ?
            AND json_extract(section.value, '$.link.target.reference.id') = ?
       ) ORDER BY source_id, source_version, source_item_id`,
    )
    .bind(targetDomain, targetId, targetDomain, targetId)
    .all<{ source_id: string; source_item_id: string; source_version: number }>();
  const theme = await db
    .prepare(
      `SELECT DISTINCT draft.id AS source_id, draft.version AS source_version,
              COALESCE(reference.fullkey, reference.path, '$') AS source_item_id
         FROM storefront_experience_drafts draft,
              json_tree(json_array(json(draft.bindings_json), json(draft.overrides_json))) reference
        WHERE reference.type = 'object'
          AND json_extract(reference.value, '$.kind') = ?
          AND json_extract(reference.value, '$.id') = ?
        ORDER BY draft.id, draft.version, source_item_id`,
    )
    .bind(targetDomain, targetId)
    .all<{ source_id: string; source_item_id: string; source_version: number }>();
  return [
    ...navigation,
    ...content.results.map((row) => ({
      code: "resource_referenced" as const,
      environment,
      sourceDomain: "content" as const,
      sourceId: row.source_id,
      sourceItemId: row.source_item_id,
      sourceVersion: row.source_version,
      targetDomain,
      targetId,
      targetVersion,
    })),
    ...theme.results.map((row) => ({
      code: "resource_referenced" as const,
      environment,
      sourceDomain: "theme" as const,
      sourceId: row.source_id,
      sourceItemId: row.source_item_id,
      sourceVersion: row.source_version,
      targetDomain,
      targetId,
      targetVersion,
    })),
  ];
}

export function findCollectionBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  return navigationBacklinks(
    db,
    "navigation_collection_references",
    "collection",
    "collection_id",
    "collection_version",
    targetId,
    targetVersion,
    environment,
  );
}

export async function findNavigationBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  const rows = await db
    .prepare(
      `SELECT draft.id AS source_id, draft.version AS source_version,
              json_extract(binding.value, '$.id') AS source_item_id
         FROM storefront_experience_drafts draft, json_each(draft.bindings_json) binding
        WHERE json_extract(binding.value, '$.kind') = 'navigation'
          AND json_extract(binding.value, '$.reference.id') = ?
          AND json_extract(binding.value, '$.reference.version') = ?
          AND COALESCE(json_extract(binding.value, '$.reference.environment'), ?) = ?
        ORDER BY draft.id, draft.version, source_item_id`,
    )
    .bind(targetId, targetVersion, environment, environment)
    .all<{ source_id: string; source_item_id: string; source_version: number }>();
  return rows.results.map((row) => ({
    code: "resource_referenced",
    environment,
    sourceDomain: "theme",
    sourceId: row.source_id,
    sourceItemId: row.source_item_id,
    sourceVersion: row.source_version,
    targetDomain: "navigation",
    targetId,
    targetVersion,
  }));
}
import type { AdminPermission } from "@shoppp/contracts";
