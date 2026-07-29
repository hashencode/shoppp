import type { AuditEvent, AuditQuery } from "@shoppp/contracts";

import { ApiError } from "../http/errors";
import { redactForLog } from "../security/redaction";

export interface AuditEventInput {
  readonly action: string;
  readonly actorId?: string;
  readonly actorType: "shopper" | "admin" | "machine" | "provider";
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
  readonly reason?: string;
  readonly requestId?: string;
  readonly result: "allowed" | "denied" | "succeeded" | "failed";
  readonly targetId?: string;
  readonly targetType: string;
}

export function prepareAuditEvent(db: D1Database, input: AuditEventInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.actorType,
      input.actorId ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.result,
      input.reason ? String(redactForLog(input.reason)) : null,
      input.requestId ?? null,
      JSON.stringify(redactForLog(input.metadata ?? {})),
      new Date().toISOString(),
    );
}

export async function recordAuditEvent(db: D1Database, input: AuditEventInput): Promise<void> {
  await prepareAuditEvent(db, input).run();
}

interface AuditCursor {
  readonly createdAt: string;
  readonly id: string;
}

function decodeCursor(value: string): AuditCursor {
  try {
    const parsed = JSON.parse(atob(value)) as Partial<AuditCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") throw new Error();
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new ApiError(422, "invalid_audit_cursor", "The audit cursor is invalid.");
  }
}

function encodeCursor(cursor: AuditCursor): string {
  return btoa(JSON.stringify(cursor));
}

export async function listAuditEvents(
  db: D1Database,
  input: AuditQuery,
): Promise<{ data: AuditEvent[]; nextCursor: string | null }> {
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (input.action) {
    clauses.push("action = ?");
    bindings.push(input.action);
  }
  if (input.actorId) {
    clauses.push("actor_id = ?");
    bindings.push(input.actorId);
  }
  if (input.result) {
    clauses.push("result = ?");
    bindings.push(input.result);
  }
  if (input.targetType) {
    clauses.push("target_type = ?");
    bindings.push(input.targetType);
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    clauses.push("(created_at < ? OR (created_at = ? AND id < ?))");
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const rows = await db
    .prepare(
      `SELECT id, actor_type, actor_id, action, target_type, target_id, result, reason,
              request_id, metadata_json, created_at
         FROM audit_events
        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
    )
    .bind(...bindings, input.pageSize + 1)
    .all<{
      action: string;
      actor_id: string | null;
      actor_type: AuditEvent["actorType"];
      created_at: string;
      id: string;
      metadata_json: string;
      reason: string | null;
      request_id: string | null;
      result: AuditEvent["result"];
      target_id: string | null;
      target_type: string;
    }>();
  const page = rows.results.slice(0, input.pageSize);
  const last = page.at(-1);
  return {
    data: page.map((row) => ({
      action: row.action,
      actorId: row.actor_id,
      actorType: row.actor_type,
      createdAt: row.created_at,
      id: row.id,
      metadata: redactForLog(JSON.parse(row.metadata_json)) as Record<string, unknown>,
      reason: row.reason,
      requestId: row.request_id,
      result: row.result,
      targetId: row.target_id,
      targetType: row.target_type,
    })),
    nextCursor:
      rows.results.length > input.pageSize && last
        ? encodeCursor({ createdAt: last.created_at, id: last.id })
        : null,
  };
}
