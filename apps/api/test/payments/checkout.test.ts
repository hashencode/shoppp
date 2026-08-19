import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type {
  CreateHostedSessionInput,
  CreateRefundInput,
  PaymentProvider,
  ProviderRefund,
  ProviderSession,
  VerifiedProviderEvent,
} from "../../src/payments/port";
import { PaymentProviderError } from "../../src/payments/port";
import { sha256Hex } from "../../src/orders/tokens";
import { getGuestOrderAccess } from "../../src/orders/guest-access";
import { createApp } from "../../src/http/app";
import { deliverAutomationJob } from "../../src/automation/workflows";
import type { EmailProvider } from "../../src/notifications/port";
import { expireDueReservations } from "../../src/inventory/expiry";
import { seedLaunchFixture } from "../../../../packages/db/seed/apply";

const ADDRESS = {
  city: "Portland",
  countryCode: "US",
  line1: "100 Market Street",
  name: "Example Shopper",
  postalCode: "97205",
  region: "OR",
};

let sequence = 10;

function publicId(prefix: string, value: number): string {
  return `${prefix}_${value.toString().padStart(26, "0")}`;
}

class FakePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly createHostedSession = vi.fn(async (input: CreateHostedSessionInput) => {
    if (this.createError) throw this.createError;
    const session: ProviderSession = {
      amountTotal: input.snapshot.totals.grandTotal,
      attemptId: input.attemptId,
      createdAt: new Date().toISOString(),
      currency: input.snapshot.currency,
      expiresAt: input.expiresAt,
      id: `cs_test_${input.attemptId}`,
      paymentId: `pi_test_${input.attemptId}`,
      paymentState: "pending",
      url: `https://checkout.stripe.test/${input.attemptId}`,
    };
    this.sessions.set(session.id, session);
    return session;
  });
  readonly sessions = new Map<string, ProviderSession>();
  createError: PaymentProviderError | null = null;
  retrieveError: PaymentProviderError | null = null;

  async createRefund(_input: CreateRefundInput): Promise<ProviderRefund> {
    throw new PaymentProviderError(
      "refund_not_supported",
      "Refund not supported in this test.",
      false,
    );
  }

  async retrieveRefund(_id: string): Promise<ProviderRefund> {
    throw new PaymentProviderError(
      "refund_not_supported",
      "Refund not supported in this test.",
      false,
    );
  }

  async retrieveSession(id: string): Promise<ProviderSession> {
    if (this.retrieveError) throw this.retrieveError;
    const session = this.sessions.get(id);
    if (!session) {
      throw new PaymentProviderError("session_unknown", "Session unknown.", false);
    }
    return session;
  }

  async verifyWebhook(rawPayload: string, signature: string): Promise<VerifiedProviderEvent> {
    if (signature !== "valid-signature") {
      throw new PaymentProviderError(
        "stripe_signature_invalid",
        "Stripe webhook signature is invalid.",
        false,
      );
    }
    return JSON.parse(rawPayload) as VerifiedProviderEvent;
  }
}

interface SeededCheckout {
  body: {
    acceptTerms: true;
    cartId: string;
    countryCode: "US";
    currency: "USD";
    email: string;
    idempotencyKey: string;
    shippingAddress: typeof ADDRESS;
    shippingMethodId: string;
  };
  cartToken: string;
}

async function seedCheckout(): Promise<SeededCheckout> {
  sequence += 1;
  const productId = publicId("prd", sequence);
  const variantId = publicId("var", sequence);
  const cartId = publicId("cart", sequence);
  const lineId = publicId("cl", sequence);
  const listId = publicId("pl", sequence);
  const priceId = publicId("price", sequence);
  const zoneId = publicId("zone", 1);
  const shippingMethodId = publicId("ship", 1);
  const cartToken = `cartToken${sequence}`.padEnd(43, "A");
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO products
         (id, slug, name, description, status, seo_title, seo_description,
          published_at, created_at, updated_at)
       VALUES (?, ?, ?, 'Snapshot description', 'published', ?, 'Snapshot description', ?, ?, ?)`,
    ).bind(
      productId,
      `snapshot-product-${sequence}`,
      `Snapshot Product ${sequence}`,
      `Snapshot Product ${sequence}`,
      now,
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO product_variants
         (id, product_id, sku, title, option_values_json, weight_grams, status,
          created_at, updated_at)
       VALUES (?, ?, ?, 'Black', '{"Color":"Black"}', 500, 'active', ?, ?)`,
    ).bind(variantId, productId, `SNAP-${sequence}`, now, now),
    env.DB.prepare(
      `INSERT INTO price_lists
         (id, code, currency, status, created_at, updated_at)
       VALUES (?, ?, 'USD', 'active', ?, ?)`,
    ).bind(listId, `SNAP-USD-${sequence}`, now, now),
    env.DB.prepare(
      `INSERT INTO prices
         (id, price_list_id, variant_id, amount, created_at, updated_at)
       VALUES (?, ?, ?, 2500, ?, ?)`,
    ).bind(priceId, listId, variantId, now, now),
    env.DB.prepare(
      `INSERT INTO inventory_items
         (variant_id, warehouse_id, on_hand_quantity, reserved_quantity,
          oversell_limit, version, updated_at)
       VALUES (?, 'wh_primary', 5, 0, 0, 0, ?)`,
    ).bind(variantId, now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO shipping_zones (id, name, status, created_at, updated_at)
       VALUES (?, 'US Test Zone', 'active', ?, ?)`,
    ).bind(zoneId, now, now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO shipping_zone_countries (zone_id, country_code) VALUES (?, 'US')",
    ).bind(zoneId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO shipping_methods
         (id, zone_id, name, calculation_type, price_amount, currency,
          status, created_at, updated_at)
       VALUES (?, ?, 'Tracked shipping', 'flat', 500, 'USD', 'active', ?, ?)`,
    ).bind(shippingMethodId, zoneId, now, now),
    env.DB.prepare(
      `INSERT INTO carts
         (id, public_token_hash, currency, pricing_context_json,
          promotion_context_json, shipping_country, shipping_address_json,
          shipping_method_id, status, expires_at, created_at, updated_at)
       VALUES (?, ?, 'USD', ?, '{}', 'US', ?, ?, 'active', ?, ?, ?)`,
    ).bind(
      cartId,
      await sha256Hex(cartToken),
      JSON.stringify({ pendingAdjustments: [], priceSnapshots: { [variantId]: 2500 } }),
      JSON.stringify(ADDRESS),
      shippingMethodId,
      future,
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO cart_lines
         (id, cart_id, variant_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    ).bind(lineId, cartId, variantId, now, now),
  ]);
  return {
    body: {
      acceptTerms: true,
      cartId,
      countryCode: "US",
      currency: "USD",
      email: "shopper@example.test",
      idempotencyKey: `checkout-idempotency-${sequence.toString().padStart(4, "0")}`,
      shippingAddress: ADDRESS,
      shippingMethodId,
    },
    cartToken,
  };
}

function checkoutRequest(checkout: SeededCheckout): Request {
  return new Request("https://api.example.test/checkout/sessions", {
    body: JSON.stringify(checkout.body),
    headers: {
      Authorization: `CartToken ${checkout.cartToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": checkout.body.idempotencyKey,
    },
    method: "POST",
  });
}

function webhookRequest(event: VerifiedProviderEvent): Request {
  return new Request("https://api.example.test/webhooks/stripe", {
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "valid-signature",
    },
    method: "POST",
  });
}

function eventFor(
  session: ProviderSession,
  id: string,
  type: VerifiedProviderEvent["type"] = "checkout.completed",
): VerifiedProviderEvent {
  return {
    createdAt: new Date().toISOString(),
    id,
    session,
    type,
  };
}

describe("hosted checkout and payment convergence", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
  });

  test("creates one hosted session then one immutable paid order from a verified event", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const first = await app.fetch(checkoutRequest(checkout), env);
    const replay = await app.fetch(checkoutRequest(checkout), env);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.text()).toBe(await first.clone().text());
    expect(provider.createHostedSession).toHaveBeenCalledTimes(1);
    expect(provider.createHostedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelUrl: "https://storefront-staging.example.invalid/checkout/complete?return=canceled",
      }),
    );
    const created = await first.json<{
      data: { attemptId: string; orderAccessToken: string };
    }>();
    const session = [...provider.sessions.values()][0]!;

    const pending = await app.fetch(
      new Request(`https://api.example.test/orders/${created.data.orderAccessToken}`),
      env,
    );
    expect(pending.status).toBe(202);
    expect(await pending.json()).toMatchObject({ data: { status: "pending" } });

    provider.sessions.set(session.id, { ...session, paymentState: "approved" });
    const paidEvent = eventFor(session, `evt_paid_${sequence}`);
    const paid = await app.fetch(webhookRequest(paidEvent), env);
    const duplicate = await app.fetch(webhookRequest(paidEvent), env);
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({
      data: { eventResult: "applied", orderReference: expect.stringMatching(/^ORD-/) },
    });
    expect(await duplicate.json()).toMatchObject({
      data: { eventResult: "applied", replayed: true },
    });

    await env.DB.prepare("UPDATE products SET name = 'Changed catalog name' WHERE id = ?")
      .bind(publicId("prd", sequence))
      .run();
    const access = await app.fetch(
      new Request(`https://api.example.test/orders/${created.data.orderAccessToken}`),
      env,
    );
    expect(access.status).toBe(200);
    expect(access.headers.get("cache-control")).toBe("private, no-store");
    expect(await access.json()).toMatchObject({
      data: {
        order: {
          email: "shopper@example.test",
          lines: [
            {
              lineTotalAmount: 2500,
              productName: `Snapshot Product ${sequence}`,
              unitPriceAmount: 2500,
            },
          ],
          paymentStatus: "paid",
          shippingAddress: ADDRESS,
          totals: { grandTotal: 3000, shippingTotal: 500, subtotal: 2500 },
        },
        status: "paid",
      },
    });
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE checkout_attempt_id = ?")
          .bind(created.data.attemptId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      await getGuestOrderAccess(env.DB, created.data.orderAccessToken, "2100-01-01T00:00:00.000Z"),
    ).toBeNull();
    expect(
      (await app.fetch(new Request(`https://api.example.test/orders/${"X".repeat(43)}`), env))
        .status,
    ).toBe(404);
    await expect(
      env.DB.prepare("UPDATE orders SET grand_total_amount = 1 WHERE checkout_attempt_id = ?")
        .bind(created.data.attemptId)
        .run(),
    ).rejects.toThrow("immutable_order_facts");
    await expect(
      env.DB.prepare("UPDATE checkout_attempts SET snapshot_json = '{}' WHERE id = ?")
        .bind(created.data.attemptId)
        .run(),
    ).rejects.toThrow("immutable_checkout_snapshot");
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM notification_jobs WHERE type = 'order_receipt' AND order_id = (SELECT id FROM orders WHERE checkout_attempt_id = ?)",
        )
          .bind(created.data.attemptId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      await env.DB.prepare(
        `SELECT i.on_hand_quantity, i.reserved_quantity, rg.status
           FROM inventory_items i
           JOIN inventory_reservation_groups rg ON rg.id = (
             SELECT reservation_group_id FROM checkout_attempts WHERE id = ?
           )
          WHERE i.variant_id = ? AND i.warehouse_id = 'wh_primary'`,
      )
        .bind(created.data.attemptId, publicId("var", sequence))
        .first(),
    ).toEqual({ on_hand_quantity: 4, reserved_quantity: 0, status: "confirmed" });

    const stale = eventFor(session, `evt_stale_${sequence}`);
    const staleResponse = await app.fetch(webhookRequest(stale), env);
    expect(await staleResponse.json()).toMatchObject({
      data: { eventResult: "ignored" },
    });
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE checkout_attempt_id = ?")
          .bind(created.data.attemptId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("expiry races are idempotent, release stock, and allow a safe retry", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const response = await app.fetch(checkoutRequest(checkout), env);
    const created = await response.json<{ data: { attemptId: string } }>();
    const session = [...provider.sessions.values()][0]!;
    provider.sessions.set(session.id, { ...session, paymentState: "expired" });

    await expireDueReservations(env.DB, session.expiresAt);
    const expired = await app.fetch(
      webhookRequest(eventFor(session, `evt_expired_${sequence}`, "checkout.expired")),
      env,
    );
    expect(expired.status).toBe(200);
    expect(
      await env.DB.prepare(
        `SELECT ca.status AS attempt_status, rg.status AS reservation_status
           FROM checkout_attempts ca
           JOIN inventory_reservation_groups rg ON rg.id = ca.reservation_group_id
          WHERE ca.id = ?`,
      )
        .bind(created.data.attemptId)
        .first(),
    ).toEqual({ attempt_status: "expired", reservation_status: "expired" });
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE checkout_attempt_id = ?")
          .bind(created.data.attemptId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);

    const retry = {
      ...checkout,
      body: {
        ...checkout.body,
        idempotencyKey: `${checkout.body.idempotencyKey}-retry`,
      },
    };
    expect((await app.fetch(checkoutRequest(retry), env)).status).toBe(201);
  });

  test("unapproved, mismatched, unknown, and temporarily unreachable provider truth create no order", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const response = await app.fetch(checkoutRequest(checkout), env);
    const created = await response.json<{ data: { attemptId: string } }>();
    const session = [...provider.sessions.values()][0]!;

    const pending = await app.fetch(
      webhookRequest(eventFor(session, `evt_pending_${sequence}`)),
      env,
    );
    expect(await pending.json()).toMatchObject({ data: { eventResult: "ignored" } });

    const mismatch = await app.fetch(
      webhookRequest(eventFor({ ...session, currency: "EUR" }, `evt_currency_${sequence}`)),
      env,
    );
    expect(await mismatch.json()).toMatchObject({ data: { eventResult: "failed" } });

    const unknown = await app.fetch(
      webhookRequest(
        eventFor(
          { ...session, attemptId: publicId("chk", 9999), id: "cs_test_unknown" },
          `evt_unknown_${sequence}`,
        ),
      ),
      env,
    );
    expect(await unknown.json()).toMatchObject({ data: { eventResult: "failed" } });

    provider.retrieveError = new PaymentProviderError(
      "stripe_unreachable",
      "The payment provider could not be reached.",
      true,
    );
    const retryEvent = eventFor(session, `evt_retry_${sequence}`);
    expect((await app.fetch(webhookRequest(retryEvent), env)).status).toBe(503);
    expect(
      await env.DB.prepare(
        `SELECT kind, type, status FROM notification_jobs
          WHERE provider_event_id = (
            SELECT id FROM payment_events
             WHERE provider_event_id = ?
          )`,
      )
        .bind(retryEvent.id)
        .first(),
    ).toEqual({
      kind: "provider_recovery",
      status: "pending",
      type: "payment_reconciliation",
    });
    provider.retrieveError = null;
    provider.sessions.set(session.id, { ...session, paymentState: "approved" });
    const recovered = await app.fetch(webhookRequest(retryEvent), env);
    expect(await recovered.json()).toMatchObject({
      data: { eventResult: "applied" },
    });
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE checkout_attempt_id = ?")
          .bind(created.data.attemptId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT status FROM notification_jobs WHERE deduplication_key LIKE 'payment.reconciliation:%' ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ status: "sent" });
  });

  test("a queued provider recovery converges payment without another webhook delivery", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const response = await app.fetch(checkoutRequest(checkout), env);
    const created = await response.json<{ data: { attemptId: string } }>();
    const session = [...provider.sessions.values()][0]!;
    provider.retrieveError = new PaymentProviderError(
      "stripe_unreachable",
      "The payment provider could not be reached.",
      true,
    );
    const event = eventFor(session, `evt_async_recovery_${sequence}`);
    expect((await app.fetch(webhookRequest(event), env)).status).toBe(503);
    const recovery = await env.DB.prepare(
      `SELECT id, next_attempt_at AS nextAttemptAt FROM notification_jobs
        WHERE kind = 'provider_recovery' AND provider_event_id = (
          SELECT id FROM payment_events WHERE provider_event_id = ?
        )`,
    )
      .bind(event.id)
      .first<{ id: string; nextAttemptAt: string }>();
    const retryAttemptAt = new Date(
      Date.parse(recovery!.nextAttemptAt) + 10 * 60_000,
    ).toISOString();

    const unusedEmailProvider: EmailProvider = {
      async send() {
        throw new Error("Provider recovery must not send customer email.");
      },
    };
    await expect(
      deliverAutomationJob(
        env.DB,
        unusedEmailProvider,
        provider,
        "https://shop.example.test",
        recovery!.id,
        recovery!.nextAttemptAt,
      ),
    ).resolves.toMatchObject({ status: "retry" });
    provider.retrieveError = null;
    provider.sessions.set(session.id, { ...session, paymentState: "approved" });
    const purchaseConfirmed = vi.fn();
    await expect(
      deliverAutomationJob(
        env.DB,
        unusedEmailProvider,
        provider,
        "https://shop.example.test",
        recovery!.id,
        retryAttemptAt,
        undefined,
        purchaseConfirmed,
      ),
    ).resolves.toMatchObject({ status: "sent" });
    expect(purchaseConfirmed).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE checkout_attempt_id = ?")
        .bind(created.data.attemptId)
        .first(),
    ).toEqual({ count: 1 });
    expect(
      await env.DB.prepare("SELECT status, attempt_count FROM notification_jobs WHERE id = ?")
        .bind(recovery!.id)
        .first(),
    ).toEqual({ attempt_count: 2, status: "sent" });
  });

  test("failed provider truth releases stock and queues one privacy-minimal outcome message", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const response = await app.fetch(checkoutRequest(checkout), env);
    const created = await response.json<{ data: { attemptId: string } }>();
    const session = [...provider.sessions.values()][0]!;
    const failedSession = { ...session, paymentState: "failed" as const };
    provider.sessions.set(session.id, failedSession);
    const event = eventFor(
      failedSession,
      `evt_payment_failed_${sequence}`,
      "checkout.payment_failed",
    );

    expect(await (await app.fetch(webhookRequest(event), env)).json()).toMatchObject({
      data: { eventResult: "applied" },
    });
    expect(await (await app.fetch(webhookRequest(event), env)).json()).toMatchObject({
      data: { replayed: true },
    });
    const jobs = await env.DB.prepare(
      `SELECT type, payload_json
         FROM notification_jobs
        WHERE checkout_attempt_id = ?`,
    )
      .bind(created.data.attemptId)
      .all<{ payload_json: string; type: string }>();
    expect(jobs.results).toHaveLength(1);
    expect(jobs.results[0]?.type).toBe("payment_failed");
    expect(JSON.parse(jobs.results[0]!.payload_json)).toEqual({
      checkoutAttemptId: created.data.attemptId,
    });
    expect(jobs.results[0]?.payload_json).not.toContain("@");
    expect(
      await env.DB.prepare(
        `SELECT g.status
           FROM inventory_reservation_groups g
           JOIN checkout_attempts c ON c.reservation_group_id = g.id
          WHERE c.id = ?`,
      )
        .bind(created.data.attemptId)
        .first(),
    ).toEqual({ status: "released" });
  });

  test("a provider timeout records one failed attempt, releases stock, and replays stably", async () => {
    const provider = new FakePaymentProvider();
    provider.createError = new PaymentProviderError(
      "stripe_unreachable",
      "The payment provider could not be reached.",
      true,
    );
    const app = createApp({ paymentProvider: provider });
    const checkout = await seedCheckout();
    const first = await app.fetch(checkoutRequest(checkout), env);
    const replay = await app.fetch(checkoutRequest(checkout), env);
    expect(first.status).toBe(503);
    expect(replay.status).toBe(503);
    expect(await replay.text()).toBe(await first.text());
    expect(provider.createHostedSession).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        `SELECT ca.status AS attempt_status, rg.status AS reservation_status
           FROM checkout_attempts ca
           JOIN inventory_reservation_groups rg ON rg.id = ca.reservation_group_id
          WHERE ca.idempotency_key = ?`,
      )
        .bind(checkout.body.idempotencyKey)
        .first(),
    ).toEqual({ attempt_status: "failed", reservation_status: "released" });
    expect(
      await env.DB.prepare(
        `SELECT result FROM audit_events
          WHERE action = 'payment.session.create' AND target_id = (
            SELECT id FROM checkout_attempts WHERE idempotency_key = ?
          )`,
      )
        .bind(checkout.body.idempotencyKey)
        .first(),
    ).toEqual({ result: "failed" });
  });

  test("rejects an invalid signature and records a sanitized verification failure", async () => {
    const provider = new FakePaymentProvider();
    const app = createApp({ paymentProvider: provider });
    const ordersBefore = await env.DB.prepare("SELECT COUNT(*) AS count FROM orders").first<{
      count: number;
    }>();
    const response = await app.fetch(
      new Request("https://api.example.test/webhooks/stripe", {
        body: "{}",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "invalid-signature",
        },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "stripe_signature_invalid" },
    });
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM orders").first()).toEqual(
      ordersBefore,
    );
    expect(
      await env.DB.prepare(
        `SELECT action, result, reason, metadata_json
           FROM audit_events
          WHERE action = 'payment.webhook.verify'
          ORDER BY created_at DESC LIMIT 1`,
      ).first(),
    ).toEqual({
      action: "payment.webhook.verify",
      metadata_json: '{"code":"stripe_signature_invalid"}',
      reason: "stripe_signature_invalid",
      result: "denied",
    });
  });
});
