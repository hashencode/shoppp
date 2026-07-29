import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { FIXTURE_ORDER_ACCESS_TOKEN, seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { getGuestOrderAccess } from "../../src/orders/guest-access";

const TOKEN = FIXTURE_ORDER_ACCESS_TOKEN;
const EXPIRES_AT = "2026-08-29T00:00:00.000Z";

describe("guest order access", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
  });

  test("reveals only the intended immutable order for a valid opaque token", async () => {
    const access = await getGuestOrderAccess(env.DB, TOKEN, "2026-08-01T00:00:00.000Z");

    expect(access).toMatchObject({
      order: {
        email: "shopper@example.test",
        lines: [{ productName: "Fixture Product 0001", sku: "FIX-0001-1" }],
        publicReference: "ORD-FIXTURE1",
      },
      status: "paid",
    });
    expect(JSON.stringify(access)).not.toContain("ord_fixture_0001");
    expect(JSON.stringify(access)).not.toContain("guest_access_token_hash");
  });

  test("cannot enumerate another order and expires at the exact boundary", async () => {
    expect(
      await getGuestOrderAccess(
        env.DB,
        "order_access_ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210",
        "2026-08-01T00:00:00.000Z",
      ),
    ).toBeNull();
    expect(await getGuestOrderAccess(env.DB, TOKEN, EXPIRES_AT)).toBeNull();
  });
});
