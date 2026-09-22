export interface StorefrontBacklinkDiagnostic {
  readonly code: "resource_referenced";
  readonly environment: "development" | "staging" | "production";
  readonly sourceDomain: "experience" | "navigation";
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
  return diagnostics.filter(({ sourceDomain }) =>
    sourceDomain === "navigation" ? allowed.has("navigation.read") : allowed.has("themes.read"),
  );
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
  return navigationBacklinks(
    db,
    "navigation_page_references",
    "page",
    "page_id",
    "page_version",
    targetId,
    targetVersion,
    environment,
  );
}

export function findArticleBacklinks(
  db: D1Database,
  targetId: string,
  targetVersion: number,
  environment: StorefrontBacklinkDiagnostic["environment"],
): Promise<StorefrontBacklinkDiagnostic[]> {
  return navigationBacklinks(
    db,
    "navigation_article_references",
    "article",
    "article_id",
    "article_version",
    targetId,
    targetVersion,
    environment,
  );
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
    sourceDomain: "experience",
    sourceId: row.source_id,
    sourceItemId: row.source_item_id,
    sourceVersion: row.source_version,
    targetDomain: "navigation",
    targetId,
    targetVersion,
  }));
}
import type { AdminPermission } from "@shoppp/contracts";
