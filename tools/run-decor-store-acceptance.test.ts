import { describe, expect, test } from "bun:test";
import { buildDecorStoreAcceptancePlan } from "./run-decor-store-acceptance";

describe("Decor Store acceptance runner", () => {
  test("registers the home page unit, browser, and behavior evidence gates", () => {
    const plan = buildDecorStoreAcceptancePlan({ page: "home", scope: "page" });
    expect(plan.pages).toEqual(["home"]);
    expect(plan.steps.map(({ label }) => label)).toEqual([
      "home/unit",
      "home/browser",
      "home/behavior-evidence",
    ]);
  });

  test("rejects unknown pages", () => {
    expect(() => buildDecorStoreAcceptancePlan({ page: "product", scope: "page" })).toThrow(
      "--page=home",
    );
  });
});
