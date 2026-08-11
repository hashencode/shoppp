import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "../app");

async function source(path: string): Promise<string> {
  return readFile(resolve(appRoot, path), "utf8");
}

describe("Fashion Store live commerce boundary", () => {
  test("keeps live theme surfaces on presentation view models and injected intent ports", async () => {
    const liveSources = await Promise.all([
      source("themes/fashion-store/components/shared/FashionStoreLiveCatalog.vue"),
      source("themes/fashion-store/components/pages/FashionStoreLiveProductPage.vue"),
    ]);
    for (const value of liveSources) {
      expect(value).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    }
    expect(liveSources[1]).toContain("runtimeCommercePortKey");
    expect(liveSources[1]).toContain("storefrontActionAdapterKey");
  });

  test("dispatches fixture-heavy home and product implementations only for fixture view models", async () => {
    const dispatchers = await Promise.all([
      source("themes/fashion-store/components/FashionStoreHomeRoute.vue"),
      source("themes/fashion-store/components/pages/FashionStoreProductRoute.vue"),
    ]);
    expect(dispatchers.every((value) => value.includes("defineAsyncComponent"))).toBe(true);
    expect(dispatchers[0]).toContain("viewModel.kind === 'collection-grid'");
    expect(dispatchers[1]).toContain("viewModel.kind === 'product'");
  });
});
