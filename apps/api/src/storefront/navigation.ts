import {
  navigationMenuSchema,
  type NavigationMenu,
  type NavigationMenuItemInput,
  type NavigationMenuWriteRequest,
  type NavigationTransitionRequest,
  type StorefrontResourceReference,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent, prepareConditionalAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import {
  filterStorefrontBacklinks,
  findNavigationBacklinks,
} from "../storefront-control/backlinks";

export type NavigationPlacement = "footer" | "header";
export type NavigationResourceKind = StorefrontResourceReference["kind"];

export async function listNavigationResources(
  db: D1Database,
  input: {
    kind: NavigationResourceKind;
    page: number;
    pageSize: number;
    query: string;
  },
) {
  const definitions = {
    article: {
      id: "article_id",
      name: "title",
      pathPrefix: "/magazine/",
      table: "content_article_versions",
    },
    collection: {
      id: "collection_id",
      name: "name",
      pathPrefix: "/collections/",
      table: "collection_versions",
    },
    page: { id: "page_id", name: "title", pathPrefix: "/", table: "content_page_versions" },
    policy: {
      id: "policy_id",
      name: "title",
      pathPrefix: "/policies/",
      table: "policy_versions",
    },
    product: { id: "id", name: "name", pathPrefix: "/products/", table: "products" },
  } as const;
  const definition = definitions[input.kind];
  const query = `%${input.query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const predicate = `status = 'published' AND (${definition.name} LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')`;
  const count = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${definition.table} WHERE ${predicate}`)
    .bind(query, query)
    .first<{ count: number }>();
  const rows = await db
    .prepare(
      `SELECT ${definition.id} AS id, ${definition.name} AS name, slug
         FROM ${definition.table}
        WHERE ${predicate}
        ORDER BY ${definition.name}, ${definition.id}
        LIMIT ? OFFSET ?`,
    )
    .bind(query, query, input.pageSize, (input.page - 1) * input.pageSize)
    .all<{ id: string; name: string; slug: string }>();
  return {
    data: rows.results.map((row) => ({
      id: row.id,
      kind: input.kind,
      name: row.name,
      path: `${definition.pathPrefix}${row.slug}`,
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: count?.count ?? 0,
  };
}

interface MenuRow {
  created_at: string;
  menu_id: string;
  placement: NavigationPlacement;
  published_at: string | null;
  status: "archived" | "draft" | "published";
  updated_at: string;
  version: number;
}

interface ItemRow {
  item_id: string;
  label: string;
  parent_item_id: string | null;
  position: number;
  target_json: string;
}

const menuId = (placement: NavigationPlacement) => `menu.${placement}`;

async function latestRow(db: D1Database, placement: NavigationPlacement): Promise<MenuRow | null> {
  return db
    .prepare(
      `SELECT menu_id, version, placement, status, created_at, updated_at, published_at
         FROM navigation_menu_versions WHERE menu_id = ? ORDER BY version DESC LIMIT 1`,
    )
    .bind(menuId(placement))
    .first<MenuRow>();
}

async function activeRows(db: D1Database, placement: NavigationPlacement): Promise<MenuRow[]> {
  const rows = await db
    .prepare(
      `SELECT menu_id, version, placement, status, created_at, updated_at, published_at
         FROM navigation_menu_versions
        WHERE menu_id = ? AND status != 'archived'
        ORDER BY version`,
    )
    .bind(menuId(placement))
    .all<MenuRow>();
  return rows.results;
}

function isCandidateLocked(error: unknown): boolean {
  return error instanceof Error && /catalog_candidate_sources_locked/i.test(error.message);
}

function candidateLockedError(): ApiError {
  return new ApiError(
    409,
    "catalog_candidate_sources_locked",
    "Catalog sources are frozen while a Preview candidate is being built. Retry shortly.",
  );
}

async function mapMenu(db: D1Database, row: MenuRow): Promise<NavigationMenu> {
  const items = await db
    .prepare(
      `SELECT item_id, parent_item_id, position, label, target_json
         FROM navigation_items WHERE menu_id = ? AND menu_version = ?
        ORDER BY CASE WHEN parent_item_id IS NULL THEN 0 ELSE 1 END,
                 COALESCE(parent_item_id, ''), position, item_id`,
    )
    .bind(row.menu_id, row.version)
    .all<ItemRow>();
  return navigationMenuSchema.parse({
    createdAt: row.created_at,
    id: row.menu_id,
    items: items.results.map((item) => ({
      id: item.item_id,
      label: item.label,
      parentId: item.parent_item_id,
      position: item.position,
      target: JSON.parse(item.target_json),
    })),
    placement: row.placement,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

async function inclusion(db: D1Database, menu: NavigationMenu) {
  const [rows, staleTargets] = await Promise.all([
    db
      .prepare(
        `SELECT source.source_version, release.purpose, release.candidate_status, release.status
         FROM catalog_release_sources source
         JOIN catalog_releases release ON release.id = source.release_id
        WHERE source.source_kind = 'navigation' AND source.source_id = ?
          AND ((release.purpose = 'private-preview' AND release.candidate_status = 'succeeded')
            OR release.status = 'deployed')`,
      )
      .bind(menu.id)
      .all<{ candidate_status: string; purpose: string; source_version: number; status: string }>(),
    db
      .prepare(
        `SELECT item_id FROM (
         SELECT reference.item_id FROM navigation_page_references reference
         JOIN content_page_versions target ON target.page_id = reference.page_id AND target.version = reference.page_version
         WHERE reference.menu_id = ? AND reference.menu_version = ? AND target.status != 'published'
         UNION ALL
         SELECT reference.item_id FROM navigation_article_references reference
         JOIN content_article_versions target ON target.article_id = reference.article_id AND target.version = reference.article_version
         WHERE reference.menu_id = ? AND reference.menu_version = ? AND target.status != 'published'
         UNION ALL
         SELECT reference.item_id FROM navigation_policy_references reference
         JOIN policy_versions target ON target.policy_id = reference.policy_id AND target.version = reference.policy_version
         WHERE reference.menu_id = ? AND reference.menu_version = ? AND target.status != 'published'
         UNION ALL
         SELECT reference.item_id FROM navigation_collection_references reference
         JOIN collection_versions target ON target.collection_id = reference.collection_id AND target.version = reference.collection_version
         WHERE reference.menu_id = ? AND reference.menu_version = ? AND target.status != 'published'
         UNION ALL
         SELECT reference.item_id FROM navigation_product_references reference
         LEFT JOIN products target ON target.id = reference.product_id AND target.version = reference.product_version
         WHERE reference.menu_id = ? AND reference.menu_version = ?
           AND COALESCE(target.status, 'missing') != 'published'
       ) ORDER BY item_id`,
      )
      .bind(
        menu.id,
        menu.version,
        menu.id,
        menu.version,
        menu.id,
        menu.version,
        menu.id,
        menu.version,
        menu.id,
        menu.version,
      )
      .all<{ item_id: string }>(),
  ]);
  const candidateRows = rows.results.filter(
    ({ candidate_status, purpose }) =>
      purpose === "private-preview" && candidate_status === "succeeded",
  );
  const liveRows = rows.results.filter(({ status }) => status === "deployed");
  const candidate = candidateRows.some(({ source_version }) => source_version === menu.version);
  const live = liveRows.some(({ source_version }) => source_version === menu.version);
  return Object.assign(menu, {
    inclusion: {
      candidate,
      candidateStale: !candidate && candidateRows.length > 0,
      live,
      liveStale: !live && liveRows.length > 0,
      staleCauses: staleTargets.results.map(({ item_id }) => `target:${item_id}`),
    },
  });
}

export async function getNavigationMenu(db: D1Database, placement: NavigationPlacement) {
  const row = await latestRow(db, placement);
  return row ? inclusion(db, await mapMenu(db, row)) : null;
}

type ResolvedReference = {
  id: string;
  kind: StorefrontResourceReference["kind"];
  version: number;
};

async function resolveReference(
  db: D1Database,
  reference: StorefrontResourceReference,
): Promise<ResolvedReference> {
  const definitions = {
    article: ["content_article_versions", "article_id"],
    collection: ["collection_versions", "collection_id"],
    page: ["content_page_versions", "page_id"],
    policy: ["policy_versions", "policy_id"],
    product: ["products", "id"],
  } as const;
  const [table, idColumn] = definitions[reference.kind];
  const row = await db
    .prepare(
      `SELECT version FROM ${table} WHERE ${idColumn} = ? AND status = 'published'
        ORDER BY version DESC LIMIT 1`,
    )
    .bind(reference.id)
    .first<{ version: number }>();
  if (!row) {
    throw new ApiError(
      422,
      "navigation_target_unpublished",
      "Navigation targets must be published in the current environment.",
      { targetId: reference.id, targetKind: reference.kind },
    );
  }
  return { id: reference.id, kind: reference.kind, version: row.version };
}

async function resolveReferences(db: D1Database, items: NavigationMenuItemInput[]) {
  const resolved = new Map<string, ResolvedReference>();
  await Promise.all(
    items.map(async (item) => {
      if (item.target.kind === "internal") {
        resolved.set(item.id, await resolveReference(db, item.target.reference));
      }
    }),
  );
  return resolved;
}

async function assignServerOwnedItemIds(
  db: D1Database,
  current: MenuRow | null,
  items: NavigationMenuItemInput[],
): Promise<NavigationMenuItemInput[]> {
  const existingIds = new Set(
    current ? (await mapMenu(db, current)).items.map(({ id }) => id) : [],
  );
  const resolvedIds = new Map(
    items.map(({ id }) => [
      id,
      existingIds.has(id) ? id : `navigation-item.${crypto.randomUUID()}`,
    ]),
  );
  return items.map((item) => ({
    ...item,
    id: resolvedIds.get(item.id)!,
    parentId: item.parentId === null ? null : resolvedIds.get(item.parentId)!,
  }));
}

function itemStatements(
  db: D1Database,
  id: string,
  version: number,
  items: NavigationMenuItemInput[],
  references: ReadonlyMap<string, ResolvedReference>,
  environment: string,
  now: string,
) {
  const roots = items.filter(({ parentId }) => parentId === null);
  const children = items.filter(({ parentId }) => parentId !== null);
  const statements = [...roots, ...children].map((item) =>
    db
      .prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        version,
        item.id,
        item.parentId,
        item.position,
        item.label,
        JSON.stringify(item.target),
      ),
  );
  for (const item of items) {
    const reference = references.get(item.id);
    if (!reference) continue;
    const table = `navigation_${reference.kind}_references`;
    const prefix = reference.kind;
    statements.push(
      db
        .prepare(
          `INSERT INTO ${table}
            (menu_id, menu_version, item_id, ${prefix}_id, ${prefix}_version, environment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, version, item.id, reference.id, reference.version, environment, now),
    );
  }
  return statements;
}

export async function saveNavigationMenu(
  context: Context<ApiEnvironment>,
  placement: NavigationPlacement,
  input: NavigationMenuWriteRequest,
) {
  const current = await latestRow(context.env.DB, placement);
  if (!current && input.expectedVersion !== undefined) {
    throw new ApiError(409, "navigation_conflict", "The Navigation menu no longer matches.");
  }
  if (current && input.expectedVersion !== current.version) {
    throw new ApiError(
      409,
      "navigation_conflict",
      "The Navigation menu changed. Reload before saving.",
    );
  }
  const items = await assignServerOwnedItemIds(context.env.DB, current, input.items);
  const references = await resolveReferences(context.env.DB, items);
  const id = menuId(placement);
  const version = (current?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?)`,
    ).bind(id, version, placement, current?.created_at ?? now, now),
    ...itemStatements(context.env.DB, id, version, items, references, context.env.ENVIRONMENT, now),
    prepareAuditEvent(context.env.DB, {
      action: current ? "navigation.update" : "navigation.create",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { placement, version },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: id,
      targetType: "navigation-menu",
    }),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if (isCandidateLocked(error)) throw candidateLockedError();
    if ((await latestRow(context.env.DB, placement))?.version !== current?.version) {
      throw new ApiError(
        409,
        "navigation_conflict",
        "The Navigation menu changed. Reload before saving.",
      );
    }
    throw error;
  }
  return getNavigationMenu(context.env.DB, placement);
}

export async function transitionNavigationMenu(
  context: Context<ApiEnvironment>,
  placement: NavigationPlacement,
  input: NavigationTransitionRequest,
  action: "archive" | "publish",
  beforeCommit?: () => Promise<void>,
) {
  const current = await latestRow(context.env.DB, placement);
  if (!current)
    throw new ApiError(404, "navigation_not_found", "The Navigation menu was not found.");
  if (current.version !== input.expectedVersion) {
    throw new ApiError(
      409,
      "navigation_conflict",
      "The Navigation menu changed. Reload before continuing.",
    );
  }
  if (action === "publish" && current.status !== "draft") {
    throw new ApiError(409, "navigation_transition_invalid", "Only a draft menu can be published.");
  }
  if (action === "archive" && current.status === "archived") {
    throw new ApiError(409, "navigation_transition_invalid", "The menu is already archived.");
  }
  const active = await activeRows(context.env.DB, placement);
  const archivedRows =
    action === "archive" ? active : active.filter(({ version }) => version !== current.version);
  const rawBacklinks = (
    await Promise.all(
      archivedRows.map((row) =>
        findNavigationBacklinks(context.env.DB, row.menu_id, row.version, context.env.ENVIRONMENT),
      ),
    )
  ).flat();
  if (rawBacklinks.length) {
    throw new ApiError(
      409,
      "navigation_referenced",
      "Repair Navigation backlinks before archive.",
      {
        backlinks: filterStorefrontBacklinks(rawBacklinks, context.get("principal").permissions),
      },
    );
  }
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const auditId = crypto.randomUUID();
  const activePredicates = active.map(() => "(version = ? AND status = ?)").join(" OR ");
  const transitionGuard = `SELECT 1 FROM navigation_menu_versions current
    WHERE current.menu_id = ? AND current.version = ? AND current.status = ?
      AND (SELECT COUNT(*) FROM navigation_menu_versions
            WHERE menu_id = current.menu_id AND status != 'archived') = ?
      ${
        active.length
          ? `AND EXISTS (
        SELECT 1 FROM navigation_menu_versions active
         WHERE active.menu_id = current.menu_id AND (${activePredicates})
         GROUP BY active.menu_id HAVING COUNT(*) = ?
      )`
          : ""
      }
      AND NOT EXISTS (
        SELECT 1 FROM storefront_experience_drafts draft,
             json_each(draft.bindings_json) binding
         WHERE json_extract(binding.value, '$.kind') = 'navigation'
           AND json_extract(binding.value, '$.reference.id') = current.menu_id
           AND CAST(json_extract(binding.value, '$.reference.version') AS INTEGER)
               IN (${archivedRows.map(() => "?").join(", ") || "NULL"})
           AND COALESCE(json_extract(binding.value, '$.reference.environment'), ?) = ?
      )`;
  const transitionBindings: unknown[] = [
    current.menu_id,
    current.version,
    current.status,
    active.length,
    ...active.flatMap(({ version, status }) => [version, status]),
    ...(active.length ? [active.length] : []),
    ...archivedRows.map(({ version }) => version),
    context.env.ENVIRONMENT,
    context.env.ENVIRONMENT,
  ];
  const statements: D1PreparedStatement[] = [
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: `navigation.${action}`,
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: auditId,
        metadata: { placement, version: current.version },
        reason: input.reason,
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: current.menu_id,
        targetType: "navigation-menu",
      },
      {
        bindings: transitionBindings,
        sql: transitionGuard,
      },
    ),
  ];
  if (action === "publish") {
    statements.push(
      context.env.DB.prepare(
        `UPDATE navigation_menu_versions SET status = 'archived', updated_at = ?
          WHERE menu_id = ? AND version != ? AND status != 'archived'
            AND EXISTS (SELECT 1 FROM audit_events WHERE id = ?)`,
      ).bind(now, current.menu_id, current.version, auditId),
    );
    statements.push(
      context.env.DB.prepare(
        `UPDATE navigation_menu_versions
            SET status = 'published', updated_at = ?, published_at = ?
          WHERE menu_id = ? AND version = ? AND status = 'draft'
            AND EXISTS (SELECT 1 FROM audit_events WHERE id = ?)`,
      ).bind(now, now, current.menu_id, current.version, auditId),
    );
  } else {
    statements.push(
      context.env.DB.prepare(
        `UPDATE navigation_menu_versions SET status = 'archived', updated_at = ?
          WHERE menu_id = ? AND status != 'archived'
            AND EXISTS (SELECT 1 FROM audit_events WHERE id = ?)`,
      ).bind(now, current.menu_id, auditId),
    );
  }
  await beforeCommit?.();
  let results: D1Result<unknown>[];
  try {
    results = await context.env.DB.batch(statements);
  } catch (error) {
    if (isCandidateLocked(error)) throw candidateLockedError();
    throw error;
  }
  const expectedChanges = action === "publish" ? [archivedRows.length, 1] : [archivedRows.length];
  const mutationResults = results.slice(1);
  if (
    mutationResults.length !== expectedChanges.length ||
    mutationResults.some((result, index) => result.meta.changes !== expectedChanges[index])
  ) {
    throw new ApiError(
      409,
      "navigation_conflict",
      "The Navigation menu changed. Reload before continuing.",
    );
  }
  return getNavigationMenu(context.env.DB, placement);
}
