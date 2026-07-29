import { describe, expect, test } from "bun:test";
import { upstreamApiRequest as adminRequest } from "../apps/admin/worker";
import { upstreamApiRequest as storefrontRequest } from "../apps/storefront/worker";

describe("environment-neutral API gateways", () => {
  test.each([
    ["storefront", storefrontRequest],
    ["admin", adminRequest],
  ])(
    "%s strips only the internal API mount and preserves request facts",
    async (_name, gateway) => {
      const source = new Request("https://shop.example.test/api/cart?currency=USD", {
        method: "POST",
        headers: {
          Authorization: "CartToken opaque",
          "Idempotency-Key": "gateway-test",
        },
        body: JSON.stringify({ quantity: 1 }),
      });
      const request = gateway(source);
      expect(request.url).toBe("https://shop.example.test/cart?currency=USD");
      expect(request.method).toBe("POST");
      expect(request.headers.get("Authorization")).toBe("CartToken opaque");
      expect(request.headers.get("Idempotency-Key")).toBe("gateway-test");
      expect(await request.json()).toEqual({ quantity: 1 });
    },
  );
});
