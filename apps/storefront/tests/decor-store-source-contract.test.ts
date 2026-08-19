import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  decorStoreAbsenceContract,
  decorStoreAcceptanceModes,
  decorStoreCanonicalViewports,
  decorStoreSecondaryPageSourceContracts,
  decorStoreSourceActions,
  decorStoreSourceContract,
  decorStoreSourceRegionOrder,
  decorStoreSourceRegions,
} from "../app/themes/decor-store/source-contract";
import {
  decorStoreBehaviorContract,
  decorStoreFidelityStatesByRegion,
  decorStoreNamedStateContracts,
  decorStoreSecondaryPageBehaviorLedger,
} from "../app/themes/decor-store/behavior-contract";
import { decorStoreAcceptanceAdapters } from "../app/themes/decor-store/acceptance-adapter";
import { prepareDecorStoreMarkup } from "../app/themes/decor-store/runtime/source-markup";
import { assertThemeBehaviorContractComplete } from "../e2e/support/theme-behavior-contract";
import { assertCustomBehaviorAdaptersRegistered } from "../e2e/support/theme-behavior-runner";
import {
  compareSourceContractSnapshots,
  type SourceContractSnapshot,
} from "../e2e/support/theme-source-contract";

const sourcePath = resolve(
  import.meta.dir,
  "../../../templates/Crafto - The Multipurpose HTML5 Template/html/demo-decor-store.html",
);
const repositoryRoot = resolve(import.meta.dir, "../../..");

describe("Decor Store source contracts", () => {
  test("freezes source regions, controls, interactions, and placeholder adaptations for all secondary pages", async () => {
    expect(decorStoreSecondaryPageSourceContracts).toHaveLength(14);
    for (const page of decorStoreSecondaryPageSourceContracts) {
      const markup = await readFile(
        resolve(
          repositoryRoot,
          "templates/Crafto - The Multipurpose HTML5 Template/html",
          page.sourceEntry,
        ),
        "utf8",
      );
      expect(markup.match(/<section\b/g) ?? [], page.id).toHaveLength(page.sectionCount);
      expect(markup.match(/<form\b/g) ?? [], `${page.id}/forms`).toHaveLength(page.formCount);
      expect(markup.match(/<input\b/g) ?? [], `${page.id}/inputs`).toHaveLength(page.inputCount);
      expect(markup.match(/<button\b/g) ?? [], `${page.id}/buttons`).toHaveLength(page.buttonCount);
      expect(page.regions.length, `${page.id}/regions`).toBeGreaterThan(0);
      expect(page.interactions.length, `${page.id}/interactions`).toBeGreaterThan(0);
      expect(page.comparisonViewports).toEqual([1440, 1024, 768, 390]);
      for (const adaptation of page.placeholderAdaptations) {
        expect(markup).toContain(`https://via.placeholder.com/${adaptation.sourceDimensions}`);
        expect(adaptation.localAsset).toBe("decor-store.images-decor-store-placeholder");
        expect(adaptation.claimExclusion).toBe("image-content");
      }
    }
  });

  test("assigns every secondary interaction an observable transition and safe owner", () => {
    const expected = decorStoreSecondaryPageSourceContracts.flatMap((page) =>
      page.interactions.map((interaction) => `${page.id}:${interaction}`),
    );
    expect(decorStoreSecondaryPageBehaviorLedger.map(({ id }) => id)).toEqual(expected);
    for (const row of decorStoreSecondaryPageBehaviorLedger) {
      expect(row.trigger.length, `${row.id}/trigger`).toBeGreaterThan(0);
      expect(row.initialState.length, `${row.id}/initial`).toBeGreaterThan(0);
      expect(row.visibleOutcome.length, `${row.id}/outcome`).toBeGreaterThan(0);
      expect(row.closeOrReset.length, `${row.id}/reset`).toBeGreaterThan(0);
      expect(row.evidence.length, `${row.id}/evidence`).toBeGreaterThan(0);
      expect(row.implementationOwner).not.toBe("crafto-main-js");
      expect(row.businessEffect).toBe("none");
    }
  });

  test("prioritizes only the first Hero slide and defers below-the-fold source images", () => {
    const resolveAsset = (id: string) => `/assets/${id}`;
    const hero = prepareDecorStoreMarkup(
      '<ul><li><img src="images/first.png"></li><li><img src="images/second.png"></li></ul>',
      resolveAsset,
      "hero",
    );
    const body = prepareDecorStoreMarkup('<img src="images/body.png">', resolveAsset, "deferred");
    expect(hero).toContain('<img decoding="async" src="/assets/decor-store.images-first">');
    expect(hero).toContain(
      '<img loading="lazy" decoding="async" src="/assets/decor-store.images-second">',
    );
    expect(body).toContain(
      '<img loading="lazy" decoding="async" src="/assets/decor-store.images-body">',
    );
  });

  test("inventories every visible region and actionable element in source order", async () => {
    const markup = await readFile(sourcePath, "utf8");

    expect(decorStoreSourceRegionOrder).toEqual([
      "header",
      "hero",
      "featured-categories",
      "products",
      "promotional-marquee",
      "collection-carousel",
      "client-marquee",
      "journal",
      "services",
      "footer",
      "cookie",
      "sticky",
      "scroll-progress",
    ]);
    expect(markup.match(/<section\b/g)).toHaveLength(8);
    for (const region of decorStoreSourceRegions) {
      expect(markup.includes(region.sourceAnchor), region.key).toBe(true);
      for (const inventory of region.itemInventories)
        expect(markup.match(inventory.sourcePattern) ?? [], inventory.id).toHaveLength(
          inventory.count,
        );
    }

    expect(decorStoreSourceActions.map(({ count, id }) => ({ count, id }))).toEqual([
      { count: 244, id: "anchors" },
      { count: 4, id: "buttons" },
      { count: 2, id: "inputs" },
    ]);
    expect(markup.match(/<a\b[^>]*\bhref=/g)).toHaveLength(244);
    expect(markup.match(/<button\b/g)).toHaveLength(4);
    expect(markup.match(/<input\b(?![^>]*type=["']hidden["'])/g)).toHaveLength(2);
  });

  test("defines all five modes, four canonical viewports, named evidence families, and a complete behavior ledger", () => {
    expect(decorStoreAcceptanceModes).toEqual([
      "static",
      "temporal",
      "interaction",
      "scroll-fixed",
      "fallback",
    ]);
    expect(decorStoreCanonicalViewports).toEqual([
      { height: 1000, id: "desktop", width: 1440 },
      { height: 900, id: "laptop", width: 1024 },
      { height: 1024, id: "tablet", width: 768 },
      { height: 844, id: "mobile", width: 390 },
    ]);
    expect(() =>
      assertThemeBehaviorContractComplete(decorStoreBehaviorContract, decorStoreSourceRegionOrder),
    ).not.toThrow();
    expect(() =>
      assertCustomBehaviorAdaptersRegistered(
        decorStoreBehaviorContract,
        decorStoreAcceptanceAdapters,
      ),
    ).not.toThrow();

    const states = new Set([
      ...decorStoreNamedStateContracts.map(({ id }) => id),
      ...Object.values(decorStoreFidelityStatesByRegion).flat(),
    ]);
    for (const required of [
      "initial",
      "hero-slide-1",
      "hero-slide-2",
      "hero-slide-3",
      "hero-transition",
      "header-language-open",
      "header-menu-open",
      "mobile-menu-open",
      "product-tab-new-arrivals",
      "product-card-hover",
      "collection-moving",
      "promotional-marquee-moving",
      "client-marquee-moving",
      "cookie-visible",
      "scroll-progress-visible",
      "reduced-motion",
      "hero-dependency-failure",
    ])
      expect(states.has(required), required).toBe(true);
    expect(decorStoreSourceContract.assertionFacets).toEqual(
      expect.arrayContaining([
        "inventory",
        "geometry",
        "typography",
        "runtime",
        "timing",
        "focus",
        "accessibility",
        "overflow",
        "images",
        "console",
        "network",
        "teardown",
        "remount",
        "isolation",
        "performance",
      ]),
    );
    expect(decorStoreAbsenceContract).toMatchObject({
      allowedVisibleDifferenceCount: 0,
      waiverTarget: 0,
    });
    expect(decorStoreAbsenceContract.comparisonFailures).toEqual(
      expect.arrayContaining([
        "source-only-visible-copy",
        "implementation-only-visible-copy",
        "changed-visible-copy",
        "remote-or-broken-resource",
        "php-request",
        "console-error",
        "post-unmount-owned-residue",
        "cross-theme-import",
      ]),
    );
  });

  test("rejects a controlled Decor Hero geometry mismatch and accepts the clean baseline", () => {
    const baseline: SourceContractSnapshot = {
      documentHeight: 8000,
      probes: [
        {
          count: 1,
          content: true,
          geometry: true,
          elements: [
            {
              asset: "demo-decor-store-slider-01-img-01.png",
              href: null,
              rect: { bottom: 900, height: 900, left: 0, right: 1440, top: 0, width: 1440 },
              styles: { "font-family": '"Poppins"', "font-size": "120px" },
              text: "Designed for your home",
              visible: true,
            },
          ],
          id: "hero",
        },
      ],
      viewport: { height: 1000, width: 1440 },
    };
    expect(compareSourceContractSnapshots(baseline, structuredClone(baseline))).toEqual([]);

    const mismatch = structuredClone(baseline);
    mismatch.probes[0]!.elements[0]!.rect.height = 896;
    expect(compareSourceContractSnapshots(baseline, mismatch)).toEqual([
      "hero[0] height: expected 900px, received 896px",
    ]);
  });

  test("pins the complete local source intake and exact Hero chain without forbidden runtime", async () => {
    const manifest = JSON.parse(
      await readFile(
        resolve(repositoryRoot, "tools/storefront-theme-source-manifest.json"),
        "utf8",
      ),
    );
    const policy = JSON.parse(
      await readFile(
        resolve(repositoryRoot, "tools/storefront-source-equivalence-policy.json"),
        "utf8",
      ),
    );
    const declaration = manifest.themes.find(
      ({ themeId }: { themeId: string }) => themeId === "decor-store",
    );
    const intake = policy.sourceIntakes.find(({ id }: { id: string }) => id === "decor-store");

    expect(declaration.sourceRevision).toBe(`sha256:${decorStoreSourceContract.sourceEntrySha256}`);
    expect(declaration.importedAt).toBe("2026-08-11");
    expect(declaration.importedFiles).toHaveLength(122);
    expect(
      declaration.importedFiles.every(
        ({ destinationPath, sha256 }: { destinationPath: string; sha256: string }) =>
          declaration.allowlist.some(
            (asset: { destinationPath: string; expectedSha256: string }) =>
              asset.destinationPath === destinationPath && asset.expectedSha256 === sha256,
          ),
      ),
    ).toBe(true);
    expect(intake.sourceEntrySha256).toBe(decorStoreSourceContract.sourceEntrySha256);
    expect(intake.stylesheetOrder).toEqual(decorStoreSourceContract.stylesheetOrder);
    expect(intake.scriptOrder).toEqual(decorStoreSourceContract.scriptOrder);
    expect(intake.acceptanceModes).toEqual(decorStoreAcceptanceModes);
    expect(intake.canonicalViewports).toEqual(decorStoreCanonicalViewports);
    expect(intake.checkpoints).toEqual(decorStoreSourceContract.checkpoints);

    const declaredPaths = new Set<string>(
      declaration.allowlist.map(({ sourcePath }: { sourcePath: string }) => sourcePath),
    );
    for (const dependency of intake.requiredHeroDependencies)
      expect(declaredPaths.has(dependency), dependency).toBe(true);
    expect(declaredPaths.has("js/main.js")).toBe(false);
    expect(
      declaredPaths.has(
        "revolution/revolution-addons/particles/js/revolution.addon.particles.min.js",
      ),
    ).toBe(false);
    expect([...declaredPaths].some((path) => path.endsWith(".php"))).toBe(false);

    for (const asset of declaration.allowlist) {
      const absolutePath = resolve(
        repositoryRoot,
        asset.supplementalSourcePath ??
          `templates/Crafto - The Multipurpose HTML5 Template/html/${asset.sourcePath}`,
      );
      const contents = new Uint8Array(await readFile(absolutePath));
      expect(new Bun.CryptoHasher("sha256").update(contents).digest("hex"), asset.sourcePath).toBe(
        asset.expectedSha256,
      );
    }
  });
});
