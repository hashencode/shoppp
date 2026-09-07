import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  decorStoreBehaviorContract,
  decorStoreSecondaryPageBehaviorLedger,
} from "../theme-references/decor-store/behavior-contract";
import { decorStoreSourceRegionOrder } from "../theme-references/decor-store/source-contract";
import {
  classifyLegacyInteraction,
  legacyAssetGroups,
  legacyComponentDispositions,
  legacyFixtureDispositions,
  legacyRegistrySectionDispositions,
  legacyRouteDispositions,
  legacyRuntimeDispositions,
  legacySelectableSurfaces,
  legacySourceRegionDispositions,
  unifiedHomeSectionIA,
} from "../app/themes/fashion-store/unification-disposition";

const themesRoot = resolve(import.meta.dir, "../app/themes");
const repositoryRoot = resolve(import.meta.dir, "../../..");

describe("Fashion and Decor unification inventory", () => {
  test("retains a unique disposition for every deleted legacy implementation unit", () => {
    for (const rows of [
      legacyComponentDispositions,
      legacyFixtureDispositions,
      legacyRuntimeDispositions,
    ]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map(({ source }) => source)).size).toBe(rows.length);
    }
  });

  test("keeps route, source-region, and interaction disposition evidence reference-only", () => {
    expect(
      new Set(legacyRegistrySectionDispositions.map(({ sourceType }) => sourceType)).size,
    ).toBe(legacyRegistrySectionDispositions.length);
    expect(new Set(legacyRouteDispositions.map(({ id }) => id)).size).toBe(
      legacyRouteDispositions.length,
    );
    expect(legacySourceRegionDispositions.map(({ id }) => id)).toEqual(decorStoreSourceRegionOrder);

    const interactions = [
      ...decorStoreBehaviorContract.behaviors.map(({ id }) => id),
      ...decorStoreSecondaryPageBehaviorLedger.map(({ id }) => id),
    ];
    for (const interaction of interactions)
      expect(classifyLegacyInteraction(interaction), interaction).toBeDefined();
  });

  test("keeps one inherited Hero, Fashion-owned commerce, and a Fashion-first fixed IA", () => {
    const hero = legacyRegistrySectionDispositions.filter(
      ({ capability }) => capability === "hero",
    );
    expect(hero).toEqual([
      expect.objectContaining({
        disposition: "fashion-reuse",
        targetOwner: "FashionStoreDecorHero",
      }),
    ]);
    for (const row of legacyRouteDispositions.filter(({ pageRole }) => pageRole === "commerce"))
      expect(row.disposition).toBe("fashion-reuse");

    expect(unifiedHomeSectionIA[0]).toMatchObject({
      id: "fashion-store-home",
      required: true,
      visible: true,
    });
    expect(unifiedHomeSectionIA.filter(({ visible }) => visible).length).toBeGreaterThan(0);
    expect(new Set(unifiedHomeSectionIA.map(({ id }) => id)).size).toBe(
      unifiedHomeSectionIA.length,
    );
    expect(unifiedHomeSectionIA.every(({ adminLabel }) => !/decor/i.test(adminLabel))).toBe(true);
  });

  test("retires both selectable identities while retaining their classified evidence", async () => {
    for (const surface of legacySelectableSurfaces) {
      const source = await readFile(resolve(repositoryRoot, surface.source), "utf8");
      if (surface.source.endsWith("storefront-source-equivalence-policy.json")) {
        const activeIds = JSON.parse(source).themes.map(({ id }: { id: string }) => id);
        expect(activeIds).toEqual(["fashion-store"]);
        continue;
      }
      expect(source).not.toMatch(/["']decor["']/);
      expect(source).not.toMatch(/["']decor-store["']/);
    }
    expect(legacyAssetGroups.map(({ id }) => id)).toEqual([
      "decor-presentation-images",
      "decor-store-source-images",
      "decor-store-placeholder",
      "decor-store-fonts",
      "decor-store-runtime-styles",
      "decor-store-runtime-scripts",
    ]);
    expect(existsSync(resolve(themesRoot, "decor"))).toBe(false);
    expect(existsSync(resolve(themesRoot, "decor-store"))).toBe(false);

    const evidence = await readFile(
      resolve(repositoryRoot, "docs/progress/fashion-decor-component-disposition.md"),
      "utf8",
    );
    for (const row of legacyRegistrySectionDispositions)
      expect(evidence).toContain(`\`${row.sourceType}\``);
    for (const section of unifiedHomeSectionIA) expect(evidence).toContain(`\`${section.id}\``);
  });
});
