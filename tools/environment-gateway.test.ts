import { describe, expect, test } from "bun:test";
import { upstreamApiRequest as adminRequest } from "../apps/admin/worker";
import storefrontWorker, {
  staticAssetRequest as storefrontAssetRequest,
  upstreamApiRequest as storefrontRequest,
} from "../apps/storefront/worker";
import { adminApiUrl } from "../e2e/support";

describe("environment-neutral API gateways", () => {
  test("staging admin proofs use the same-origin API gateway", () => {
    const previous = process.env.ADMIN_E2E_BASE_URL;
    process.env.ADMIN_E2E_BASE_URL = "https://admin.staging.example.test/";
    try {
      expect(adminApiUrl("/admin/session")).toBe(
        "https://admin.staging.example.test/api/admin/session",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.ADMIN_E2E_BASE_URL;
      } else {
        process.env.ADMIN_E2E_BASE_URL = previous;
      }
    }
  });

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

  test("admin always strips obsolete Cloudflare Access assertions", () => {
    const protectedRequest = new Request("https://admin.staging.example.test/api/admin/session", {
      headers: { "Cf-Access-Jwt-Assertion": "access-assertion" },
    });
    expect(adminRequest(protectedRequest).headers.get("Cf-Access-Jwt-Assertion")).toBeNull();

    const bypassRequest = new Request("http://localhost:3000/api/admin/session", {
      headers: { "Cf-Access-Jwt-Assertion": "spoofed-assertion" },
    });
    expect(adminRequest(bypassRequest).headers.get("Cf-Access-Jwt-Assertion")).toBeNull();
  });

  test("storefront serves opaque order routes from the private order shell", () => {
    const source = new Request(
      "https://shop.example.test/orders/order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?source=checkout",
      {
        headers: { "Accept-Language": "en-US" },
      },
    );
    const request = storefrontAssetRequest(source);
    expect(request.url).toBe("https://shop.example.test/orders/access/?source=checkout");
    expect(request.headers.get("Accept-Language")).toBe("en-US");
  });

  test.each([
    "/orders/access",
    "/orders/access/",
    "/orders/access/index.html",
    "/orders/token/nested",
    "/products/atlas-carry-on",
  ])("storefront leaves non-token asset route %s unchanged", (path) => {
    const source = new Request(`https://shop.example.test${path}`);
    expect(storefrontAssetRequest(source)).toBe(source);
  });

  test("storefront worker dispatches API and order asset requests through the expected bindings", async () => {
    const apiRequests: Request[] = [];
    const assetRequests: Request[] = [];
    const environment = {
      API: {
        async fetch(request: Request) {
          apiRequests.push(request);
          return new Response("api");
        },
      },
      ASSETS: {
        async fetch(request: Request) {
          assetRequests.push(request);
          return new Response("asset");
        },
      },
    };

    const apiResponse = await storefrontWorker.fetch(
      new Request("https://shop.example.test/api/cart?currency=USD"),
      environment,
    );
    const opaqueOrderResponse = await storefrontWorker.fetch(
      new Request(
        "https://shop.example.test/orders/order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?source=checkout",
      ),
      environment,
    );
    const accessShellResponse = await storefrontWorker.fetch(
      new Request("https://shop.example.test/orders/access?source=account"),
      environment,
    );

    expect(await apiResponse.text()).toBe("api");
    expect(apiRequests.map(({ url }) => url)).toEqual([
      "https://shop.example.test/cart?currency=USD",
    ]);
    expect(await opaqueOrderResponse.text()).toBe("asset");
    expect(await accessShellResponse.text()).toBe("asset");
    expect(assetRequests.map(({ url }) => url)).toEqual([
      "https://shop.example.test/orders/access/?source=checkout",
      "https://shop.example.test/orders/access?source=account",
    ]);
  });
});
