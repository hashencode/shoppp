import { expireInventoryReservation } from "@shoppp/db";

export interface ExpirySweepResult {
  readonly examined: number;
  readonly expired: number;
}

export async function expireDueReservations(
  db: D1Database,
  now = new Date().toISOString(),
  limit = 100,
): Promise<ExpirySweepResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new RangeError("Expiry sweep limit must be between 1 and 1000.");
  }
  const due = await db
    .prepare(
      `SELECT id
         FROM inventory_reservation_groups
        WHERE status = 'active' AND expires_at <= ?
        ORDER BY expires_at, id
        LIMIT ?`,
    )
    .bind(now, limit)
    .all<{ id: string }>();
  let expired = 0;
  for (const group of due.results) {
    const result = await expireInventoryReservation(db, group.id, now);
    if (result?.changed) expired += 1;
  }
  return { examined: due.results.length, expired };
}
