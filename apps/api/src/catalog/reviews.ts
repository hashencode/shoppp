import type { Context } from "hono";
import type { ModerateProductReview, SubmitProductReview } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

interface ReviewRow {
  body: string;
  display_name: string;
  id: string;
  moderated_at: string | null;
  moderated_by: string | null;
  moderation_reason: string | null;
  product_id: string;
  rating: number;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
}

const reviewProjection = `body, display_name, id, moderated_at, moderated_by,
  moderation_reason, product_id, rating, status, submitted_at`;

function view(row: ReviewRow) {
  return {
    body: row.body,
    displayName: row.display_name,
    id: row.id,
    moderatedAt: row.moderated_at,
    moderatedBy: row.moderated_by,
    moderationReason: row.moderation_reason,
    productId: row.product_id,
    rating: row.rating,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export async function submitProductReview(
  db: D1Database,
  slug: string,
  input: SubmitProductReview,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const inserted = await db
    .prepare(
      `INSERT INTO product_reviews
         (id, product_id, rating, display_name, body, consent_accepted_at,
          status, submitted_at)
       SELECT ?, id, ?, ?, ?, ?, 'pending', ? FROM products
        WHERE slug = ? AND status = 'published'`,
    )
    .bind(id, input.rating, input.displayName, input.body, now, now, slug)
    .run();
  if (inserted.meta.changes !== 1) {
    throw new ApiError(404, "product_not_found", "The published Product was not found.");
  }
  return { id, status: "pending" as const, submittedAt: now };
}

export async function listPendingProductReviews(db: D1Database, after?: string) {
  const cursor = after
    ? await db
        .prepare("SELECT submitted_at, id FROM product_reviews WHERE id = ?")
        .bind(after)
        .first<{ id: string; submitted_at: string }>()
    : null;
  if (after && !cursor) {
    throw new ApiError(400, "review_cursor_invalid", "The review cursor is invalid.");
  }
  const result = await db
    .prepare(
      `SELECT ${reviewProjection} FROM product_reviews
        WHERE status = 'pending'
          AND (? IS NULL OR submitted_at > ? OR (submitted_at = ? AND id > ?))
        ORDER BY submitted_at, id LIMIT 51`,
    )
    .bind(
      cursor?.submitted_at ?? null,
      cursor?.submitted_at ?? null,
      cursor?.submitted_at ?? null,
      cursor?.id ?? null,
    )
    .all<ReviewRow>();
  const rows = result.results.slice(0, 50);
  return {
    items: rows.map(view),
    nextCursor: result.results.length > 50 ? (rows.at(-1)?.id ?? null) : null,
  };
}

export async function getProductReview(db: D1Database, id: string) {
  const row = await db
    .prepare(`SELECT ${reviewProjection} FROM product_reviews WHERE id = ?`)
    .bind(id)
    .first<ReviewRow>();
  if (!row) throw new ApiError(404, "review_not_found", "The review was not found.");
  return view(row);
}

export async function moderateProductReview(
  context: Context<ApiEnvironment>,
  id: string,
  input: ModerateProductReview,
) {
  const db = context.env.DB;
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const [changed] = await db.batch([
    db
      .prepare(
        `UPDATE product_reviews
            SET status = ?, moderated_at = ?, moderated_by = ?, moderation_reason = ?
          WHERE id = ? AND status = 'pending'`,
      )
      .bind(input.decision, now, principal.id, input.reason, id),
    db
      .prepare(
        `INSERT INTO audit_events
          (id, actor_type, actor_id, action, target_type, target_id, result,
           reason, request_id, metadata_json, created_at)
         SELECT ?, 'admin', ?, ?, 'product_review', id, 'succeeded', ?, ?, ?, ?
           FROM product_reviews
          WHERE id = ? AND status = ? AND moderated_at = ? AND moderated_by = ?`,
      )
      .bind(
        crypto.randomUUID(),
        principal.id,
        `reviews.${input.decision}`,
        input.reason,
        context.get("requestId"),
        JSON.stringify({ decision: input.decision }),
        now,
        id,
        input.decision,
        now,
        principal.id,
      ),
  ]);
  if (changed?.meta.changes !== 1) {
    const exists = await db
      .prepare("SELECT status FROM product_reviews WHERE id = ?")
      .bind(id)
      .first<{ status: string }>();
    if (!exists) throw new ApiError(404, "review_not_found", "The review was not found.");
    throw new ApiError(409, "review_already_moderated", "The review has already been moderated.");
  }
  return getProductReview(db, id);
}
