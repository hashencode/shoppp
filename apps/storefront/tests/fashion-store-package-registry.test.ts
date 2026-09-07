import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { themePackageSchema } from "@shoppp/contracts";

import {
  FASHION_STORE_HISTORICAL_V1_PACKAGE_SHA256,
  fashionStoreDirectMigrationBoundaries,
  fashionStoreHistoricalPackages,
  fashionStorePackageRegistrations,
  fashionStoreSuccessorPackage,
} from "../app/themes/fashion-store/package-registry";

describe("Fashion Store exact package registry", () => {
  test("retains the supported 1.0.0 source package as byte-stable immutable history", async () => {
    const source = await readFile(
      resolve(import.meta.dir, "../app/themes/fashion-store/historical/1.0.0/theme-package.json"),
      "utf8",
    );
    const digest = new Bun.CryptoHasher("sha256").update(source).digest("hex");
    const parsed = themePackageSchema.parse(JSON.parse(source));

    expect(digest).toBe(FASHION_STORE_HISTORICAL_V1_PACKAGE_SHA256);
    expect(parsed).toEqual(fashionStoreHistoricalPackages[0]);
    expect(parsed.manifest).toMatchObject({
      configurationSchemaVersion: 1,
      id: "fashion-store",
      themeVersion: "1.0.0",
    });
    expect(parsed.presets.map(({ id }) => id)).toEqual(["source-parity"]);
    expect(Object.isFrozen(fashionStoreHistoricalPackages[0])).toBe(true);
    expect(Object.isFrozen(fashionStoreHistoricalPackages[0]!.manifest)).toBe(true);
    expect(Object.isFrozen(fashionStoreHistoricalPackages)).toBe(true);
  });

  test("isolates the successor package and declares every direct source boundary", () => {
    expect(fashionStoreSuccessorPackage.manifest).toMatchObject({
      configurationSchemaVersion: 2,
      id: "fashion-store",
      themeVersion: "1.1.0",
    });
    expect(fashionStoreDirectMigrationBoundaries).toEqual([
      {
        source: { configurationSchemaVersion: 1, themeVersion: "1.0.0" },
        target: { configurationSchemaVersion: 2, themeVersion: "1.1.0" },
        themeId: "fashion-store",
      },
    ]);
    expect(
      fashionStorePackageRegistrations.map(({ lifecycle, package: themePackage }) => ({
        lifecycle,
        schemaVersion: themePackage.manifest.configurationSchemaVersion,
        themeVersion: themePackage.manifest.themeVersion,
      })),
    ).toEqual([
      {
        lifecycle: "historical",
        schemaVersion: 1,
        themeVersion: "1.0.0",
      },
      {
        lifecycle: "successor",
        schemaVersion: 2,
        themeVersion: "1.1.0",
      },
    ]);
    expect(Object.isFrozen(fashionStorePackageRegistrations)).toBe(true);
    expect(Object.isFrozen(fashionStoreDirectMigrationBoundaries)).toBe(true);
    expect(Object.isFrozen(fashionStoreDirectMigrationBoundaries[0]?.source)).toBe(true);
  });

  test("keeps the checked-in Fashion preview runtime on the successor package path", async () => {
    const activeTheme = await readFile(
      resolve(import.meta.dir, "../app/generated/active-theme.ts"),
      "utf8",
    );

    expect(activeTheme).toContain('from "../themes/fashion-store/successor/registry"');
    expect(activeTheme).toContain('from "../themes/fashion-store/successor/fixture-registry"');
    expect(activeTheme).not.toContain('from "../themes/fashion-store/registry"');
    expect(activeTheme).not.toContain('from "../themes/fashion-store/fixture-registry"');
    expect(activeTheme).toContain('"configurationSchemaVersion": 2');
    expect(activeTheme).toContain('"themeVersion": "1.1.0"');
  });
});
