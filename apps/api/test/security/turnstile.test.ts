import { afterEach, describe, expect, test, vi } from "vitest";

import { verifyTurnstile, type TurnstileVerificationInput } from "../../src/security/turnstile";

const input = (testing: boolean) =>
  ({
    action: "checkout",
    expectedHostnames: ["shoppp-storefront-staging.hashencode.workers.dev"],
    idempotencyKey: crypto.randomUUID(),
    secret: "cloudflare-testing-secret",
    testing,
    token: "XXXX.DUMMY.TOKEN.XXXX",
  }) as TurnstileVerificationInput & { testing: boolean };

describe("Turnstile verification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("accepts a Cloudflare testing response only in explicit staging test mode", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        "error-codes": [],
        hostname: "example.com",
        metadata: { result_with_testing_key: true },
        success: true,
      }),
    );

    await expect(verifyTurnstile(input(true))).resolves.toEqual({
      errorCodes: [],
      success: true,
    });
    await expect(verifyTurnstile(input(false))).resolves.toEqual({
      errorCodes: [],
      success: false,
    });
  });
});
