import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { themePackageSchema } from "@shoppp/contracts";

import {
  FASHION_STORE_HISTORICAL_V1_PACKAGE_SHA256,
  FASHION_STORE_V11_PACKAGE_SHA256,
  fashionStoreReaderCompatibilityMatrix,
  fashionStoreDirectMigrationBoundaries,
  fashionStoreHistoricalPackages,
  fashionStorePackageRegistrations,
  fashionStoreSuccessorPackage,
  fashionStoreV11Package,
  resolveFashionStoreReader,
} from "../app/themes/fashion-store/package-registry";
import {
  migrateFashionStorePresentationOnlyOverrides,
  migrateFashionStoreV1Overrides,
} from "../app/themes/fashion-store/migrations";
import { fixtureThemeRegistry as baseFixtureRegistry } from "../app/themes/fashion-store/fixture-registry";
import { themeRegistry as baseLiveRegistry } from "../app/themes/fashion-store/registry";
import { fashionStoreHomeSections } from "../app/themes/fashion-store/successor/composition";
import { fixtureThemeRegistry as successorFixtureRegistry } from "../app/themes/fashion-store/successor/fixture-registry";
import { themeRegistry as successorLiveRegistry } from "../app/themes/fashion-store/successor/registry";
import { requireFashionStoreRegistryIdentity } from "./support/fashion-store-presentation-boundary";

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
      configurationSchemaVersion: 3,
      id: "fashion-store",
      themeVersion: "1.2.0",
    });
    expect(fashionStoreDirectMigrationBoundaries).toEqual([
      {
        source: { configurationSchemaVersion: 1, themeVersion: "1.0.0" },
        target: { configurationSchemaVersion: 2, themeVersion: "1.1.0" },
        themeId: "fashion-store",
      },
      {
        source: { configurationSchemaVersion: 2, themeVersion: "1.1.0" },
        target: { configurationSchemaVersion: 3, themeVersion: "1.2.0" },
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
      {
        lifecycle: "successor",
        schemaVersion: 3,
        themeVersion: "1.2.0",
      },
    ]);
    expect(Object.isFrozen(fashionStorePackageRegistrations)).toBe(true);
    expect(Object.isFrozen(fashionStoreDirectMigrationBoundaries)).toBe(true);
    expect(Object.isFrozen(fashionStoreDirectMigrationBoundaries[0]?.source)).toBe(true);
    expect(fashionStoreSuccessorPackage.presets.map(({ id }) => id)).toEqual([
      "source-parity",
      "unified-store",
    ]);
  });

  test("freezes the exact 1.1.0 package bytes independently from 1.2.0 defaults", () => {
    const bytes = `${JSON.stringify(fashionStoreV11Package, null, 2)}\n`;
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

    expect(digest).toBe(FASHION_STORE_V11_PACKAGE_SHA256);
    expect(fashionStoreV11Package.manifest).toMatchObject({
      configurationSchemaVersion: 2,
      themeVersion: "1.1.0",
    });
    expect(fashionStoreV11Package).not.toBe(fashionStoreSuccessorPackage);
    expect(fashionStoreV11Package.presets).not.toBe(fashionStoreSuccessorPackage.presets);
    expect(Object.isFrozen(fashionStoreV11Package)).toBe(true);
  });

  test("freezes the supported Release × Experience × Fashion reader matrix", () => {
    expect(fashionStoreReaderCompatibilityMatrix).toEqual([
      {
        experienceSchemaVersion: 1,
        packageVersion: "1.0.0",
        reader: "legacy",
        releaseSchemaVersion: 2,
      },
      {
        experienceSchemaVersion: 2,
        packageVersion: "1.1.0",
        reader: "legacy",
        releaseSchemaVersion: 2,
      },
      {
        experienceSchemaVersion: 2,
        packageVersion: "1.1.0",
        reader: "legacy",
        releaseSchemaVersion: 3,
      },
      {
        experienceSchemaVersion: 3,
        packageVersion: "1.2.0",
        reader: "canonical",
        releaseSchemaVersion: 3,
      },
    ]);
  });

  test("rejects every tuple outside the exhaustive reader cross-product", () => {
    const supported = new Map(
      fashionStoreReaderCompatibilityMatrix.map((entry) => [
        `${entry.releaseSchemaVersion}/${entry.experienceSchemaVersion}/${entry.packageVersion}`,
        entry.reader,
      ]),
    );
    for (const releaseSchemaVersion of [2, 3]) {
      for (const experienceSchemaVersion of [1, 2, 3]) {
        for (const packageVersion of ["1.0.0", "1.1.0", "1.2.0"]) {
          expect(
            resolveFashionStoreReader({
              experienceSchemaVersion,
              packageVersion,
              releaseSchemaVersion,
            }),
            `Release${releaseSchemaVersion}/Config${experienceSchemaVersion}/Package${packageVersion}`,
          ).toBe(
            supported.get(`${releaseSchemaVersion}/${experienceSchemaVersion}/${packageVersion}`),
          );
        }
      }
    }
    expect(supported.size).toBe(4);
  });

  test("removes legacy claim writes while retaining presentation-only operations", () => {
    const source = [
      {
        operations: [
          {
            instanceId: "fashion-store-home-hero",
            kind: "set-setting" as const,
            settingId: "footer-contact-copy",
            value: "support@example.test",
          },
          {
            instanceId: "fashion-store-product",
            kind: "set-setting" as const,
            settingId: "payment-brand-visa",
            value: true,
          },
          {
            instanceId: "fashion-store-home-hero",
            kind: "set-setting" as const,
            settingId: "identity-logo-width",
            value: 180,
          },
        ],
        presetId: "source-parity",
        schemaVersion: 2,
        templateId: "fashion-store-home",
      },
    ];

    expect(migrateFashionStorePresentationOnlyOverrides(source)).toEqual([
      { ...source[0], schemaVersion: 3, operations: [source[0]!.operations[2]] },
    ]);
    expect(source[0]!.schemaVersion).toBe(2);
  });

  test("migrates v1 overrides without changing their preset identity", () => {
    const source = [
      {
        operations: [
          {
            instanceIds: ["fashion-store-home"],
            kind: "reorder-sections" as const,
          },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting" as const,
            settingId: "announcement-text",
            value: "Migrated announcement",
          },
        ],
        presetId: "source-parity",
        schemaVersion: 1,
        templateId: "fashion-store-home",
      },
    ];

    const migrated = migrateFashionStoreV1Overrides(source);

    expect(migrated).toEqual([
      {
        ...source[0],
        operations: [
          {
            instanceIds: fashionStoreHomeSections.map(({ id }) => id),
            kind: "reorder-sections",
          },
          source[0]!.operations[1],
        ],
        schemaVersion: 2,
      },
    ]);
    expect(source[0]!.schemaVersion).toBe(1);
    expect(source[0]!.operations[0]).toEqual({
      instanceIds: ["fashion-store-home"],
      kind: "reorder-sections",
    });
    const firstSuccessor = migrateFashionStorePresentationOnlyOverrides(migrated);
    const historicalReread = structuredClone(source);
    const secondSuccessor = migrateFashionStorePresentationOnlyOverrides(
      migrateFashionStoreV1Overrides(historicalReread),
    );
    expect(secondSuccessor).toEqual(firstSuccessor);
    expect(historicalReread).toEqual(source);
    expect(migrateFashionStoreV1Overrides([])).toEqual([]);
  });

  test("moves legacy merchandising visibility and order onto the Best Sellers section", () => {
    const source = [
      {
        operations: [
          {
            instanceIds: ["fashion-store-home"],
            kind: "reorder-sections" as const,
          },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting" as const,
            settingId: "merchandising-order",
            value: 2,
          },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting" as const,
            settingId: "merchandising-visible",
            value: false,
          },
        ],
        presetId: "source-parity",
        schemaVersion: 1,
        templateId: "fashion-store-home",
      },
    ];

    const [migrated] = migrateFashionStoreV1Overrides(source);
    const bestSellersId = fashionStoreHomeSections.find(
      ({ fixtureResource }) => fixtureResource === "best-sellers",
    )!.id;
    const productMerchandisingId = fashionStoreHomeSections.find(
      ({ fixtureResource }) => fixtureResource === "product-merchandising",
    )!.id;
    const reorder = migrated!.operations.find(({ kind }) => kind === "reorder-sections");

    expect(migrated!.operations).toContainEqual({
      instanceId: bestSellersId,
      kind: "set-visibility",
      visible: false,
    });
    expect(reorder).toMatchObject({ kind: "reorder-sections" });
    expect(reorder?.kind === "reorder-sections" && reorder.instanceIds[1]).toBe(bestSellersId);
    expect(reorder?.kind === "reorder-sections" && reorder.instanceIds.at(-1)).toBe(
      productMerchandisingId,
    );
    expect(
      migrated!.operations.some(
        (operation) => operation.kind === "set-setting" || operation.kind === "reset-setting",
      ),
    ).toBe(false);

    const [reset] = migrateFashionStoreV1Overrides([
      {
        ...source[0]!,
        operations: [
          {
            instanceId: "fashion-store-home",
            kind: "reset-setting",
            settingId: "merchandising-order",
          },
          {
            instanceId: "fashion-store-home",
            kind: "reset-setting",
            settingId: "merchandising-visible",
          },
        ],
      },
    ]);
    const resetReorder = reset!.operations.find(({ kind }) => kind === "reorder-sections");
    expect(resetReorder?.kind === "reorder-sections" && resetReorder.instanceIds[0]).toBe(
      bestSellersId,
    );
    expect(reset!.operations).toContainEqual({
      instanceId: bestSellersId,
      kind: "set-visibility",
      visible: true,
    });
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
    expect(activeTheme).toContain('"configurationSchemaVersion": 3');
    expect(activeTheme).toContain('"themeVersion": "1.2.0"');
  });

  test("shares exact component identity and rejects any synthetic visual divergence", () => {
    for (const [live, fixture] of [
      [baseLiveRegistry, baseFixtureRegistry],
      [successorLiveRegistry, successorFixtureRegistry],
    ] as const) {
      expect(Object.keys(fixture.sections).sort()).toEqual(Object.keys(live.sections).sort());
      for (const type of Object.keys(live.sections)) {
        expect(fixture.sections[type]).toBe(live.sections[type]);
      }
    }

    expect(() =>
      requireFashionStoreRegistryIdentity(
        'import Shared from "./Shared.vue";\nsections: {\n  "fashion-store.hero": Shared,\n}',
        'import Fork from "./Fork.vue";\nsections: {\n  "fashion-store.hero": Fork,\n}',
      ),
    ).toThrow("fashion-store.hero");
    expect(() =>
      requireFashionStoreRegistryIdentity(
        'import Shared from "./Shared.vue";\nsections: {\n  "fashion-store.hero": Shared,\n}',
        'import Shared from "./Shared.vue";\nsections: {\n  "fashion-store.hero": Shared,\n}',
      ),
    ).not.toThrow();
    expect(() =>
      requireFashionStoreRegistryIdentity(
        'import Shared from "./Shared.vue";\nsections: {\n  "fashion-store.hero": Shared,\n}',
        "sections: {}",
      ),
    ).toThrow("fashion-store.hero");
  });
});
