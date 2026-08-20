import { reconcilePaymentEvent, type ReconciliationResult } from "../payments/reconciliation";
import type { StripeTestSettlementProvider } from "../payments/stripe-adapter";

export type FashionStagingResourceType =
  "cart" | "checkout_attempt" | "order" | "reservation" | "reservation_group";

export interface FashionStagingAcceptanceIdentity {
  artifactDigest: string;
  catalogReleaseId: string;
  commitSha: string;
  experienceSnapshotId: string;
  seedManifestDigest: string;
}

export interface AcquireFashionStagingAcceptanceInput extends FashionStagingAcceptanceIdentity {
  environment: "fashion-staging";
  leaseMinutes?: number;
  minimumSellableQuantity?: number;
  owner: string;
  runId: string;
  variantId: string;
  warehouseId: string;
}

export interface FashionStagingInventoryBaseline {
  backorderedQuantity: number;
  onHandQuantity: number;
  oversellLimit: number;
  reservedQuantity: number;
  variantId: string;
  warehouseId: string;
}

export interface FashionStagingAcceptanceLease {
  baseline: FashionStagingInventoryBaseline;
  leaseExpiresAt: string;
  namespace: string;
  owner: string;
  runId: string;
}

export interface FashionStagingCleanupResult {
  after: FashionStagingInventoryBaseline;
  journeyFailure: string | null;
  retainedOrderReferences: string[];
  status: "completed" | "failed";
}

interface AcceptanceRunRow {
  baseline_backordered_quantity: number;
  baseline_on_hand_quantity: number;
  baseline_oversell_limit: number;
  baseline_reserved_quantity: number;
  journey_failure: string | null;
  lease_expires_at: string;
  namespace: string;
  owner: string;
  run_id: string;
  status: "acquired" | "running" | "cleanup_pending" | "completed" | "failed";
  variant_id: string;
  warehouse_id: string;
}

interface InventoryRow {
  backordered_quantity: number;
  on_hand_quantity: number;
  oversell_limit: number;
  reserved_quantity: number;
  variant_id: string;
  warehouse_id: string;
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const activeStatuses = new Set(["acquired", "running", "cleanup_pending"]);

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`${label} must be a stable identifier`);
}

function failureText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function inventory(row: InventoryRow): FashionStagingInventoryBaseline {
  return {
    backorderedQuantity: row.backordered_quantity,
    onHandQuantity: row.on_hand_quantity,
    oversellLimit: row.oversell_limit,
    reservedQuantity: row.reserved_quantity,
    variantId: row.variant_id,
    warehouseId: row.warehouse_id,
  };
}

function baseline(row: AcceptanceRunRow): FashionStagingInventoryBaseline {
  return {
    backorderedQuantity: row.baseline_backordered_quantity,
    onHandQuantity: row.baseline_on_hand_quantity,
    oversellLimit: row.baseline_oversell_limit,
    reservedQuantity: row.baseline_reserved_quantity,
    variantId: row.variant_id,
    warehouseId: row.warehouse_id,
  };
}

async function acceptanceRun(db: D1Database, runId: string): Promise<AcceptanceRunRow | null> {
  return db
    .prepare(
      `SELECT run_id, owner, namespace, status, variant_id, warehouse_id,
              baseline_on_hand_quantity, baseline_reserved_quantity,
              baseline_backordered_quantity, baseline_oversell_limit,
              lease_expires_at, journey_failure
         FROM fashion_staging_acceptance_runs
        WHERE run_id = ?`,
    )
    .bind(runId)
    .first<AcceptanceRunRow>();
}

async function inventoryRow(
  db: D1Database,
  variantId: string,
  warehouseId: string,
): Promise<InventoryRow> {
  const row = await db
    .prepare(
      `SELECT variant_id, warehouse_id, on_hand_quantity, reserved_quantity,
              backordered_quantity, oversell_limit
         FROM inventory_items
        WHERE variant_id = ? AND warehouse_id = ?`,
    )
    .bind(variantId, warehouseId)
    .first<InventoryRow>();
  if (!row) throw new Error("fashion_staging_inventory_identity_mismatch");
  return row;
}

function lease(row: AcceptanceRunRow): FashionStagingAcceptanceLease {
  return {
    baseline: baseline(row),
    leaseExpiresAt: row.lease_expires_at,
    namespace: row.namespace,
    owner: row.owner,
    runId: row.run_id,
  };
}

export async function acquireFashionStagingAcceptance(
  db: D1Database,
  input: AcquireFashionStagingAcceptanceInput,
  now = new Date(),
): Promise<FashionStagingAcceptanceLease> {
  if (input.environment !== "fashion-staging") {
    throw new Error("fashion_staging_acceptance_environment_required");
  }
  for (const [label, value] of [
    ["runId", input.runId],
    ["owner", input.owner],
    ["catalogReleaseId", input.catalogReleaseId],
    ["experienceSnapshotId", input.experienceSnapshotId],
    ["variantId", input.variantId],
    ["warehouseId", input.warehouseId],
  ] as const) {
    assertIdentifier(value, label);
  }
  if (!digestPattern.test(input.artifactDigest) || !digestPattern.test(input.seedManifestDigest)) {
    throw new Error("fashion_staging_acceptance_digest_invalid");
  }
  if (!commitPattern.test(input.commitSha)) {
    throw new Error("fashion_staging_acceptance_commit_invalid");
  }
  const leaseMinutes = input.leaseMinutes ?? 90;
  if (!Number.isInteger(leaseMinutes) || leaseMinutes < 5 || leaseMinutes > 240) {
    throw new Error("fashion_staging_acceptance_lease_invalid");
  }
  const existingRun = await acceptanceRun(db, input.runId);
  if (existingRun) {
    if (existingRun.owner !== input.owner || !activeStatuses.has(existingRun.status)) {
      throw new Error("fashion_staging_acceptance_run_conflict");
    }
    return lease(existingRun);
  }
  const active = await db
    .prepare(
      `SELECT run_id, lease_expires_at
         FROM fashion_staging_acceptance_runs
        WHERE environment = 'fashion-staging'
          AND status IN ('acquired', 'running', 'cleanup_pending')
        LIMIT 1`,
    )
    .first<{ lease_expires_at: string; run_id: string }>();
  if (active) {
    const reason =
      Date.parse(active.lease_expires_at) <= now.getTime() ? "reconciliation_required" : "locked";
    throw new Error(`fashion_staging_acceptance_${reason}:${active.run_id}`);
  }
  const before = inventory(await inventoryRow(db, input.variantId, input.warehouseId));
  const minimum = input.minimumSellableQuantity ?? 1;
  if (
    !Number.isInteger(minimum) ||
    minimum < 1 ||
    before.onHandQuantity +
      before.oversellLimit -
      before.reservedQuantity -
      before.backorderedQuantity <
      minimum ||
    before.reservedQuantity !== 0 ||
    before.backorderedQuantity !== 0
  ) {
    throw new Error("fashion_staging_inventory_baseline_not_stable");
  }
  const createdAt = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + leaseMinutes * 60_000).toISOString();
  const namespace = `fashion-u12-${input.runId}`;
  try {
    await db
      .prepare(
        `INSERT INTO fashion_staging_acceptance_runs
           (run_id, environment, owner, namespace, status, catalog_release_id,
            experience_snapshot_id, artifact_digest, commit_sha, seed_manifest_digest,
            variant_id, warehouse_id, baseline_on_hand_quantity,
            baseline_reserved_quantity, baseline_backordered_quantity,
            baseline_oversell_limit, lease_expires_at, before_inventory_json,
            created_at, updated_at)
         VALUES (?, 'fashion-staging', ?, ?, 'acquired', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.runId,
        input.owner,
        namespace,
        input.catalogReleaseId,
        input.experienceSnapshotId,
        input.artifactDigest,
        input.commitSha,
        input.seedManifestDigest,
        input.variantId,
        input.warehouseId,
        before.onHandQuantity,
        before.reservedQuantity,
        before.backorderedQuantity,
        before.oversellLimit,
        leaseExpiresAt,
        JSON.stringify(before),
        createdAt,
        createdAt,
      )
      .run();
  } catch {
    throw new Error("fashion_staging_acceptance_locked");
  }
  return { baseline: before, leaseExpiresAt, namespace, owner: input.owner, runId: input.runId };
}

export async function startFashionStagingAcceptance(
  db: D1Database,
  runId: string,
  owner: string,
  now = new Date(),
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE fashion_staging_acceptance_runs
          SET status = 'running', updated_at = ?
        WHERE run_id = ? AND owner = ? AND status IN ('acquired', 'running')
          AND lease_expires_at > ?`,
    )
    .bind(now.toISOString(), runId, owner, now.toISOString())
    .run();
  if (result.meta.changes !== 1) throw new Error("fashion_staging_acceptance_lease_invalid");
}

export async function registerFashionStagingResource(
  db: D1Database,
  runId: string,
  owner: string,
  resourceType: FashionStagingResourceType,
  resourceId: string,
  now = new Date(),
): Promise<void> {
  assertIdentifier(resourceId, "resourceId");
  const run = await acceptanceRun(db, runId);
  if (!run || run.owner !== owner || !activeStatuses.has(run.status)) {
    throw new Error("fashion_staging_acceptance_lease_invalid");
  }
  await db
    .prepare(
      `INSERT OR IGNORE INTO fashion_staging_acceptance_resources
         (run_id, resource_type, resource_id, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(runId, resourceType, resourceId, now.toISOString())
    .run();
}

async function orderReferenceForAttempt(
  db: D1Database,
  checkoutAttemptId: string,
): Promise<string | null> {
  const order = await db
    .prepare("SELECT public_reference FROM orders WHERE checkout_attempt_id = ?")
    .bind(checkoutAttemptId)
    .first<{ public_reference: string }>();
  return order?.public_reference ?? null;
}

export async function settleFashionStagingTestPayment(
  db: D1Database,
  runId: string,
  owner: string,
  checkoutAttemptId: string,
  provider: StripeTestSettlementProvider,
  now = new Date(),
): Promise<ReconciliationResult> {
  assertIdentifier(checkoutAttemptId, "checkoutAttemptId");
  const attempt = await db
    .prepare(
      `SELECT ca.id, ca.provider_session_id, ca.currency, ca.grand_total_amount
         FROM checkout_attempts ca
         JOIN fashion_staging_acceptance_resources resource
           ON resource.resource_type = 'checkout_attempt'
          AND resource.resource_id = ca.id
         JOIN fashion_staging_acceptance_runs run ON run.run_id = resource.run_id
        WHERE run.run_id = ? AND run.owner = ? AND run.status = 'running'
          AND run.lease_expires_at > ? AND ca.id = ? AND ca.provider = 'stripe'
          AND ca.environment = 'staging' AND ca.test_mode = 1
          AND ca.status IN ('payment_pending', 'completed')
          AND ca.provider_session_id IS NOT NULL`,
    )
    .bind(runId, owner, now.toISOString(), checkoutAttemptId)
    .first<{
      currency: string;
      grand_total_amount: number;
      id: string;
      provider_session_id: string;
    }>();
  if (!attempt) throw new Error("fashion_staging_test_settlement_identity_invalid");
  const existingOrderReference = await orderReferenceForAttempt(db, attempt.id);
  if (existingOrderReference) {
    return { eventResult: "applied", orderReference: existingOrderReference, replayed: true };
  }
  const settled = await provider.settleTestSession({
    amountTotal: attempt.grand_total_amount,
    attemptId: attempt.id,
    currency: attempt.currency,
    sessionId: attempt.provider_session_id,
  });
  if (!settled.paymentId || settled.paymentState !== "approved") {
    throw new Error("fashion_staging_test_settlement_not_approved");
  }
  const event = {
    createdAt: now.toISOString(),
    id: `evt_fashion_u12_${settled.paymentId}`,
    session: settled,
    type: "checkout.payment_succeeded" as const,
  };
  const result = await reconcilePaymentEvent(
    db,
    {
      name: "stripe",
      retrieveSession: async (sessionId) => {
        if (sessionId !== settled.id) {
          throw new Error("fashion_staging_test_settlement_session_mismatch");
        }
        return settled;
      },
    },
    event,
    JSON.stringify({
      checkoutAttemptId: attempt.id,
      paymentId: settled.paymentId,
      providerSessionId: settled.id,
      type: "fashion_staging_test_settlement",
    }),
  );
  if (result.orderReference) return result;
  const orderReference = await orderReferenceForAttempt(db, attempt.id);
  if (!orderReference) throw new Error("fashion_staging_test_settlement_order_missing");
  return { ...result, orderReference };
}

export async function recordFashionStagingJourneyFailure(
  db: D1Database,
  runId: string,
  owner: string,
  error: unknown,
  now = new Date(),
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE fashion_staging_acceptance_runs
          SET journey_failure = ?, updated_at = ?
        WHERE run_id = ? AND owner = ? AND status IN ('acquired', 'running')`,
    )
    .bind(failureText(error), now.toISOString(), runId, owner)
    .run();
  if (result.meta.changes !== 1) throw new Error("fashion_staging_acceptance_lease_invalid");
}

async function cleanupOwnedRun(
  db: D1Database,
  run: AcceptanceRunRow,
  owner: string,
  now: Date,
): Promise<FashionStagingCleanupResult> {
  const at = now.toISOString();
  await db
    .prepare(
      `UPDATE fashion_staging_acceptance_runs
          SET status = 'cleanup_pending', cleanup_started_at = COALESCE(cleanup_started_at, ?),
              updated_at = ?
        WHERE run_id = ? AND owner = ? AND status IN ('acquired', 'running', 'cleanup_pending')`,
    )
    .bind(at, at, run.run_id, owner)
    .run();
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE inventory_reservations
              SET status = 'released', updated_at = ?
            WHERE status = 'active' AND (
              id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                      WHERE run_id = ? AND resource_type = 'reservation')
              OR group_id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                              WHERE run_id = ? AND resource_type = 'reservation_group')
              OR group_id IN (
                SELECT ca.reservation_group_id
                  FROM checkout_attempts ca
                 WHERE ca.id IN (
                   SELECT resource_id FROM fashion_staging_acceptance_resources
                    WHERE run_id = ? AND resource_type = 'checkout_attempt'
                 )
              )
            )`,
        )
        .bind(at, run.run_id, run.run_id, run.run_id),
      db
        .prepare(
          `UPDATE inventory_reservation_groups
              SET status = 'released', updated_at = ?
            WHERE status = 'active'
              AND id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                          WHERE run_id = ? AND resource_type = 'reservation_group')
               OR (status = 'active' AND id IN (
                    SELECT ca.reservation_group_id
                      FROM checkout_attempts ca
                     WHERE ca.id IN (
                       SELECT resource_id FROM fashion_staging_acceptance_resources
                        WHERE run_id = ? AND resource_type = 'checkout_attempt'
                     )
                  ))`,
        )
        .bind(at, run.run_id, run.run_id),
      db
        .prepare(
          `UPDATE checkout_attempts
              SET status = 'expired', provider_status = 'acceptance_cleanup', updated_at = ?
            WHERE status IN ('validating', 'payment_pending')
              AND id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                          WHERE run_id = ? AND resource_type = 'checkout_attempt')
              AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.checkout_attempt_id = checkout_attempts.id)`,
        )
        .bind(at, run.run_id),
      db
        .prepare(
          `UPDATE carts
              SET status = 'expired', updated_at = ?
            WHERE status = 'active'
              AND id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                          WHERE run_id = ? AND resource_type = 'cart')
              AND NOT EXISTS (
                SELECT 1 FROM checkout_attempts ca JOIN orders o ON o.checkout_attempt_id = ca.id
                 WHERE ca.cart_id = carts.id
              )`,
        )
        .bind(at, run.run_id),
    ]);
    const expected = baseline(run);
    const current = inventory(await inventoryRow(db, run.variant_id, run.warehouse_id));
    if (
      current.reservedQuantity !== expected.reservedQuantity ||
      current.backorderedQuantity !== expected.backorderedQuantity ||
      current.oversellLimit !== expected.oversellLimit
    ) {
      throw new Error("fashion_staging_inventory_cleanup_not_reconciled");
    }
    const adjustment = expected.onHandQuantity - current.onHandQuantity;
    if (adjustment !== 0) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO stock_ledger_entries
             (id, variant_id, warehouse_id, quantity_delta, reason, reference_type,
              reference_id, actor_id, created_at)
           VALUES (?, ?, ?, ?, 'Fashion U12 acceptance baseline restore',
                   'manual_adjustment', ?, NULL, ?)`,
        )
        .bind(
          `sl_fashion_u12_${run.run_id}`,
          run.variant_id,
          run.warehouse_id,
          adjustment,
          run.run_id,
          at,
        )
        .run();
    }
    const after = inventory(await inventoryRow(db, run.variant_id, run.warehouse_id));
    if (
      after.onHandQuantity !== expected.onHandQuantity ||
      after.reservedQuantity !== expected.reservedQuantity ||
      after.backorderedQuantity !== expected.backorderedQuantity ||
      after.oversellLimit !== expected.oversellLimit
    ) {
      throw new Error("fashion_staging_inventory_baseline_restore_failed");
    }
    const orders = await db
      .prepare(
        `SELECT DISTINCT o.public_reference
           FROM orders o
           JOIN checkout_attempts ca ON ca.id = o.checkout_attempt_id
          WHERE o.id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                          WHERE run_id = ? AND resource_type = 'order')
             OR ca.id IN (SELECT resource_id FROM fashion_staging_acceptance_resources
                           WHERE run_id = ? AND resource_type = 'checkout_attempt')
          ORDER BY o.public_reference`,
      )
      .bind(run.run_id, run.run_id)
      .all<{ public_reference: string }>();
    const retainedOrderReferences = orders.results.map((row) => row.public_reference);
    const status = run.journey_failure ? "failed" : "completed";
    await db
      .prepare(
        `UPDATE fashion_staging_acceptance_runs
            SET status = ?, after_inventory_json = ?, retained_order_references_json = ?,
                cleanup_failure = NULL, completed_at = ?, updated_at = ?
          WHERE run_id = ? AND owner = ? AND status = 'cleanup_pending'`,
      )
      .bind(
        status,
        JSON.stringify(after),
        JSON.stringify(retainedOrderReferences),
        at,
        at,
        run.run_id,
        owner,
      )
      .run();
    return { after, journeyFailure: run.journey_failure, retainedOrderReferences, status };
  } catch (error) {
    await db
      .prepare(
        `UPDATE fashion_staging_acceptance_runs
            SET cleanup_failure = ?, updated_at = ?
          WHERE run_id = ? AND owner = ? AND status = 'cleanup_pending'`,
      )
      .bind(failureText(error), at, run.run_id, owner)
      .run();
    throw error;
  }
}

export async function cleanupFashionStagingAcceptance(
  db: D1Database,
  runId: string,
  owner: string,
  now = new Date(),
): Promise<FashionStagingCleanupResult> {
  const run = await acceptanceRun(db, runId);
  if (!run || run.owner !== owner || !activeStatuses.has(run.status)) {
    throw new Error("fashion_staging_acceptance_lease_invalid");
  }
  return cleanupOwnedRun(db, run, owner, now);
}

export async function reconcileAbandonedFashionStagingAcceptance(
  db: D1Database,
  runId: string,
  recoveryOwner: string,
  now = new Date(),
): Promise<FashionStagingCleanupResult> {
  assertIdentifier(recoveryOwner, "recoveryOwner");
  const run = await acceptanceRun(db, runId);
  if (!run || !activeStatuses.has(run.status) || Date.parse(run.lease_expires_at) > now.getTime()) {
    throw new Error("fashion_staging_acceptance_not_abandoned");
  }
  const claimed = await db
    .prepare(
      `UPDATE fashion_staging_acceptance_runs
          SET owner = ?, status = 'cleanup_pending', updated_at = ?
        WHERE run_id = ? AND owner = ? AND status IN ('acquired', 'running', 'cleanup_pending')
          AND lease_expires_at <= ?`,
    )
    .bind(recoveryOwner, now.toISOString(), runId, run.owner, now.toISOString())
    .run();
  if (claimed.meta.changes !== 1) throw new Error("fashion_staging_acceptance_recovery_conflict");
  return cleanupOwnedRun(
    db,
    { ...run, owner: recoveryOwner, status: "cleanup_pending" },
    recoveryOwner,
    now,
  );
}
