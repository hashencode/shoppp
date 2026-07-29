export interface RecordProviderEventInput {
  readonly checkoutAttemptId?: string;
  readonly id: string;
  readonly orderId?: string;
  readonly payloadHash: string;
  readonly provider: string;
  readonly providerCreatedAt?: string;
  readonly providerEventId: string;
  readonly receivedAt: string;
  readonly type: string;
}

export interface RecordedProviderEvent {
  readonly created: boolean;
  readonly id: string;
  readonly lastErrorCode: string | null;
  readonly processingAttemptCount: number;
  readonly result: "applied" | "ignored" | "failed" | null;
}

export async function recordProviderEvent(
  db: D1Database,
  input: RecordProviderEventInput,
): Promise<RecordedProviderEvent> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO payment_events
         (id, order_id, checkout_attempt_id, provider, provider_event_id, type, payload_hash, provider_created_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.orderId ?? null,
      input.checkoutAttemptId ?? null,
      input.provider,
      input.providerEventId,
      input.type,
      input.payloadHash,
      input.providerCreatedAt ?? null,
      input.receivedAt,
    )
    .run();
  const stored = await db
    .prepare(
      `SELECT id, result, processing_attempt_count, last_error_code
         FROM payment_events WHERE provider = ? AND provider_event_id = ?`,
    )
    .bind(input.provider, input.providerEventId)
    .first<{
      id: string;
      last_error_code: string | null;
      processing_attempt_count: number;
      result: "applied" | "ignored" | "failed" | null;
    }>();
  if (!stored) {
    throw new Error("Provider event was not persisted.");
  }
  return {
    created: result.meta.changes === 1,
    id: stored.id,
    lastErrorCode: stored.last_error_code,
    processingAttemptCount: stored.processing_attempt_count,
    result: stored.result,
  };
}

export async function markProviderEvent(
  db: D1Database,
  input: {
    readonly checkoutAttemptId?: string;
    readonly id: string;
    readonly lastErrorCode?: string;
    readonly orderId?: string;
    readonly processedAt: string;
    readonly result: "applied" | "ignored" | "failed";
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE payment_events
          SET checkout_attempt_id = COALESCE(checkout_attempt_id, ?),
              order_id = COALESCE(order_id, ?),
              result = ?,
              processed_at = ?,
              last_error_code = ?,
              processing_attempt_count = processing_attempt_count + 1
        WHERE id = ?`,
    )
    .bind(
      input.checkoutAttemptId ?? null,
      input.orderId ?? null,
      input.result,
      input.processedAt,
      input.lastErrorCode ?? null,
      input.id,
    )
    .run();
}
