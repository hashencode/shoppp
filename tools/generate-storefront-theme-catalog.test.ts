import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  generateStorefrontThemeCatalog,
  storefrontThemeDescriptors,
  verifyStorefrontThemeCatalog,
} from "./generate-storefront-theme-catalog";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("storefront theme catalog generation", () => {
  test("writes byte-identical API and storefront descriptors in stable order", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-theme-catalog-"));
    temporaryDirectories.push(directory);
    const apiOutput = resolve(directory, "api.ts");
    const storefrontOutput = resolve(directory, "storefront.ts");

    await generateStorefrontThemeCatalog({
      descriptors: [
        {
          configurationSchemaVersion: 1,
          id: "sample-theme",
          platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
          platformContractVersion: "1.0.0",
          presets: ["sample"],
          supportedPageTemplates: ["home"],
          themeVersion: "1.0.0",
        },
        {
          configurationSchemaVersion: 1,
          id: "decor",
          platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
          platformContractVersion: "1.0.0",
          presets: ["modern"],
          supportedPageTemplates: ["home"],
          themeVersion: "1.0.0",
        },
      ],
      outputs: [apiOutput, storefrontOutput],
    });

    expect(await readFile(apiOutput, "utf8")).toBe(await readFile(storefrontOutput, "utf8"));
    expect(await readFile(apiOutput, "utf8")).toContain('"decor"');
    expect((await readFile(apiOutput, "utf8")).indexOf('"decor"')).toBeLessThan(
      (await readFile(apiOutput, "utf8")).indexOf('"sample-theme"'),
    );
  });

  test("rejects stale or handwritten generated catalog entries", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-theme-catalog-"));
    temporaryDirectories.push(directory);
    const output = resolve(directory, "catalog.ts");
    await writeFile(output, "export const storefrontThemeCatalog = [{ id: 'handwritten' }]\n");

    await expect(
      verifyStorefrontThemeCatalog({
        descriptors: [],
        outputs: [output],
      }),
    ).rejects.toThrow("stale");
  });

  test("keeps both checked-in catalog modules current", async () => {
    expect(storefrontThemeDescriptors.map(({ id }) => id)).toEqual(["decor", "fashion-store"]);
    await expect(
      verifyStorefrontThemeCatalog({
        descriptors: storefrontThemeDescriptors,
        outputs: [
          resolve(import.meta.dir, "../apps/api/src/generated/storefront-theme-catalog.ts"),
          resolve(import.meta.dir, "../apps/storefront/app/generated/theme-catalog.ts"),
        ],
      }),
    ).resolves.toBeUndefined();
  });
});
