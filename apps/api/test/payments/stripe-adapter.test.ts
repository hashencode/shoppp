import { describe, expect, test, vi } from "vitest";

import { StripePaymentProvider } from "../../src/payments/stripe-adapter";

const NOW_SECONDS = 1_785_360_000;
const STRIPE_SECRET_KEY = ["sk", "test", "fixture"].join("_");
const WEBHOOK_SECRET = ["whsec", "test", "signing", "fixture"].join("_");

async function signature(payload: string, timestamp = NOW_SECONDS): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const value = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `t=${timestamp},v1=${value}`;
}

function stripeSession(paymentStatus: "paid" | "unpaid" = "unpaid") {
  return {
    amount_total: 3000,
    client_reference_id: "chk_01J00000000000000000000000",
    created: NOW_SECONDS,
    currency: "usd",
    expires_at: NOW_SECONDS + 1800,
    id: "cs_test_checkout_001",
    metadata: { checkout_attempt_id: "chk_01J00000000000000000000000" },
    payment_intent: "pi_test_checkout_001",
    payment_status: paymentStatus,
    status: paymentStatus === "paid" ? "complete" : "open",
    url: "https://checkout.stripe.test/c/pay/cs_test_checkout_001",
  };
}

function stripeRefund() {
  return {
    amount: 500,
    created: NOW_SECONDS,
    currency: "usd",
    id: "re_test_refund_001",
    payment_intent: "pi_test_checkout_001",
    status: "succeeded",
  };
}

describe("Stripe hosted Checkout adapter", () => {
  test("creates a card-only hosted session with exact totals, expiry, and idempotency", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("mode")).toBe("payment");
      expect(body.get("payment_method_types[0]")).toBe("card");
      expect(body.get("expires_at")).toBe(String(NOW_SECONDS + 1800));
      expect(body.get("line_items[0][price_data][unit_amount]")).toBe("2500");
      expect(body.get("line_items[1][price_data][unit_amount]")).toBe("500");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("checkout-idempotency-0001");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${STRIPE_SECRET_KEY}`);
      return Response.json(stripeSession());
    });
    const provider = new StripePaymentProvider({
      fetcher: fetcher as typeof fetch,
      now: () => NOW_SECONDS * 1_000,
      secretKey: STRIPE_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
    });
    const result = await provider.createHostedSession({
      attemptId: "chk_01J00000000000000000000000",
      cancelUrl: "https://shop.example.test/checkout",
      expiresAt: new Date((NOW_SECONDS + 1800) * 1_000).toISOString(),
      idempotencyKey: "checkout-idempotency-0001",
      snapshot: {
        currency: "USD",
        email: "shopper@example.test",
        lines: [
          {
            currency: "USD",
            discountAmount: 0,
            lineTotalAmount: 2500,
            optionValues: { Color: "Black" },
            productId: "prd_01J00000000000000000000000",
            productName: "Carry-on",
            quantity: 1,
            sku: "CASE-BLK",
            taxAmount: 0,
            unitPriceAmount: 2500,
            variantId: "var_01J00000000000000000000000",
            variantName: "Black",
          },
        ],
        shippingAddress: {
          city: "Portland",
          countryCode: "US",
          line1: "100 Market Street",
          name: "Example Shopper",
          postalCode: "97205",
        },
        shippingMethod: { amount: 500, id: "ship_1", name: "Tracked shipping" },
        totals: {
          discountTotal: 0,
          grandTotal: 3000,
          shippingTotal: 500,
          subtotal: 2500,
          taxTotal: 0,
        },
      },
      successUrl: "https://shop.example.test/checkout/complete?session_id={CHECKOUT_SESSION_ID}",
    });
    expect(result).toMatchObject({
      amountTotal: 3000,
      currency: "USD",
      paymentState: "pending",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("verifies the untouched raw body and rejects alteration or stale signatures", async () => {
    const provider = new StripePaymentProvider({
      now: () => NOW_SECONDS * 1_000,
      secretKey: STRIPE_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
    });
    const payload = JSON.stringify({
      created: NOW_SECONDS,
      data: { object: stripeSession("paid") },
      id: "evt_checkout_paid_001",
      type: "checkout.session.completed",
    });
    await expect(provider.verifyWebhook(payload, await signature(payload))).resolves.toMatchObject({
      id: "evt_checkout_paid_001",
      session: { paymentState: "approved" },
      type: "checkout.completed",
    });
    await expect(
      provider.verifyWebhook(`${payload} `, await signature(payload)),
    ).rejects.toMatchObject({ code: "stripe_signature_invalid" });
    await expect(
      provider.verifyWebhook(payload, await signature(payload, NOW_SECONDS - 301)),
    ).rejects.toMatchObject({ code: "stripe_signature_expired" });
  });

  test("maps provider timeouts to a retryable sanitized failure", async () => {
    const provider = new StripePaymentProvider({
      fetcher: vi.fn(async () => {
        throw new Error("network leaked detail");
      }) as typeof fetch,
      now: () => NOW_SECONDS * 1_000,
      secretKey: STRIPE_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
    });
    await expect(provider.retrieveSession("cs_test_checkout_001")).rejects.toMatchObject({
      code: "stripe_unreachable",
      message: "The payment provider could not be reached.",
      retryable: true,
    });
  });

  test("creates and retrieves an idempotent provider refund with exact facts", async () => {
    const requests: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(input));
      if (init?.method === "POST") {
        const body = init.body as URLSearchParams;
        expect(body.get("payment_intent")).toBe("pi_test_checkout_001");
        expect(body.get("amount")).toBe("500");
        expect(body.get("metadata[order_id]")).toBe("ord_test_001");
        expect(body.get("metadata[refund_id]")).toBe("ref_test_001");
        expect(new Headers(init.headers).get("Idempotency-Key")).toBe("refund-idempotency-0001");
      }
      return Response.json(stripeRefund());
    });
    const provider = new StripePaymentProvider({
      fetcher: fetcher as typeof fetch,
      now: () => NOW_SECONDS * 1_000,
      secretKey: STRIPE_SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
    });

    await expect(
      provider.createRefund({
        amount: 500,
        currency: "USD",
        idempotencyKey: "refund-idempotency-0001",
        orderId: "ord_test_001",
        paymentId: "pi_test_checkout_001",
        refundId: "ref_test_001",
      }),
    ).resolves.toEqual({
      amount: 500,
      createdAt: new Date(NOW_SECONDS * 1_000).toISOString(),
      currency: "USD",
      id: "re_test_refund_001",
      paymentId: "pi_test_checkout_001",
      status: "succeeded",
    });
    await expect(provider.retrieveRefund("re_test_refund_001")).resolves.toMatchObject({
      id: "re_test_refund_001",
      status: "succeeded",
    });
    expect(requests).toEqual([
      "https://api.stripe.com/v1/refunds",
      "https://api.stripe.com/v1/refunds/re_test_refund_001",
    ]);
  });
});
