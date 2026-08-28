import { describe, expect, test } from "bun:test";
import {
  buildDecorStoreAcceptancePlan,
  canonicalDecorStoreAcceptanceEnvironment,
} from "./run-decor-store-acceptance";

describe("Decor Store acceptance runner", () => {
  test("registers page acceptance through the shared suite and selected behavior gate", () => {
    const plan = buildDecorStoreAcceptancePlan({ page: "home", scope: "page" });
    expect(plan.pages).toEqual(["home"]);
    expect(plan.steps.map(({ label }) => label)).toEqual([
      "page-suite/unit",
      "page-suite/browser",
      "home/behavior-evidence",
    ]);
    expect(plan.steps[0]?.command).toContain("scripts/generate-decor-store-page-fragments.test.ts");
  });

  test("enumerates all fifteen accepted identities at theme scope", () => {
    const plan = buildDecorStoreAcceptancePlan({ scope: "theme" });
    expect(plan.pages).toHaveLength(15);
    expect(plan.pages).toContain("contact");
    expect(plan.steps.at(-1)?.label).toBe("page-suite/performance");
  });

  test("rejects unknown pages", () => {
    expect(() => buildDecorStoreAcceptancePlan({ page: "unknown", scope: "page" })).toThrow(
      "requires one of",
    );
  });

  test("does not inherit external implementation or source overrides", () => {
    const env = canonicalDecorStoreAcceptanceEnvironment({
      SAFE_VALUE: "kept",
      STOREFRONT_DECOR_STORE_BASE_URL: "https://external.example",
      STOREFRONT_DECOR_STORE_SOURCE_URL: "https://source.example",
      STOREFRONT_PERF_BASE_URL: "https://performance.example",
      STOREFRONT_PERF_ROOT_URL: "https://performance-root.example",
      STOREFRONT_PERF_ROUTE: "/external-route",
    });
    expect(env.SAFE_VALUE).toBe("kept");
    expect(env.STOREFRONT_DECOR_STORE_BASE_URL).toBeUndefined();
    expect(env.STOREFRONT_DECOR_STORE_SOURCE_URL).toBeUndefined();
    expect(env.STOREFRONT_PERF_BASE_URL).toBeUndefined();
    expect(env.STOREFRONT_PERF_ROOT_URL).toBeUndefined();
    expect(env.STOREFRONT_PERF_ROUTE).toBeUndefined();
  });
});
