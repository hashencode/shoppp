import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { fashionStoreDemoReviewDisplays } from "../scripts/fashion-store-demo-reviews";

describe("Fashion Store demonstration reviews", () => {
  test("covers every sample Product with distinct, explicitly fictional entries", async () => {
    const source = JSON.parse(
      await readFile(
        resolve(import.meta.dir, "../../../tools/fashion-store-live-catalog.json"),
        "utf8",
      ),
    ) as { products: Array<{ slug: string; name: string }> };
    const displays = await fashionStoreDemoReviewDisplays();
    expect(displays.size).toBe(13);
    expect([...displays.keys()].sort()).toEqual(source.products.map(({ slug }) => slug).sort());
    const ids = new Set<string>();
    for (const product of source.products) {
      const display = displays.get(product.slug)!;
      expect(display.provenance).toBe("local-demonstration-only");
      expect(display.count).toBe(4);
      expect(display.ratingBands?.reduce((total, count) => total + count, 0)).toBe(4);
      expect(
        display.entries.every(
          ({ text }) => text.includes(product.name) && text.includes("sample content"),
        ),
      ).toBe(true);
      for (const entry of display.entries) ids.add(entry.id!);
    }
    expect(ids.size).toBe(52);
  });
});
