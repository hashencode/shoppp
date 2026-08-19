import { describe, expect, test } from "bun:test";

import {
  pendingFashionMigrationNames,
  stripeIdentityAndSandboxMode,
} from "./capture-fashion-staging-readiness";

describe("Fashion readiness evidence capture", () => {
  test("extracts only exact pending migration names from nested Wrangler output", () => {
    expect(
      pendingFashionMigrationNames({
        result: [
          { applied_at: "2026-08-18T00:00:00Z", name: "0018_applied.sql" },
          { applied_at: null, name: "0019_pending.sql" },
          { applied: false, name: "0020_pending.sql" },
          { name: "not-a-migration" },
        ],
      }),
    ).toEqual(["0019_pending.sql", "0020_pending.sql"]);
  });

  test("uses the Stripe account identity and the balance sandbox marker", () => {
    expect(stripeIdentityAndSandboxMode({ id: "acct_fashion" }, { livemode: false })).toEqual({
      accountId: "acct_fashion",
      livemode: false,
    });
    expect(() => stripeIdentityAndSandboxMode({ id: "acct_fashion" }, {})).toThrow(
      "Stripe balance must explicitly report sandbox mode",
    );
    expect(() => stripeIdentityAndSandboxMode({ id: "acct_fashion" }, { livemode: true })).toThrow(
      "Stripe balance must explicitly report sandbox mode",
    );
  });
});
