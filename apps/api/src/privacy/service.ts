import type { CreatePrivacyRequest, PrivacyRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

interface PrivacyRequestRow {
  completed_at: string;
  created_at: string;
  decision: PrivacyRequest["decision"];
  expires_at: string | null;
  id: string;
  object_key: string | null;
  status: "completed";
  subject_hash: string;
  type: PrivacyRequest["type"];
}

function dto(row: PrivacyRequestRow): PrivacyRequest {
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    decision: row.decision,
    expiresAt: row.expires_at,
    id: row.id,
    status: row.status,
    subjectReference: row.subject_hash.slice(0, 12),
    type: row.type,
  };
}

async function subjectHash(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function subjectExport(db: D1Database, email: string) {
  const orders = await db
    .prepare(
      `SELECT id, public_reference, email, currency, subtotal_amount, discount_amount,
              shipping_amount, tax_amount, grand_total_amount, payment_status,
              order_status, fulfillment_status, created_at, updated_at
         FROM orders
        WHERE lower(email) = lower(?)
        ORDER BY created_at, id`,
    )
    .bind(email)
    .all<Record<string, unknown> & { id: string }>();
  const data = [];
  for (const order of orders.results) {
    const [addresses, lines, refunds, fulfillment] = await Promise.all([
      db
        .prepare("SELECT * FROM order_addresses WHERE order_id = ? ORDER BY kind")
        .bind(order.id)
        .all(),
      db.prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id").bind(order.id).all(),
      db
        .prepare("SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at, id")
        .bind(order.id)
        .all(),
      db
        .prepare("SELECT * FROM fulfillment_events WHERE order_id = ? ORDER BY created_at, id")
        .bind(order.id)
        .all(),
    ]);
    data.push({
      addresses: addresses.results,
      fulfillment: fulfillment.results,
      lines: lines.results,
      order,
      refunds: refunds.results,
    });
  }
  return data;
}

async function loadRequest(db: D1Database, id: string): Promise<PrivacyRequestRow | null> {
  return db
    .prepare(
      `SELECT id, subject_hash, type, status, decision, object_key, expires_at,
              completed_at, created_at
         FROM privacy_requests WHERE id = ?`,
    )
    .bind(id)
    .first<PrivacyRequestRow>();
}

export async function createPrivacyRequest(
  context: Context<ApiEnvironment>,
  input: CreatePrivacyRequest,
): Promise<PrivacyRequest> {
  const id = `prv_${crypto.randomUUID().replaceAll("-", "")}`;
  const normalizedEmail = input.email.trim().toLowerCase();
  const hash = await subjectHash(normalizedEmail);
  const commerceData = await subjectExport(context.env.DB, normalizedEmail);
  const now = new Date();
  const createdAt = now.toISOString();
  let decision: PrivacyRequest["decision"];
  let expiresAt: string | null = null;
  let objectKey: string | null = null;
  if (input.type === "access") {
    decision = "export_created";
    expiresAt = new Date(now.getTime() + EXPORT_TTL_MS).toISOString();
    objectKey = `privacy/${context.env.ENVIRONMENT}/${id}.json`;
    await context.env.PRIVACY_EXPORTS.put(
      objectKey,
      JSON.stringify({
        exportedAt: createdAt,
        orders: commerceData,
        subject: { email: normalizedEmail },
      }),
      {
        customMetadata: {
          environment: context.env.ENVIRONMENT,
          expiresAt,
          privacyRequestId: id,
        },
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      },
    );
  } else {
    decision =
      commerceData.length > 0 ? "retained_immutable_financial_records" : "no_matching_records";
  }
  const principal = context.get("principal");
  const eventType = input.type === "access" ? "exported" : "retention_decision_recorded";
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO privacy_requests
           (id, subject_hash, type, status, decision, object_key, requested_by,
            expires_at, completed_at, created_at)
         VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      hash,
      input.type,
      decision,
      objectKey,
      principal.id,
      expiresAt,
      createdAt,
      createdAt,
    ),
    context.env.DB.prepare(
      `INSERT INTO privacy_request_events
           (id, privacy_request_id, event_type, metadata_json, created_at)
         VALUES (?, ?, 'verified', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      id,
      JSON.stringify({ subjectReference: hash.slice(0, 12) }),
      createdAt,
    ),
    context.env.DB.prepare(
      `INSERT INTO privacy_request_events
           (id, privacy_request_id, event_type, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      id,
      eventType,
      JSON.stringify({
        ...(input.correction ? { correctionField: input.correction.field } : {}),
        decision,
        matchedOrderCount: commerceData.length,
      }),
      createdAt,
    ),
    context.env.DB.prepare(
      `INSERT INTO privacy_request_events
           (id, privacy_request_id, event_type, metadata_json, created_at)
         VALUES (?, ?, 'completed', '{}', ?)`,
    ).bind(crypto.randomUUID(), id, createdAt),
  ]);
  await recordAuditEvent(context.env.DB, {
    action: `privacy.${input.type}.complete`,
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: {
      decision,
      matchedOrderCount: commerceData.length,
      subjectReference: hash.slice(0, 12),
    },
    reason: input.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "privacy_request",
  });
  return dto((await loadRequest(context.env.DB, id))!);
}

export async function listPrivacyRequests(db: D1Database): Promise<PrivacyRequest[]> {
  const rows = await db
    .prepare(
      `SELECT id, subject_hash, type, status, decision, object_key, expires_at,
              completed_at, created_at
         FROM privacy_requests
        ORDER BY created_at DESC, id DESC
        LIMIT 100`,
    )
    .all<PrivacyRequestRow>();
  return rows.results.map(dto);
}

export async function downloadPrivacyExport(
  context: Context<ApiEnvironment>,
  id: string,
): Promise<Response> {
  const row = await loadRequest(context.env.DB, id);
  if (!row)
    throw new ApiError(404, "privacy_request_not_found", "The privacy request was not found.");
  if (!row.object_key || !row.expires_at) {
    throw new ApiError(409, "privacy_export_unavailable", "This request has no export.");
  }
  if (row.expires_at <= new Date().toISOString()) {
    throw new ApiError(410, "privacy_export_expired", "The privacy export has expired.");
  }
  const object = await context.env.PRIVACY_EXPORTS.get(row.object_key);
  if (!object)
    throw new ApiError(410, "privacy_export_missing", "The privacy export is unavailable.");
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "privacy.export.download",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "privacy_request",
  });
  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="privacy-${id}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
