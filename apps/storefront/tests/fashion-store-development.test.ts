import { describe, expect, test } from "bun:test";

import {
  createFashionStoreLocalDevelopmentEnvironment,
  resolveFashionStoreDevelopmentOptions,
} from "../scripts/dev-fashion-store";
import { buildFashionStoreAcceptancePlan } from "../../../tools/run-fashion-store-acceptance";

describe("Fashion Store development command", () => {
  test("resolves the local preview as the default review surface", () => {
    expect(resolveFashionStoreDevelopmentOptions([], {})).toEqual({
      home: "combined",
      port: 3435,
      source: "local",
    });
    expect(
      resolveFashionStoreDevelopmentOptions(
        ["--source=local", "--home=isolated", "--port=3445"],
        {},
      ),
    ).toEqual({ home: "isolated", port: 3445, source: "local" });
  });

  test("names remote data staging and rejects misleading combinations", () => {
    expect(resolveFashionStoreDevelopmentOptions(["--source=staging"], {})).toEqual({
      home: "combined",
      port: 3435,
      source: "staging",
    });
    expect(() =>
      resolveFashionStoreDevelopmentOptions(["--source=staging", "--home=isolated"], {}),
    ).toThrow("staging source supports only the combined Home profile");
    expect(() => resolveFashionStoreDevelopmentOptions(["--source=live"], {})).toThrow(
      "--source must be local or staging",
    );
    expect(() => resolveFashionStoreDevelopmentOptions(["--unknown=value"], {})).toThrow(
      "Unknown option",
    );
  });

  test("creates the local preview environment without inheriting staging bindings", () => {
    const environment = createFashionStoreLocalDevelopmentEnvironment(
      {
        API_PROXY_TARGET: "https://stale.example.test",
        FASHION_STORE_DEV_PORT: "3445",
      },
      { home: "isolated", port: 3445, source: "local" },
    );

    expect(environment.API_PROXY_TARGET).toBeUndefined();
    expect(environment.STOREFRONT_BUILD_MODE).toBe("preview");
    expect(environment.STOREFRONT_EXPERIENCE_FILE).toEndWith(
      "fixtures/experience/.generated/fashion-store-preview-input.json",
    );
    expect(environment.STOREFRONT_FASHION_HOME_PROFILE).toBe("isolated");
  });
});

describe("Fashion Store acceptance command", () => {
  test("reuses the canonical page ledger for behavior-only acceptance", () => {
    const plan = buildFashionStoreAcceptancePlan({ scope: "theme", stage: "behavior" });

    expect(plan.pages).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "collection",
      "product",
      "cart",
      "checkout",
      "wishlist",
      "account",
      "magazine",
      "article",
      "about",
      "faq",
      "contact",
    ]);
    expect(plan.steps).toHaveLength(plan.pages.length);
    expect(plan.steps[5]?.command).toEqual([
      "bun",
      "../../tools/verify-theme-behavior-execution.ts",
      "--theme=fashion-store",
      "--page=product",
      "--report=test-results/fashion-store-behavior-results.json",
    ]);
  });
});
