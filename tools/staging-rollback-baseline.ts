import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COMPONENTS = ["api", "admin", "storefront"] as const;
const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_DB_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const D1_SAFETY_SQL = `
  WITH representative_inventory AS (
    SELECT i.variant_id, i.warehouse_id, i.on_hand_quantity, i.reserved_quantity,
           i.backordered_quantity, i.oversell_limit
      FROM inventory_items i
      JOIN product_variants v ON v.id = i.variant_id
      JOIN products p ON p.id = v.product_id
     WHERE v.sku = 'ATLAS-BLK'
     ORDER BY p.name, v.sku, i.warehouse_id
     LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM d1_migrations) AS applied_migrations,
    (SELECT COUNT(*)
       FROM admin_identities identity
       JOIN admin_roles role ON role.id = identity.role_id
      WHERE identity.principal_kind = 'human'
        AND identity.enabled = 1
        AND role.enabled = 1
        AND role.protected = 1) AS enabled_protected_admins,
    (SELECT COUNT(*)
       FROM admin_identities identity
       JOIN admin_roles role ON role.id = identity.role_id
       JOIN admin_password_credentials credential ON credential.identity_id = identity.id
      WHERE identity.principal_kind = 'human'
        AND identity.enabled = 1
        AND role.enabled = 1
        AND role.protected = 1
        AND credential.password_version > 0) AS credentialed_protected_admins,
    (SELECT variant_id FROM representative_inventory) AS representative_variant_id,
    (SELECT warehouse_id FROM representative_inventory) AS representative_warehouse_id,
    (SELECT on_hand_quantity FROM representative_inventory) AS representative_on_hand,
    (SELECT reserved_quantity FROM representative_inventory) AS representative_reserved,
    (SELECT backordered_quantity FROM representative_inventory) AS representative_backordered,
    (SELECT oversell_limit FROM representative_inventory) AS representative_oversell_limit
`;

type Component = (typeof COMPONENTS)[number];

export interface NormalizedDeployment {
  percentage: 100;
  versionId: string;
}

export interface D1Safety {
  appliedMigrations: number;
  credentialedProtectedAdmins: number;
  enabledProtectedAdmins: number;
  representativeInventory: {
    backordered: number;
    onHand: number;
    oversellLimit: number;
    reserved: number;
    variantId: string;
    warehouseId: string;
  };
}

export interface StagingBaseline {
  d1: D1Safety;
  github: { runAttempt: number; runId: string };
  releaseId: string;
  schemaVersion: 1;
  sourceSha: string;
  workers: Record<Component, string>;
}

export interface ProofHistory {
  activeCarts: number;
  activeReservationGroups: number;
  activeReservations: number;
  checkoutAttempts: number;
  fulfillmentEvents: number;
  nonterminalCheckoutAttempts: number;
  orders: number;
  paymentEvents: number;
  refunds: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${label} is invalid`,
  );
  return value as Record<string, unknown>;
}

function integer(value: unknown, label: string): number {
  const result = typeof value === "number" ? value : Number(value);
  assert(Number.isSafeInteger(result) && result >= 0, `${label} is invalid`);
  return result;
}

export function normalizeDeployment(value: unknown, label: string): NormalizedDeployment {
  const versions = record(value, `${label} deployment`).versions;
  assert(
    Array.isArray(versions) && versions.length === 1,
    `${label} must serve exactly one version`,
  );
  const version = record(versions[0], `${label} deployment version`);
  assert(
    integer(version.percentage, `${label} traffic percentage`) === 100,
    `${label} must serve 100 percent from its baseline version`,
  );
  assert(
    typeof version.version_id === "string" && VERSION_ID.test(version.version_id),
    `${label} version ID is invalid`,
  );
  return { percentage: 100, versionId: version.version_id };
}

export function normalizeD1Safety(value: unknown): D1Safety {
  assert(Array.isArray(value), "D1 response is invalid");
  const firstEnvelope = record(value[0], "D1 response envelope");
  assert(
    Array.isArray(firstEnvelope.results) && firstEnvelope.results.length > 0,
    "D1 safety result is missing",
  );
  const row = record(firstEnvelope.results[0], "D1 safety row");
  const result = {
    appliedMigrations: integer(row.applied_migrations, "D1 applied migration count"),
    credentialedProtectedAdmins: integer(
      row.credentialed_protected_admins,
      "D1 credentialed protected administrator count",
    ),
    enabledProtectedAdmins: integer(
      row.enabled_protected_admins,
      "D1 enabled protected administrator count",
    ),
    representativeInventory: {
      backordered: integer(row.representative_backordered, "representative backordered inventory"),
      onHand: integer(row.representative_on_hand, "representative on-hand inventory"),
      oversellLimit: integer(
        row.representative_oversell_limit,
        "representative oversell inventory",
      ),
      reserved: integer(row.representative_reserved, "representative reserved inventory"),
      variantId: String(row.representative_variant_id ?? ""),
      warehouseId: String(row.representative_warehouse_id ?? ""),
    },
  };
  assert(result.enabledProtectedAdmins > 0, "D1 has no enabled protected administrator");
  assert(result.credentialedProtectedAdmins > 0, "D1 has no credentialed protected administrator");
  assert(
    SAFE_DB_ID.test(result.representativeInventory.variantId),
    "representative variant is invalid",
  );
  assert(
    SAFE_DB_ID.test(result.representativeInventory.warehouseId),
    "representative warehouse is invalid",
  );
  return result;
}

export function buildStagingBaseline(input: {
  d1: D1Safety;
  deployments: Record<Component, NormalizedDeployment>;
  releaseId: string;
  runAttempt: number;
  runId: string;
  sourceSha: string;
}): StagingBaseline {
  assert(SAFE_ID.test(input.releaseId), "release ID is invalid");
  assert(SAFE_ID.test(input.runId), "GitHub run ID is invalid");
  assert(
    Number.isSafeInteger(input.runAttempt) && input.runAttempt > 0,
    "GitHub run attempt is invalid",
  );
  assert(SHA.test(input.sourceSha), "source SHA is invalid");
  return {
    d1: input.d1,
    github: { runAttempt: input.runAttempt, runId: input.runId },
    releaseId: input.releaseId,
    schemaVersion: 1,
    sourceSha: input.sourceSha,
    workers: Object.fromEntries(
      COMPONENTS.map((component) => [component, input.deployments[component].versionId]),
    ) as Record<Component, string>,
  };
}

export function verifyStagingBaseline(
  baseline: StagingBaseline,
  actual: {
    d1: D1Safety;
    deployments: Record<Component, NormalizedDeployment>;
    foreignKeyCheckPassed: boolean;
  },
): void {
  assert(actual.foreignKeyCheckPassed, "D1 foreign key check failed");
  assert(
    JSON.stringify(actual.d1) === JSON.stringify(baseline.d1),
    "D1 safety baseline was not restored",
  );
  for (const component of COMPONENTS) {
    assert(
      actual.deployments[component].versionId === baseline.workers[component],
      `${component} Worker baseline was not restored`,
    );
  }
}

export function verifyBaselineIdentity(
  baseline: StagingBaseline,
  expected: { releaseId: string; runAttempt: number; runId: string; sourceSha: string },
): void {
  assert(baseline.releaseId === expected.releaseId, "staging baseline release identity mismatch");
  assert(
    baseline.github.runAttempt === expected.runAttempt,
    "staging baseline run attempt mismatch",
  );
  assert(baseline.github.runId === expected.runId, "staging baseline run identity mismatch");
  assert(baseline.sourceSha === expected.sourceSha, "staging baseline source identity mismatch");
}

export function assertNoPendingMigrations(output: string): void {
  assert(
    !output.includes("Migrations to be applied:"),
    "staging rollback rehearsal refused because D1 has pending migrations",
  );
  assert(
    output.includes("No migrations to apply!"),
    "staging rollback rehearsal refused because the D1 migration result is unrecognized",
  );
}

export function normalizeProofHistory(value: unknown): ProofHistory {
  assert(Array.isArray(value), "proof history response is invalid");
  const envelope = record(value[0], "proof history response envelope");
  assert(
    Array.isArray(envelope.results) && envelope.results.length > 0,
    "proof history is missing",
  );
  const row = record(envelope.results[0], "proof history row");
  const result = {
    activeCarts: integer(row.active_carts, "active proof cart count"),
    activeReservationGroups: integer(
      row.active_reservation_groups,
      "active proof reservation group count",
    ),
    activeReservations: integer(row.active_reservations, "active proof reservation count"),
    checkoutAttempts: integer(row.checkout_attempts, "proof checkout attempt count"),
    fulfillmentEvents: integer(row.fulfillment_events, "proof fulfillment event count"),
    nonterminalCheckoutAttempts: integer(
      row.nonterminal_checkout_attempts,
      "nonterminal proof checkout attempt count",
    ),
    orders: integer(row.orders, "proof order count"),
    paymentEvents: integer(row.payment_events, "proof payment event count"),
    refunds: integer(row.refunds, "proof refund count"),
  };
  assert(result.activeReservations === 0, "staging proof left an active inventory reservation");
  assert(result.activeReservationGroups === 0, "staging proof left an active reservation group");
  assert(result.nonterminalCheckoutAttempts === 0, "staging proof left a nonterminal checkout");
  assert(result.activeCarts === 0, "staging proof left an active cart");
  return result;
}

function wranglerJson(component: Component, args: string[]): unknown {
  const result = spawnSync("bunx", ["wrangler", ...args], {
    cwd: resolve(ROOT, "apps", component),
    encoding: "utf8",
    env: process.env,
  });
  assert(
    result.status === 0,
    result.stderr.trim() || `wrangler ${args[0]} failed for ${component}`,
  );
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`wrangler ${args[0]} returned invalid JSON for ${component}`);
  }
}

function deployments(): Record<Component, NormalizedDeployment> {
  return Object.fromEntries(
    COMPONENTS.map((component) => [
      component,
      normalizeDeployment(
        wranglerJson(component, ["deployments", "status", "--env", "staging", "--json"]),
        component,
      ),
    ]),
  ) as Record<Component, NormalizedDeployment>;
}

function d1Safety(): D1Safety {
  return normalizeD1Safety(
    wranglerJson("api", [
      "d1",
      "execute",
      "shoppp-staging",
      "--env",
      "staging",
      "--remote",
      "--json",
      "--command",
      D1_SAFETY_SQL,
    ]),
  );
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function reconcileD1(baseline: StagingBaseline, buyerEmail: string): void {
  assert(SAFE_EMAIL.test(buyerEmail), "staging proof buyer email is invalid");
  const inventory = baseline.d1.representativeInventory;
  assert(SAFE_DB_ID.test(inventory.variantId), "representative variant is invalid");
  assert(SAFE_DB_ID.test(inventory.warehouseId), "representative warehouse is invalid");
  wranglerJson("api", [
    "d1",
    "execute",
    "shoppp-staging",
    "--env",
    "staging",
    "--remote",
    "--json",
    "--command",
    `UPDATE inventory_reservations
        SET status = 'released', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE status = 'active'
        AND group_id IN (
          SELECT reservation_group_id FROM checkout_attempts
           WHERE lower(email) = lower(${sqlString(buyerEmail)})
        );
      UPDATE inventory_reservation_groups
         SET status = 'released', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status = 'active'
         AND id IN (
           SELECT reservation_group_id FROM checkout_attempts
            WHERE lower(email) = lower(${sqlString(buyerEmail)})
         );
      UPDATE checkout_attempts
         SET status = 'expired', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status IN ('validating', 'payment_pending')
         AND lower(email) = lower(${sqlString(buyerEmail)});
      UPDATE carts
         SET status = 'expired', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status = 'active'
         AND id IN (
           SELECT cart_id FROM checkout_attempts
            WHERE lower(email) = lower(${sqlString(buyerEmail)})
         )`,
  ]);
  const current = d1Safety();
  assert(
    current.appliedMigrations === baseline.d1.appliedMigrations &&
      current.enabledProtectedAdmins === baseline.d1.enabledProtectedAdmins &&
      current.credentialedProtectedAdmins === baseline.d1.credentialedProtectedAdmins,
    "D1 authority changed during staging proof",
  );
  assert(
    current.representativeInventory.variantId === inventory.variantId &&
      current.representativeInventory.warehouseId === inventory.warehouseId &&
      current.representativeInventory.reserved === inventory.reserved &&
      current.representativeInventory.backordered === inventory.backordered &&
      current.representativeInventory.oversellLimit === inventory.oversellLimit,
    "representative inventory cannot be safely reconciled",
  );
  const quantityDelta = inventory.onHand - current.representativeInventory.onHand;
  if (quantityDelta !== 0) {
    const referenceId = `staging_rollback_${baseline.github.runId}_${baseline.github.runAttempt}`;
    wranglerJson("api", [
      "d1",
      "execute",
      "shoppp-staging",
      "--env",
      "staging",
      "--remote",
      "--json",
      "--command",
      `INSERT INTO stock_ledger_entries
        (id, variant_id, warehouse_id, quantity_delta, reason, reference_type,
         reference_id, actor_id, created_at)
       VALUES
        ('sl_' || lower(hex(randomblob(16))), ${sqlString(inventory.variantId)},
         ${sqlString(inventory.warehouseId)}, ${quantityDelta},
         'Staging rollback rehearsal reconciliation', 'manual_adjustment',
         ${sqlString(referenceId)}, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    ]);
  }
}

function foreignKeyCheckPassed(): boolean {
  const value = wranglerJson("api", [
    "d1",
    "execute",
    "shoppp-staging",
    "--env",
    "staging",
    "--remote",
    "--json",
    "--command",
    "PRAGMA foreign_key_check",
  ]);
  assert(Array.isArray(value) && value.length > 0, "D1 foreign key response is invalid");
  return value.every((entry) => {
    const results = record(entry, "D1 foreign key response envelope").results;
    return Array.isArray(results) && results.length === 0;
  });
}

function proofHistory(buyerEmail: string): ProofHistory {
  assert(SAFE_EMAIL.test(buyerEmail), "staging proof buyer email is invalid");
  return normalizeProofHistory(
    wranglerJson("api", [
      "d1",
      "execute",
      "shoppp-staging",
      "--env",
      "staging",
      "--remote",
      "--json",
      "--command",
      `WITH matching_attempts AS (
         SELECT id, reservation_group_id FROM checkout_attempts
          WHERE lower(email) = lower(${sqlString(buyerEmail)})
       ), matching_orders AS (
         SELECT id FROM orders WHERE lower(email) = lower(${sqlString(buyerEmail)})
       )
       SELECT
         (SELECT COUNT(*) FROM matching_attempts) AS checkout_attempts,
         (SELECT COUNT(*) FROM checkout_attempts
           WHERE status IN ('validating', 'payment_pending')
             AND id IN (SELECT id FROM matching_attempts)) AS nonterminal_checkout_attempts,
         (SELECT COUNT(*) FROM matching_orders) AS orders,
         (SELECT COUNT(*) FROM payment_events
           WHERE checkout_attempt_id IN (SELECT id FROM matching_attempts)
              OR order_id IN (SELECT id FROM matching_orders)) AS payment_events,
         (SELECT COUNT(*) FROM refunds
           WHERE order_id IN (SELECT id FROM matching_orders)) AS refunds,
         (SELECT COUNT(*) FROM fulfillment_events
           WHERE order_id IN (SELECT id FROM matching_orders)) AS fulfillment_events,
         (SELECT COUNT(*) FROM inventory_reservations
           WHERE status = 'active'
             AND group_id IN (SELECT reservation_group_id FROM matching_attempts))
           AS active_reservations,
         (SELECT COUNT(*) FROM inventory_reservation_groups
           WHERE status = 'active'
             AND id IN (SELECT reservation_group_id FROM matching_attempts))
           AS active_reservation_groups,
         (SELECT COUNT(*) FROM carts
           WHERE status = 'active'
             AND id IN (SELECT cart_id FROM checkout_attempts
                          WHERE id IN (SELECT id FROM matching_attempts))) AS active_carts`,
    ]),
  );
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((candidate) => candidate.startsWith(prefix))
    ?.slice(prefix.length);
  assert(value, `missing ${prefix}<value>`);
  return value;
}

function readBaseline(path: string): StagingBaseline {
  const value = JSON.parse(readFileSync(path, "utf8")) as StagingBaseline;
  assert(value.schemaVersion === 1, "staging baseline schema is invalid");
  assert(SAFE_ID.test(value.releaseId), "staging baseline release identity is invalid");
  assert(SAFE_ID.test(value.github?.runId), "staging baseline run identity is invalid");
  assert(
    Number.isSafeInteger(value.github?.runAttempt) && value.github.runAttempt > 0,
    "staging baseline run attempt is invalid",
  );
  assert(SHA.test(value.sourceSha), "staging baseline source identity is invalid");
  assert(
    COMPONENTS.every((component) => VERSION_ID.test(value.workers?.[component] ?? "")),
    "staging baseline Worker identity is invalid",
  );
  normalizeD1Safety([
    {
      results: [
        {
          applied_migrations: value.d1?.appliedMigrations,
          credentialed_protected_admins: value.d1?.credentialedProtectedAdmins,
          enabled_protected_admins: value.d1?.enabledProtectedAdmins,
          representative_backordered: value.d1?.representativeInventory?.backordered,
          representative_on_hand: value.d1?.representativeInventory?.onHand,
          representative_oversell_limit: value.d1?.representativeInventory?.oversellLimit,
          representative_reserved: value.d1?.representativeInventory?.reserved,
          representative_variant_id: value.d1?.representativeInventory?.variantId,
          representative_warehouse_id: value.d1?.representativeInventory?.warehouseId,
        },
      ],
    },
  ]);
  return value;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function main(): void {
  const mode = process.argv[2];
  if (mode === "check-migrations") {
    assertNoPendingMigrations(readFileSync(0, "utf8"));
    return;
  }
  if (mode === "capture") {
    const output = argument("output");
    writeJson(
      output,
      buildStagingBaseline({
        d1: d1Safety(),
        deployments: deployments(),
        releaseId: argument("release-id"),
        runAttempt: integer(argument("run-attempt"), "GitHub run attempt"),
        runId: argument("run-id"),
        sourceSha: argument("source-sha"),
      }),
    );
    return;
  }
  if (mode === "validate") {
    const baseline = readBaseline(argument("baseline"));
    verifyBaselineIdentity(baseline, {
      releaseId: argument("release-id"),
      runAttempt: integer(argument("run-attempt"), "GitHub run attempt"),
      runId: argument("run-id"),
      sourceSha: argument("source-sha"),
    });
    return;
  }
  if (mode === "reconcile") {
    const baseline = readBaseline(argument("baseline"));
    verifyBaselineIdentity(baseline, {
      releaseId: argument("release-id"),
      runAttempt: integer(argument("run-attempt"), "GitHub run attempt"),
      runId: argument("run-id"),
      sourceSha: argument("source-sha"),
    });
    reconcileD1(baseline, argument("buyer-email"));
    return;
  }
  if (mode === "verify") {
    const baseline = readBaseline(argument("baseline"));
    verifyBaselineIdentity(baseline, {
      releaseId: argument("release-id"),
      runAttempt: integer(argument("run-attempt"), "GitHub run attempt"),
      runId: argument("run-id"),
      sourceSha: argument("source-sha"),
    });
    const actual = {
      d1: d1Safety(),
      deployments: deployments(),
      foreignKeyCheckPassed: foreignKeyCheckPassed(),
      proofHistory: proofHistory(argument("buyer-email")),
    };
    verifyStagingBaseline(baseline, actual);
    writeJson(argument("output"), {
      d1: actual.d1,
      foreignKeyCheck: "passed",
      retainedProofHistory: actual.proofHistory,
      safetyProjectionRestored: true,
      workers: actual.deployments,
    });
    return;
  }
  throw new Error(
    "usage: staging-rollback-baseline.ts <capture|check-migrations|reconcile|validate|verify> [options]",
  );
}

if (import.meta.main) main();
