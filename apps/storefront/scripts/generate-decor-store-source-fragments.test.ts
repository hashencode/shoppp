import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  extractDecorStoreSourceFragments,
  renderDecorStoreSourceFragments,
} from "./generate-decor-store-source-fragments";

const storefrontRoot = resolve(import.meta.dir, "..");

describe("Decor Store generated source fragments", () => {
  test("are exactly reproducible from the frozen source without forbidden page resources", async () => {
    const source = await readFile(
      resolve(storefrontRoot, "app/themes/decor-store/upstream/demo-decor-store.html"),
      "utf8",
    );
    const generated = await readFile(
      resolve(storefrontRoot, "app/themes/decor-store/runtime/source-fragments.generated.ts"),
      "utf8",
    );
    expect(generated).toBe(
      await renderDecorStoreSourceFragments(extractDecorStoreSourceFragments(source)),
    );
    expect(generated).not.toMatch(
      /fonts\.(?:googleapis|gstatic)\.com|subscribe-newsletter\.php|particles|js\/main\.js/i,
    );
  });
});
