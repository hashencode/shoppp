import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { decorStoreAssetId, themeAssets } from "../app/themes/decor-store/resources";
import {
  decorStoreSecondaryPageSources,
  generateDecorStorePageFragments,
} from "./generate-decor-store-page-fragments";
const generatedDirectory = resolve(
  import.meta.dir,
  "../app/themes/decor-store/runtime/secondary-page-fragments",
);

async function generatedSource(): Promise<string> {
  const files = await readdir(generatedDirectory);
  return (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".generated.ts"))
        .map((file) => readFile(resolve(generatedDirectory, file), "utf8")),
    )
  ).join("\n");
}

describe("Decor Store secondary source fragments", () => {
  test("are exactly reproducible from all fourteen frozen source pages", async () => {
    expect(Object.keys(decorStoreSecondaryPageSources)).toHaveLength(14);
    await expect(generateDecorStorePageFragments(true)).resolves.toBeUndefined();
  });

  test("removes executable, remote, and backend-capable markup", async () => {
    const generated = await generatedSource();
    expect(generated).not.toMatch(
      /<script\b|<iframe\b|\bmain\.js\b|javascript:|https?:\/\/|\.php\b|\saction=|\smethod=|\son[a-z]+=/i,
    );
    expect(generated).not.toMatch(/type=(?:\\?["'])submit(?:\\?["'])/i);
    expect(generated).not.toMatch(/<\/?form\b/i);
    expect(generated).not.toContain("data-map-options");
    expect(generated).not.toContain("data-slider-options");
  });

  test("registers every local asset token emitted by the generator", async () => {
    const generated = await generatedSource();
    const paths = [...generated.matchAll(/__DECOR_ASSET__(images\/.*?)__/g)].map(
      (match) => match[1]!,
    );
    expect(paths.length).toBeGreaterThan(0);
    expect([...new Set(paths)].filter((path) => !(decorStoreAssetId(path) in themeAssets))).toEqual(
      [],
    );
  });
});
