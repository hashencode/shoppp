import { describe, expect, test } from "bun:test";

import { pendingFashionMigrationNames } from "./capture-fashion-staging-readiness";

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
});
