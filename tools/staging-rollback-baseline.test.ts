import { describe, expect, test } from "bun:test";

import {
  assertNoPendingMigrations,
  buildStagingBaseline,
  normalizeD1Safety,
  normalizeDeployment,
  normalizeProofHistory,
  verifyBaselineIdentity,
  verifyStagingBaseline,
} from "./staging-rollback-baseline";

const versionId = "11111111-2222-4333-8444-555555555555";

describe("staging rollback baseline", () => {
  test("accepts only the pinned no-pending-migrations result", () => {
    expect(() => assertNoPendingMigrations("No migrations to apply!\n")).not.toThrow();
    expect(() =>
      assertNoPendingMigrations("Migrations to be applied:\n0023_pending.sql\n"),
    ).toThrow(/pending migrations/i);
    expect(() => assertNoPendingMigrations("Unexpected Wrangler output\n")).toThrow(
      /unrecognized/i,
    );
    expect(() =>
      assertNoPendingMigrations("No migrations to apply!\nMigrations to be applied:\n0023.sql"),
    ).toThrow(/pending migrations/i);
  });

  test("classifies durable proof history and refuses active reservation residue", () => {
    const row = {
      active_carts: 0,
      active_reservation_groups: 0,
      active_reservations: 0,
      checkout_attempts: 1,
      fulfillment_events: 1,
      nonterminal_checkout_attempts: 0,
      orders: 1,
      payment_events: 2,
      refunds: 1,
    };
    expect(normalizeProofHistory([{ results: [row] }])).toEqual({
      activeCarts: 0,
      activeReservationGroups: 0,
      activeReservations: 0,
      checkoutAttempts: 1,
      fulfillmentEvents: 1,
      nonterminalCheckoutAttempts: 0,
      orders: 1,
      paymentEvents: 2,
      refunds: 1,
    });
    expect(() =>
      normalizeProofHistory([{ results: [{ ...row, active_reservations: 1 }] }]),
    ).toThrow(/active inventory reservation/i);
    expect(() =>
      normalizeProofHistory([{ results: [{ ...row, active_reservation_groups: 1 }] }]),
    ).toThrow(/active reservation group/i);
    expect(() =>
      normalizeProofHistory([{ results: [{ ...row, nonterminal_checkout_attempts: 1 }] }]),
    ).toThrow(/nonterminal checkout/i);
    expect(() => normalizeProofHistory([{ results: [{ ...row, active_carts: 1 }] }])).toThrow(
      /active cart/i,
    );
  });

  test("normalizes a single exact 100 percent deployment", () => {
    expect(
      normalizeDeployment({ versions: [{ percentage: 100, version_id: versionId }] }, "api"),
    ).toEqual({ percentage: 100, versionId });
  });

  test("refuses split traffic and malformed version identity", () => {
    expect(() =>
      normalizeDeployment(
        {
          versions: [
            { percentage: 50, version_id: versionId },
            { percentage: 50, version_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
          ],
        },
        "api",
      ),
    ).toThrow(/exactly one version/i);
    expect(() =>
      normalizeDeployment({ versions: [{ percentage: 100, version_id: "not-a-uuid" }] }, "api"),
    ).toThrow(/version ID/i);
  });

  test("normalizes the D1 safety projection and refuses missing protected access", () => {
    expect(
      normalizeD1Safety([
        {
          results: [
            {
              applied_migrations: 22,
              credentialed_protected_admins: 1,
              enabled_protected_admins: 1,
              representative_backordered: 0,
              representative_on_hand: 5,
              representative_oversell_limit: 0,
              representative_reserved: 0,
              representative_variant_id: "variant_atlas_black",
              representative_warehouse_id: "warehouse_primary",
            },
          ],
        },
      ]),
    ).toEqual({
      appliedMigrations: 22,
      credentialedProtectedAdmins: 1,
      enabledProtectedAdmins: 1,
      representativeInventory: {
        backordered: 0,
        onHand: 5,
        oversellLimit: 0,
        reserved: 0,
        variantId: "variant_atlas_black",
        warehouseId: "warehouse_primary",
      },
    });
    expect(() =>
      normalizeD1Safety([
        {
          results: [
            {
              applied_migrations: 22,
              credentialed_protected_admins: 0,
              enabled_protected_admins: 1,
              representative_backordered: 0,
              representative_on_hand: 5,
              representative_oversell_limit: 0,
              representative_reserved: 0,
              representative_variant_id: "variant_atlas_black",
              representative_warehouse_id: "warehouse_primary",
            },
          ],
        },
      ]),
    ).toThrow(/credentialed protected administrator/i);
  });

  test("binds capture identity and verifies exact Worker and D1 restoration", () => {
    const deployment = { percentage: 100 as const, versionId };
    const d1 = {
      appliedMigrations: 22,
      credentialedProtectedAdmins: 1,
      enabledProtectedAdmins: 1,
      representativeInventory: {
        backordered: 0,
        onHand: 5,
        oversellLimit: 0,
        reserved: 0,
        variantId: "variant_atlas_black",
        warehouseId: "warehouse_primary",
      },
    };
    const baseline = buildStagingBaseline({
      d1,
      deployments: { admin: deployment, api: deployment, storefront: deployment },
      releaseId: "release-1",
      runAttempt: 2,
      runId: "123",
      sourceSha: "a".repeat(40),
    });

    expect(() =>
      verifyStagingBaseline(baseline, {
        d1,
        deployments: { admin: deployment, api: deployment, storefront: deployment },
        foreignKeyCheckPassed: true,
      }),
    ).not.toThrow();
    expect(() =>
      verifyStagingBaseline(baseline, {
        d1: { ...d1, appliedMigrations: 23 },
        deployments: { admin: deployment, api: deployment, storefront: deployment },
        foreignKeyCheckPassed: true,
      }),
    ).toThrow(/D1 safety baseline/i);
    expect(() =>
      verifyStagingBaseline(baseline, {
        d1,
        deployments: { admin: deployment, api: deployment, storefront: deployment },
        foreignKeyCheckPassed: false,
      }),
    ).toThrow(/foreign key check failed/i);
    for (const component of ["api", "admin", "storefront"] as const) {
      expect(() =>
        verifyStagingBaseline(baseline, {
          d1,
          deployments: {
            admin: deployment,
            api: deployment,
            storefront: deployment,
            [component]: {
              percentage: 100,
              versionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            },
          },
          foreignKeyCheckPassed: true,
        }),
      ).toThrow(new RegExp(`${component} Worker baseline was not restored`, "i"));
    }
    const identity = {
      releaseId: "release-1",
      runAttempt: 2,
      runId: "123",
      sourceSha: "a".repeat(40),
    };
    for (const [field, value, message] of [
      ["releaseId", "release-2", /release identity mismatch/i],
      ["runAttempt", 3, /run attempt mismatch/i],
      ["runId", "456", /run identity mismatch/i],
      ["sourceSha", "b".repeat(40), /source identity mismatch/i],
    ] as const) {
      expect(() => verifyBaselineIdentity(baseline, { ...identity, [field]: value })).toThrow(
        message,
      );
    }
  });
});
