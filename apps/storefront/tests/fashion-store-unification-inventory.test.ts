import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  decorStoreBehaviorContract,
  decorStoreSecondaryPageBehaviorLedger,
} from "../app/themes/decor-store/behavior-contract";
import { decorStoreEnabledPageContracts } from "../app/themes/decor-store/page-contracts";
import { decorStoreSourceRegionOrder } from "../app/themes/decor-store/source-contract";
import { themeAssets as decorStoreAssets } from "../app/themes/decor-store/resources";
import { decorThemeRoutes } from "../app/themes/decor/page-contracts";
import { themeAssets as decorAssets } from "../app/themes/decor/resources";
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

async function filesUnder(root: string, suffix: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => relative(themesRoot, resolve(entry.parentPath, entry.name)))
    .sort();
}

describe("Fashion and Decor unification inventory", () => {
  test("assigns every legacy component, fixture, and runtime file exactly one disposition", async () => {
    const components = [
      ...(await filesUnder(resolve(themesRoot, "decor/components"), ".vue")),
      ...(await filesUnder(resolve(themesRoot, "decor-store/components"), ".vue")),
    ].sort();
    const fixtures = [
      ...(await filesUnder(resolve(themesRoot, "decor/fixtures"), ".ts")),
      ...(await filesUnder(resolve(themesRoot, "decor-store/fixtures"), ".ts")),
    ].sort();
    const runtime = await filesUnder(resolve(themesRoot, "decor-store/runtime"), ".ts");

    expect(legacyComponentDispositions.map(({ source }) => source).sort()).toEqual(components);
    expect(legacyFixtureDispositions.map(({ source }) => source).sort()).toEqual(fixtures);
    expect(legacyRuntimeDispositions.map(({ source }) => source).sort()).toEqual(runtime);
  });

  test("covers every registry section, route, source region, and interaction", async () => {
    const registrySources = ["decor/registry.ts", "decor-store/registry.ts"];
    const registryTypes = (
      await Promise.all(
        registrySources.map(async (source) => {
          const code = await readFile(resolve(themesRoot, source), "utf8");
          return [...code.matchAll(/"((?:decor|decor-store)\.[^"]+)"\s*:/g)].map(
            (match) => match[1]!,
          );
        }),
      )
    ).flat();
    const inventoriedTypes = registrySources.flatMap((source) => {
      const identity = source.split("/")[0]!;
      return legacyRegistrySectionDispositions
        .filter((row) => row.identity === identity)
        .map(({ sourceType }) => sourceType);
    });
    expect(inventoriedTypes.sort()).toEqual(registryTypes.sort());

    const routes = [
      ...decorThemeRoutes.map(({ id }) => `decor:${id}`),
      ...decorStoreEnabledPageContracts.map(({ id }) => `decor-store:${id}`),
    ];
    expect(legacyRouteDispositions.map(({ id }) => id)).toEqual(routes);
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

  test("freezes selectable surfaces and grouped asset ownership in retained evidence", async () => {
    for (const surface of legacySelectableSurfaces) {
      const source = await readFile(resolve(repositoryRoot, surface.source), "utf8");
      for (const identity of surface.identities) expect(source).toContain(identity);
    }
    expect(legacyAssetGroups.map(({ id }) => id)).toEqual([
      "decor-presentation-images",
      "decor-store-source-images",
      "decor-store-placeholder",
      "decor-store-fonts",
      "decor-store-runtime-styles",
      "decor-store-runtime-scripts",
    ]);
    expect(Object.keys(decorAssets)).toHaveLength(82);
    expect(Object.keys(decorStoreAssets).filter((id) => id.includes("images-"))).toHaveLength(95);
    expect(Object.keys(decorStoreAssets).filter((id) => id.includes("fonts-"))).toHaveLength(9);
    expect(await filesUnder(resolve(themesRoot, "decor-store/upstream"), ".css")).toHaveLength(8);
    expect(await filesUnder(resolve(themesRoot, "decor-store/upstream"), ".js")).toHaveLength(8);

    const evidence = await readFile(
      resolve(repositoryRoot, "docs/progress/fashion-decor-component-disposition.md"),
      "utf8",
    );
    for (const row of legacyRegistrySectionDispositions)
      expect(evidence).toContain(`\`${row.sourceType}\``);
    for (const section of unifiedHomeSectionIA) expect(evidence).toContain(`\`${section.id}\``);
  });
});
