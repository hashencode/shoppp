import { env } from "cloudflare:workers";
import { describe, expect, test, vi } from "vitest";

import {
  acquireFashionStagingAcceptance,
  cleanupFashionStagingAcceptance,
  reconcileAbandonedFashionStagingAcceptance,
  recordFashionStagingJourneyFailure,
  registerFashionStagingResource,
  startFashionStagingAcceptance,
} from "../../src/testing/fashion-staging";
import { createApp } from "../../src/http/app";

const startedAt = new Date("2026-08-17T10:00:00.000Z");

function ids(scope: string) {
  return {
    owner: `owner-${scope}`,
    product: `product-${scope}`,
    run: `run-${scope}`,
    variant: `variant-${scope}`,
    warehouse: `warehouse-${scope}`,
  };
}

async function seedInventory(scope: string, onHand = 4) {
  const value = ids(scope);
  const at = startedAt.toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO products
         (id, slug, name, description, status, seo_title, seo_description,
          published_at, created_at, updated_at)
       VALUES (?, ?, 'Fashion acceptance product', '', 'published', '', '', ?, ?, ?)`,
    ).bind(value.product, value.product, at, at, at),
    env.DB.prepare(
      `INSERT INTO product_variants
         (id, product_id, sku, title, option_values_json, weight_grams,
          length_mm, width_mm, height_mm, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Default', '{}', 0, 0, 0, 0, 'active', ?, ?)`,
    ).bind(value.variant, value.product, `SKU-${scope}`, at, at),
    env.DB.prepare(
      `INSERT INTO warehouses (id, code, name, created_at)
       VALUES (?, ?, 'Fashion acceptance warehouse', ?)`,
    ).bind(value.warehouse, `WH-${scope}`, at),
    env.DB.prepare(
      `INSERT INTO inventory_items
         (variant_id, warehouse_id, on_hand_quantity, reserved_quantity,
          backordered_quantity, oversell_limit, version, updated_at)
       VALUES (?, ?, ?, 0, 0, 0, 0, ?)`,
    ).bind(value.variant, value.warehouse, onHand, at),
  ]);
  return value;
}

function input(value: ReturnType<typeof ids>) {
  return {
    artifactDigest: "a".repeat(64),
    catalogReleaseId: `release-${value.run}`,
    commitSha: "b".repeat(40),
    environment: "fashion-staging" as const,
    experienceSnapshotId: `snapshot-${value.run}`,
    leaseMinutes: 5,
    owner: value.owner,
    runId: value.run,
    seedManifestDigest: "c".repeat(64),
    variantId: value.variant,
    warehouseId: value.warehouse,
  };
}

describe.sequential("Fashion staging acceptance lifecycle", () => {
  test("keeps the lifecycle endpoint unavailable outside the exact protected environment", async () => {
    const app = createApp();
    const request = () =>
      new Request("https://api.example.test/internal/testing/fashion-staging/runs", {
        body: "{}",
        headers: { Authorization: `Bearer ${"t".repeat(40)}`, "Content-Type": "application/json" },
        method: "POST",
      });
    const ordinaryStaging = await app.fetch(request(), {
      ...env,
      FASHION_ACCEPTANCE_TOKEN: "t".repeat(40),
      RESOURCE_NAMESPACE: "shoppp-staging",
    });
    expect(ordinaryStaging.status).toBe(404);
    const missingSecret = await app.fetch(request(), {
      ...env,
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
    });
    expect(missingSecret.status).toBe(404);
    const wrongSecret = await app.fetch(request(), {
      ...env,
      FASHION_ACCEPTANCE_TOKEN: "x".repeat(40),
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
    });
    expect(wrongSecret.status).toBe(401);
  });

  test("accepts a stable non-production identity through the protected HTTP boundary", async () => {
    const value = await seedInventory("http");
    const app = createApp();
    const token = "t".repeat(40);
    const { environment: _environment, ...body } = input(value);
    const response = await app.fetch(
      new Request("https://api.example.test/internal/testing/fashion-staging/runs", {
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      }),
      {
        ...env,
        FASHION_ACCEPTANCE_TOKEN: token,
        RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { namespace: `fashion-u12-${value.run}`, runId: value.run },
    });
    await cleanupFashionStagingAcceptance(env.DB, value.run, value.owner);
  });

  test("settles only a registered Fashion checkout through the protected Stripe test boundary", async () => {
    const value = await seedInventory("settle");
    const settlementStartedAt = new Date();
    const at = settlementStartedAt.toISOString();
    const expiresAt = new Date(settlementStartedAt.getTime() + 60 * 60_000).toISOString();
    const cart = "cart-settle";
    const group = "reservation-group-settle";
    const reservation = "reservation-settle";
    const attempt = "chk_fashion_settle_001";
    const providerSession = "cs_test_fashion_settle_001";
    const snapshot = {
      currency: "USD",
      email: "settle@example.test",
      lines: [
        {
          currency: "USD",
          discountAmount: 0,
          lineTotalAmount: 12900,
          optionValues: { Style: "Standard" },
          productId: value.product,
          productName: "Atlas Carry-on",
          quantity: 1,
          sku: "ATLAS-SETTLE",
          taxAmount: 0,
          unitPriceAmount: 12900,
          variantId: value.variant,
          variantName: "Standard",
        },
      ],
      shippingAddress: {
        city: "San Francisco",
        countryCode: "US",
        line1: "100 Market Street",
        name: "Fashion Buyer",
        postalCode: "94105",
        region: "CA",
      },
      shippingMethod: { amount: 0, id: "ship_fashion_free", name: "Free shipping" },
      totals: {
        discountTotal: 0,
        grandTotal: 12900,
        shippingTotal: 0,
        subtotal: 12900,
        taxTotal: 0,
      },
    };
    await acquireFashionStagingAcceptance(env.DB, input(value), settlementStartedAt);
    await startFashionStagingAcceptance(env.DB, value.run, value.owner, settlementStartedAt);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO carts
           (id, public_token_hash, currency, status, expires_at, created_at, updated_at)
         VALUES (?, 'token-settle', 'USD', 'active', ?, ?, ?)`,
      ).bind(cart, expiresAt, at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservation_groups
           (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
         VALUES (?, ?, 'reservation-key-settle', 'active', ?, ?, ?)`,
      ).bind(group, cart, expiresAt, at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservations
           (id, group_id, cart_id, variant_id, warehouse_id, quantity, status,
            expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)`,
      ).bind(reservation, group, cart, value.variant, value.warehouse, expiresAt, at, at),
      env.DB.prepare(
        `INSERT INTO checkout_attempts
           (id, cart_id, reservation_group_id, provider, provider_session_id,
            environment, test_mode, idempotency_key, currency, subtotal_amount,
            discount_amount, shipping_amount, tax_amount, grand_total_amount,
            shipping_address_json, email, snapshot_json, guest_access_token_hash,
            guest_access_expires_at, status, created_at, updated_at)
         VALUES (?, ?, ?, 'stripe', ?, 'staging', 1, 'checkout-key-settle', 'USD',
                 12900, 0, 0, 0, 12900, ?, 'settle@example.test', ?, 'guest-settle',
                 ?, 'payment_pending', ?, ?)`,
      ).bind(
        attempt,
        cart,
        group,
        providerSession,
        JSON.stringify(snapshot.shippingAddress),
        JSON.stringify(snapshot),
        expiresAt,
        at,
        at,
      ),
    ]);
    await registerFashionStagingResource(
      env.DB,
      value.run,
      value.owner,
      "checkout_attempt",
      attempt,
      settlementStartedAt,
    );
    const settleTestSession = vi.fn(async () => ({
      amountTotal: 12900,
      attemptId: attempt,
      createdAt: at,
      currency: "USD",
      expiresAt: "2026-08-18T10:00:00.000Z",
      id: providerSession,
      paymentId: "pi_fashion_settle_001",
      paymentState: "approved" as const,
    }));
    const app = createApp({
      fashionTestSettlementProvider: { settleTestSession },
    });
    const token = "t".repeat(40);
    const response = await app.fetch(
      new Request(
        `https://api.example.test/internal/testing/fashion-staging/runs/${value.run}/settle`,
        {
          body: JSON.stringify({ checkoutAttemptId: attempt, owner: value.owner }),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          method: "POST",
        },
      ),
      {
        ...env,
        FASHION_ACCEPTANCE_TOKEN: token,
        RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { orderReference: expect.stringMatching(/^ORD-/), replayed: false },
    });
    const replay = await app.fetch(
      new Request(
        `https://api.example.test/internal/testing/fashion-staging/runs/${value.run}/settle`,
        {
          body: JSON.stringify({ checkoutAttemptId: attempt, owner: value.owner }),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          method: "POST",
        },
      ),
      {
        ...env,
        FASHION_ACCEPTANCE_TOKEN: token,
        RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      },
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      data: { orderReference: expect.stringMatching(/^ORD-/), replayed: true },
    });
    expect(settleTestSession).toHaveBeenCalledWith({
      amountTotal: 12900,
      attemptId: attempt,
      currency: "USD",
      sessionId: providerSession,
    });
    expect(settleTestSession).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        "SELECT payment_status, order_status, provider_payment_id FROM orders WHERE checkout_attempt_id = ?",
      )
        .bind(attempt)
        .first(),
    ).toEqual({
      order_status: "confirmed",
      payment_status: "paid",
      provider_payment_id: "pi_fashion_settle_001",
    });
    await cleanupFashionStagingAcceptance(env.DB, value.run, value.owner);
  });

  test("acquires one environment lock, captures the baseline, and releases it after cleanup", async () => {
    const value = await seedInventory("lock");
    const acquired = await acquireFashionStagingAcceptance(env.DB, input(value), startedAt);
    expect(acquired).toMatchObject({
      baseline: { onHandQuantity: 4, reservedQuantity: 0 },
      namespace: `fashion-u12-${value.run}`,
      runId: value.run,
    });
    await expect(
      acquireFashionStagingAcceptance(
        env.DB,
        { ...input(value), owner: "owner-conflict", runId: "run-conflict" },
        startedAt,
      ),
    ).rejects.toThrow(/fashion_staging_acceptance_locked/);

    await startFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    await expect(
      cleanupFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt),
    ).resolves.toMatchObject({ status: "completed", retainedOrderReferences: [] });
  });

  test("expires only registered mutable state and preserves journey and cleanup verdicts separately", async () => {
    const value = await seedInventory("cleanup", 3);
    const at = startedAt.toISOString();
    const cart = "cart-cleanup";
    const group = "reservation-group-cleanup";
    const reservation = "reservation-cleanup";
    await acquireFashionStagingAcceptance(env.DB, input(value), startedAt);
    await startFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO carts
           (id, public_token_hash, currency, status, expires_at, created_at, updated_at)
         VALUES (?, ?, 'USD', 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(cart, "token-cleanup", at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservation_groups
           (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(group, cart, "reservation-key-cleanup", at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservations
           (id, group_id, cart_id, variant_id, warehouse_id, quantity, status,
            expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(reservation, group, cart, value.variant, value.warehouse, at, at),
    ]);
    await registerFashionStagingResource(env.DB, value.run, value.owner, "cart", cart, startedAt);
    await registerFashionStagingResource(
      env.DB,
      value.run,
      value.owner,
      "reservation_group",
      group,
      startedAt,
    );
    await registerFashionStagingResource(
      env.DB,
      value.run,
      value.owner,
      "reservation",
      reservation,
      startedAt,
    );
    await recordFashionStagingJourneyFailure(
      env.DB,
      value.run,
      value.owner,
      new Error("journey assertion failed\nsecret detail omitted by caller"),
      startedAt,
    );

    const result = await cleanupFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    expect(result).toMatchObject({
      after: { onHandQuantity: 3, reservedQuantity: 0 },
      journeyFailure: "journey assertion failed secret detail omitted by caller",
      status: "failed",
    });
    expect(
      await env.DB.prepare("SELECT status FROM carts WHERE id = ?").bind(cart).first(),
    ).toEqual({ status: "expired" });
    expect(
      await env.DB.prepare("SELECT status FROM inventory_reservations WHERE id = ?")
        .bind(reservation)
        .first(),
    ).toEqual({ status: "released" });
  });

  test("retains a paid order while restoring its consumed inventory through the ledger", async () => {
    const value = await seedInventory("paid", 2);
    const at = startedAt.toISOString();
    const cart = "cart-paid";
    const group = "reservation-group-paid";
    const reservation = "reservation-paid";
    const attempt = "checkout-attempt-paid";
    const order = "order-paid";
    await acquireFashionStagingAcceptance(env.DB, input(value), startedAt);
    await startFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO carts
           (id, public_token_hash, currency, status, expires_at, created_at, updated_at)
         VALUES (?, 'token-paid', 'USD', 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(cart, at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservation_groups
           (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
         VALUES (?, ?, 'reservation-key-paid', 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(group, cart, at, at),
      env.DB.prepare(
        `INSERT INTO inventory_reservations
           (id, group_id, cart_id, variant_id, warehouse_id, quantity, status,
            expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'active', '2026-08-18T10:00:00.000Z', ?, ?)`,
      ).bind(reservation, group, cart, value.variant, value.warehouse, at, at),
      env.DB.prepare(
        `INSERT INTO checkout_attempts
           (id, cart_id, reservation_group_id, provider, provider_session_id,
            idempotency_key, currency, subtotal_amount, discount_amount, shipping_amount,
            tax_amount, grand_total_amount, shipping_address_json, email, snapshot_json,
            status, created_at, updated_at)
         VALUES (?, ?, ?, 'stripe', 'session-paid', 'checkout-key-paid', 'USD',
                 1000, 0, 0, 0, 1000, '{}', 'paid@example.test', '{}',
                 'payment_pending', ?, ?)`,
      ).bind(attempt, cart, group, at, at),
    ]);
    await registerFashionStagingResource(env.DB, value.run, value.owner, "cart", cart, startedAt);
    await registerFashionStagingResource(
      env.DB,
      value.run,
      value.owner,
      "checkout_attempt",
      attempt,
      startedAt,
    );
    await env.DB.prepare(
      `INSERT INTO orders
         (id, public_reference, guest_access_token_hash, checkout_attempt_id,
          environment, test_mode, email, currency, subtotal_amount, discount_amount,
          shipping_amount, tax_amount, grand_total_amount, payment_status, order_status,
          fulfillment_status, created_at, updated_at)
       VALUES (?, 'SHOPPP-PAID01', 'guest-paid', ?, 'staging', 1, 'paid@example.test',
               'USD', 1000, 0, 0, 0, 1000, 'paid', 'confirmed', 'unfulfilled', ?, ?)`,
    )
      .bind(order, attempt, at, at)
      .run();

    const result = await cleanupFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    expect(result).toMatchObject({
      after: { onHandQuantity: 2, reservedQuantity: 0 },
      retainedOrderReferences: ["SHOPPP-PAID01"],
      status: "completed",
    });
    expect(await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(order).first()).toEqual({
      id: order,
    });
    expect(
      await env.DB.prepare(
        "SELECT quantity_delta, reference_type FROM stock_ledger_entries WHERE reference_id = ? AND reason = 'Fashion U12 acceptance baseline restore'",
      )
        .bind(value.run)
        .first(),
    ).toEqual({ quantity_delta: 1, reference_type: "manual_adjustment" });
  });

  test("requires explicit startup reconciliation before a stale lease can be replaced", async () => {
    const value = await seedInventory("recovery");
    await acquireFashionStagingAcceptance(env.DB, input(value), startedAt);
    await startFashionStagingAcceptance(env.DB, value.run, value.owner, startedAt);
    const recoveryAt = new Date(startedAt.getTime() + 6 * 60_000);
    await expect(
      acquireFashionStagingAcceptance(
        env.DB,
        { ...input(value), owner: "owner-replacement", runId: "run-replacement" },
        recoveryAt,
      ),
    ).rejects.toThrow(`fashion_staging_acceptance_reconciliation_required:${value.run}`);
    await expect(
      reconcileAbandonedFashionStagingAcceptance(env.DB, value.run, "owner-recovery", recoveryAt),
    ).resolves.toMatchObject({ status: "completed" });
  });
});
