import { describe, expect, test } from "bun:test";

import { classifyStorefrontRoute, pageViewEvent } from "../app/utils/analytics";

describe("privacy-safe storefront funnel analytics", () => {
  test.each([
    ["/", "home"],
    ["/collections/travel", "collection"],
    ["/products/atlas", "product"],
    ["/cart", "cart"],
    ["/checkout", "checkout"],
    ["/checkout/complete", "checkout_complete"],
    ["/orders/opaque-secret-token", "order_status"],
    ["/policies/privacy", "policy"],
    ["/about", "content"],
  ] as const)("normalizes %s without retaining route identifiers", (path, expected) => {
    expect(classifyStorefrontRoute(path)).toBe(expected);
  });

  test("emits only an allowlisted event and normalized route class", () => {
    const serialized = JSON.stringify(pageViewEvent("/orders/do-not-collect-this-token"));
    expect(serialized).toBe('{"event":"page_view","route":"order_status"}');
    expect(serialized).not.toContain("do-not-collect");
  });
});
