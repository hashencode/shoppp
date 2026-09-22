export const STOREFRONT_CONTROL_PREFLIGHT_CODES = {
  duplicateCollectionPosition: "SCP_COLLECTION_POSITION_DUPLICATE",
  invalidCollectionPosition: "SCP_COLLECTION_POSITION_INVALID",
  orphanCollectionReference: "SCP_COLLECTION_REFERENCE_ORPHAN",
} as const;

export interface StorefrontControlPreflightIssue {
  code: (typeof STOREFRONT_CONTROL_PREFLIGHT_CODES)[keyof typeof STOREFRONT_CONTROL_PREFLIGHT_CODES];
  collectionId: string;
  productId?: string;
  position?: number;
}

export interface StorefrontControlPreflightResult {
  checkedMemberships: number;
  issues: StorefrontControlPreflightIssue[];
  membershipDigest: string;
  ok: boolean;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Read-only preflight suitable for a local SQLite/D1 database restored from a production export.
 * It deliberately performs SELECT statements only and never repairs or coerces conflicting rows.
 */
export async function runStorefrontControlPreflight(
  db: Pick<D1Database, "prepare">,
): Promise<StorefrontControlPreflightResult> {
  const rows = await db
    .prepare(
      `SELECT cp.collection_id, cp.product_id, cp.position,
              c.id AS resolved_collection_id, p.id AS resolved_product_id
         FROM collection_products cp
         LEFT JOIN collections c ON c.id = cp.collection_id
         LEFT JOIN products p ON p.id = cp.product_id
        ORDER BY cp.collection_id, cp.position, cp.product_id`,
    )
    .all<{
      collection_id: string;
      position: number;
      product_id: string;
      resolved_collection_id: string | null;
      resolved_product_id: string | null;
    }>();
  const issues: StorefrontControlPreflightIssue[] = [];
  const positions = new Set<string>();
  for (const row of rows.results) {
    if (!row.resolved_collection_id || !row.resolved_product_id) {
      issues.push({
        code: STOREFRONT_CONTROL_PREFLIGHT_CODES.orphanCollectionReference,
        collectionId: row.collection_id,
        productId: row.product_id,
        position: row.position,
      });
    }
    if (!Number.isInteger(row.position) || row.position < 0) {
      issues.push({
        code: STOREFRONT_CONTROL_PREFLIGHT_CODES.invalidCollectionPosition,
        collectionId: row.collection_id,
        productId: row.product_id,
        position: row.position,
      });
    }
    const positionKey = `${row.collection_id}\u0000${row.position}`;
    if (positions.has(positionKey)) {
      issues.push({
        code: STOREFRONT_CONTROL_PREFLIGHT_CODES.duplicateCollectionPosition,
        collectionId: row.collection_id,
        productId: row.product_id,
        position: row.position,
      });
    }
    positions.add(positionKey);
  }
  issues.sort((left, right) =>
    `${left.code}:${left.collectionId}:${left.position ?? ""}:${left.productId ?? ""}`.localeCompare(
      `${right.code}:${right.collectionId}:${right.position ?? ""}:${right.productId ?? ""}`,
    ),
  );
  const membershipDigest = await sha256(
    rows.results
      .map(
        ({ collection_id, position, product_id }) => `${collection_id}:${position}:${product_id}`,
      )
      .join("\n"),
  );
  return {
    checkedMemberships: rows.results.length,
    issues,
    membershipDigest,
    ok: issues.length === 0,
  };
}
