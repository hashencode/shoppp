import { describe, expect, test } from "vitest";

import { commerceDataPoint } from "../../src/observability/logger";
import { redactForLog, safeRequestId, safeRequestPath } from "../../src/security/redaction";

describe("central log redaction", () => {
  test("removes keyed and value-shaped personal data, credentials, tokens, and cards", () => {
    const card = ["4242", "4242", "4242", "4242"].join(" ");
    const webhookCredential = ["whsec", "raw", "webhook", "fixture"].join("_");
    const output = JSON.stringify(
      redactForLog({
        address: "100 Market Street",
        authorization: "Bearer raw-auth-token",
        genericCard: card,
        genericEmail: "shopper@example.test",
        genericSecret: webhookCredential,
        nested: {
          safe: "checkout_failed",
          token: "order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        },
        phone: "+1 555 0100",
      }),
    );
    expect(output).not.toContain("100 Market Street");
    expect(output).not.toContain("raw-auth-token");
    expect(output).not.toContain("4242");
    expect(output).not.toContain("shopper@example.test");
    expect(output).not.toContain("whsec_");
    expect(output).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(output).not.toContain("555 0100");
    expect(output).toContain("checkout_failed");
  });

  test("removes query strings and opaque guest tokens from logged request paths", () => {
    expect(
      safeRequestPath(
        "https://api.example.test/orders/order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ?email=x@example.test",
      ),
    ).toBe("/orders/:guestToken");
    expect(
      safeRequestPath("https://api.example.test/catalog/products/atlas/live?currency=USD"),
    ).toBe("/catalog/products/atlas/live");
  });

  test("keeps commerce analytics aggregate and identifier-free", () => {
    expect(commerceDataPoint("staging", { event: "page_view", route: "order_status" })).toEqual({
      blobs: ["staging", "commerce.funnel", "page_view", "order_status"],
      doubles: [1],
      indexes: ["staging"],
    });
  });

  test("accepts only UUID request identifiers at the logging and audit boundary", () => {
    const generated = "019faf01-877a-7143-a602-9b31e2511dc5";
    const supplied = "019fae99-5bb2-78d0-afc4-083958ed49b0";
    expect(safeRequestId(supplied, () => generated)).toBe(supplied);
    expect(safeRequestId("shopper@example.test", () => generated)).toBe(generated);
    expect(safeRequestId("order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ", () => generated)).toBe(
      generated,
    );
  });
});
