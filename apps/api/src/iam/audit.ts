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

export async function recordAuditEvent(db: D1Database, input: AuditEventInput): Promise<void> {
  await db
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
      input.reason ?? null,
      input.requestId ?? null,
      JSON.stringify(input.metadata ?? {}),
      new Date().toISOString(),
    )
    .run();
}
