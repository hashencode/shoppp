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
    .prepare("SELECT id FROM payment_events WHERE provider = ? AND provider_event_id = ?")
    .bind(input.provider, input.providerEventId)
    .first<{ id: string }>();
  if (!stored) {
    throw new Error("Provider event was not persisted.");
  }
  return { created: result.meta.changes === 1, id: stored.id };
}
