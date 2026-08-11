import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { fashionStoreNamedStates } from "../apps/storefront/e2e/support/theme-named-state-contract";
import {
  loadSourceEquivalencePolicy,
  validateImportedSourceTree,
  validateFidelityEvidenceRecords,
  validateSourceEquivalencePolicy,
  type SourceEquivalencePolicy,
} from "./verify-source-equivalent-themes";
import {
  captureModeForNamedState,
  captureModeForRegion,
} from "../apps/storefront/e2e/support/theme-capture-contract";
import {
  fidelityMatrixViewports,
  themeFidelityMatrix,
} from "../apps/storefront/e2e/support/theme-fidelity-matrix";
import { createThemeBehaviorDescriptor } from "../apps/storefront/e2e/support/theme-behavior-descriptor";
import { fashionStoreBehaviorContract } from "../apps/storefront/app/themes/fashion-store/behavior-contract";
import { fashionStoreAcceptanceAdapters } from "../apps/storefront/app/themes/fashion-store/acceptance-adapter";
import { fashionStoreSourceRegions } from "../apps/storefront/app/themes/fashion-store/source-contract";
import { loadThemeBehaviorDescriptors } from "./load-theme-behavior-descriptor";
import type { StorefrontThemeSourceManifest } from "./import-storefront-theme";

const root = resolve(import.meta.dir, "..");
const behaviorDescriptors = new Map([
  [
    "fashion-store",
    createThemeBehaviorDescriptor({
      adapters: fashionStoreAcceptanceAdapters,
      contract: fashionStoreBehaviorContract,
      sourceRegions: fashionStoreSourceRegions.map((region) => ({
        id: region.key,
        selector: "inventorySelector" in region ? region.inventorySelector : region.selector,
      })),
    }),
  ],
]);

describe("source-equivalent theme policy", () => {
  test("accepts the repository policy and its explicit intentional-difference waivers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    await expect(validateSourceEquivalencePolicy(policy, root)).resolves.toBeUndefined();
    expect(policy.themes.map(({ id }) => id)).toEqual(["fashion-store", "decor-store"]);
    expect(policy.sourceIntakes).toMatchObject([
      {
        acceptanceModes: ["static", "temporal", "interaction", "scroll-fixed", "fallback"],
        id: "decor-store",
        sourceEntry: "demo-decor-store.html",
        status: "contracts-frozen",
      },
    ]);
    expect(policy.themes[0]).toMatchObject({
      authorizedSourceRoot: "templates/Crafto - The Multipurpose HTML5 Template/html",
      equivalenceScope: [
        "home",
        "shop-left",
        "shop-none",
        "shop-right",
        "collection",
        "product",
        "cart",
        "checkout",
        "wishlist",
        "account",
        "magazine",
        "article",
        "about",
        "faq",
        "contact",
      ],
      pages: [
        {
          id: "home",
          implementationRoute: "/",
          pageType: "home",
          sourceEntry: "demo-fashion-store.html",
        },
        {
          id: "shop-left",
          implementationRoute: "/shop",
          pageType: "collection",
          sourceEntry: "demo-fashion-store-shop.html",
        },
        {
          id: "shop-none",
          implementationRoute: "/shop/no-sidebar",
          pageType: "collection",
          sourceEntry: "demo-fashion-store-no-sidebar.html",
        },
        {
          id: "shop-right",
          implementationRoute: "/shop/right-sidebar",
          pageType: "collection",
          sourceEntry: "demo-fashion-store-right-sidebar.html",
        },
        {
          id: "collection",
          implementationRoute: "/collections",
          pageType: "collection",
          sourceEntry: "demo-fashion-store-collection.html",
        },
        {
          id: "product",
          implementationRoute: "/products/relaxed-corduroy-shirt",
          pageType: "product",
          sourceEntry: "demo-fashion-store-single-product.html",
        },
        {
          id: "cart",
          implementationRoute: "/cart",
          pageType: "cart",
          sourceEntry: "demo-fashion-store-cart.html",
        },
        {
          id: "checkout",
          implementationRoute: "/checkout",
          pageType: "checkout",
          sourceEntry: "demo-fashion-store-checkout.html",
        },
        {
          id: "wishlist",
          implementationRoute: "/wishlist",
          pageType: "content",
          sourceEntry: "demo-fashion-store-wishlist.html",
        },
        {
          id: "account",
          implementationRoute: "/account",
          pageType: "content",
          sourceEntry: "demo-fashion-store-account.html",
        },
        {
          id: "magazine",
          implementationRoute: "/magazine",
          pageType: "content",
          sourceEntry: "demo-fashion-store-magazine.html",
        },
        {
          id: "article",
          implementationRoute: "/magazine/marketing-tips-and-tricks",
          pageType: "content",
          sourceEntry: "demo-fashion-store-blog-single-creative.html",
        },
        {
          id: "about",
          implementationRoute: "/about",
          pageType: "content",
          sourceEntry: "demo-fashion-store-about.html",
        },
        {
          id: "faq",
          implementationRoute: "/faq",
          pageType: "content",
          sourceEntry: "demo-fashion-store-faq.html",
        },
        {
          id: "contact",
          implementationRoute: "/contact",
          pageType: "content",
          sourceEntry: "demo-fashion-store-contact.html",
        },
      ],
    });
    expect(policy.themes[1]).toMatchObject({
      equivalenceScope: ["home"],
      id: "decor-store",
      pages: [
        {
          id: "home",
          implementationRoute: "/",
          pageType: "home",
          sourceEntry: "demo-decor-store.html",
        },
      ],
    });
    expect(policy.waivers).toEqual([]);
  });

  test("rejects a frozen source intake with a missing Hero dependency or digest drift", async () => {
    const missingDependency = await loadSourceEquivalencePolicy(root);
    missingDependency.sourceIntakes[0]!.requiredHeroDependencies.push(
      "revolution/js/extensions/missing.js",
    );
    await expect(validateSourceEquivalencePolicy(missingDependency, root)).rejects.toThrow(
      /Hero dependency.*missing\.js/,
    );

    const digestDrift = await loadSourceEquivalencePolicy(root);
    digestDrift.sourceIntakes[0]!.sourceEntrySha256 = "0".repeat(64);
    await expect(validateSourceEquivalencePolicy(digestDrift, root)).rejects.toThrow(
      /source intake entry digest.*source manifest revision/s,
    );
  });

  test("rejects duplicate page identities, routes, and conflicting source digests", async () => {
    const policy = (await loadSourceEquivalencePolicy(root)) as SourceEquivalencePolicy;
    const invalid = structuredClone(policy);
    const home = invalid.themes[0]!.pages[0]!;
    invalid.themes[0]!.pages.push({
      ...home,
      sourceEntrySha256: "0".repeat(64),
    });

    await expect(validateSourceEquivalencePolicy(invalid, root)).rejects.toThrow(
      /duplicate page ID.*duplicate implementation route.*conflicting source digest/s,
    );
  });

  test("loads independently addressed descriptors for a synthetic second page", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    const theme = structuredClone(policy.themes[0]!);
    const sourceEntry = "demo-fashion-store-shop.html";
    const contents = await readFile(resolve(root, theme.authorizedSourceRoot, sourceEntry));
    theme.pages.push({
      ...theme.pages[0]!,
      id: "synthetic-shop",
      implementationRoute: "/synthetic-shop",
      sourceEntry,
      sourceEntrySha256: new Bun.CryptoHasher("sha256").update(contents).digest("hex"),
    });
    const descriptors = await loadThemeBehaviorDescriptors(theme, root);

    expect([...descriptors.keys()]).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "collection",
      "product",
      "cart",
      "checkout",
      "wishlist",
      "account",
      "magazine",
      "article",
      "about",
      "faq",
      "contact",
      "synthetic-shop",
    ]);
    expect(
      theme.pages.map(({ implementationRoute, sourceEntry }) => ({
        implementationRoute,
        sourceEntry,
      })),
    ).toEqual([
      { implementationRoute: "/", sourceEntry: "demo-fashion-store.html" },
      { implementationRoute: "/shop", sourceEntry: "demo-fashion-store-shop.html" },
      {
        implementationRoute: "/shop/no-sidebar",
        sourceEntry: "demo-fashion-store-no-sidebar.html",
      },
      {
        implementationRoute: "/shop/right-sidebar",
        sourceEntry: "demo-fashion-store-right-sidebar.html",
      },
      { implementationRoute: "/collections", sourceEntry: "demo-fashion-store-collection.html" },
      {
        implementationRoute: "/products/relaxed-corduroy-shirt",
        sourceEntry: "demo-fashion-store-single-product.html",
      },
      { implementationRoute: "/cart", sourceEntry: "demo-fashion-store-cart.html" },
      { implementationRoute: "/checkout", sourceEntry: "demo-fashion-store-checkout.html" },
      { implementationRoute: "/wishlist", sourceEntry: "demo-fashion-store-wishlist.html" },
      { implementationRoute: "/account", sourceEntry: "demo-fashion-store-account.html" },
      { implementationRoute: "/magazine", sourceEntry: "demo-fashion-store-magazine.html" },
      {
        implementationRoute: "/magazine/marketing-tips-and-tricks",
        sourceEntry: "demo-fashion-store-blog-single-creative.html",
      },
      { implementationRoute: "/about", sourceEntry: "demo-fashion-store-about.html" },
      { implementationRoute: "/faq", sourceEntry: "demo-fashion-store-faq.html" },
      { implementationRoute: "/contact", sourceEntry: "demo-fashion-store-contact.html" },
      { implementationRoute: "/synthetic-shop", sourceEntry: "demo-fashion-store-shop.html" },
    ]);
  });

  test("rejects empty page scope and page types outside the theme manifest", async () => {
    const empty = structuredClone(await loadSourceEquivalencePolicy(root));
    empty.themes[0]!.equivalenceScope = [];
    empty.themes[0]!.pages = [];
    await expect(validateSourceEquivalencePolicy(empty, root)).rejects.toThrow(
      /equivalence scope is empty.*page collection is empty/s,
    );

    const unsupported = structuredClone(await loadSourceEquivalencePolicy(root));
    unsupported.themes[0]!.pages[0]!.pageType = "order";
    await expect(validateSourceEquivalencePolicy(unsupported, root)).rejects.toThrow(
      /page type order is absent from the theme manifest/,
    );
  });

  test("rejects page source escapes, missing files, and digest drift before browser work", async () => {
    const policy = structuredClone(await loadSourceEquivalencePolicy(root));
    const page = policy.themes[0]!.pages[0]!;
    page.sourceEntry = "../demo-fashion-store.html";
    page.sourceEntrySha256 = "0".repeat(64);
    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /home: authorized source entry is missing or outside its root/,
    );

    const missing = structuredClone(await loadSourceEquivalencePolicy(root));
    missing.themes[0]!.pages[0]!.sourceEntry = "missing.html";
    await expect(validateSourceEquivalencePolicy(missing, root)).rejects.toThrow(
      /home: authorized source entry is missing or outside its root/,
    );

    const drifted = structuredClone(await loadSourceEquivalencePolicy(root));
    drifted.themes[0]!.pages[0]!.sourceEntrySha256 = "0".repeat(64);
    await expect(validateSourceEquivalencePolicy(drifted, root)).rejects.toThrow(
      /home: authorized source entry digest does not match policy/,
    );

    const symlinkRoot = await mkdtemp(resolve(tmpdir(), "shoppp-source-entry-symlink-"));
    try {
      await symlink(
        resolve(
          root,
          "templates/Crafto - The Multipurpose HTML5 Template/html/demo-fashion-store.html",
        ),
        resolve(symlinkRoot, "escaped.html"),
      );
      const escaped = structuredClone(await loadSourceEquivalencePolicy(root));
      escaped.themes[0]!.authorizedSourceRoot = symlinkRoot;
      escaped.themes[0]!.pages[0]!.sourceEntry = "escaped.html";
      await expect(validateSourceEquivalencePolicy(escaped, root)).rejects.toThrow(
        /home: authorized source entry is missing or outside its root/,
      );
    } finally {
      await rm(symlinkRoot, { force: true, recursive: true });
    }
  });

  test("rejects focused states without declared acceptance modes", async () => {
    const policy = structuredClone(await loadSourceEquivalencePolicy(root));
    policy.themes[0]!.pages[0]!.focusedStates[0]!.modes = [];
    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /home: focused state without an acceptance mode/,
    );
  });

  test("requires distinct page and theme acceptance commands", async () => {
    const policy = structuredClone(await loadSourceEquivalencePolicy(root));
    policy.themes[0]!.acceptance.pageCommand = ["bun", "page-without-placeholder.ts"];
    policy.themes[0]!.acceptance.themeCommand = [];
    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /page command must contain a \{page\} placeholder|theme command is missing/,
    );
  });

  test("rejects permissive thresholds, excess workers, and unapproved waivers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    const permissive = structuredClone(policy);
    permissive.thresholds.fullPageChangedPixelRatio = 0.02;
    permissive.resources.maxConcurrentBrowserWorkers = 3;
    permissive.waivers.push({
      approvedBy: "",
      expiresAt: "2026-08-07",
      id: "unapproved-waiver",
      owner: "storefront",
      rationale: "Test fixture",
      regionId: "home",
      routeId: "fashion-store-home",
      themeId: "fashion-store",
    });

    await expect(validateSourceEquivalencePolicy(permissive, root)).rejects.toThrow(
      /full-page pixel threshold|concurrent browser workers|approvedBy/,
    );

    const nonsensical = structuredClone(policy);
    nonsensical.thresholds.channelTolerance = -1;
    nonsensical.resources.maxConcurrentBrowserWorkers = 0;
    await expect(validateSourceEquivalencePolicy(nonsensical, root)).rejects.toThrow(
      /channel tolerance|concurrent browser workers/,
    );
  });

  test("rejects missing contract facets and unsafe theme identifiers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    const invalid = structuredClone(policy) as SourceEquivalencePolicy;
    invalid.themes[0]!.id = "Decor Store";
    invalid.themes[0]!.pages[0]!.requiredContractFacets = ["sources", "not-present"];

    await expect(validateSourceEquivalencePolicy(invalid, root)).rejects.toThrow(
      /lowercase theme ID|required contract facet/,
    );
  });

  test("does not accept a contract facet mentioned only in a comment", async () => {
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-source-contract-"));
    const contractPath = resolve(temporaryRoot, "source-contract.ts");
    await writeFile(
      contractPath,
      "export const temporarySourceContract = { sources: {} }; // phantom:\nexport const helper = { phantom: true };\n",
    );
    try {
      const policy = await loadSourceEquivalencePolicy(root);
      policy.themes[0]!.pages[0]!.sourceContractPath = contractPath;
      policy.themes[0]!.pages[0]!.requiredContractFacets = ["sources", "phantom"];

      await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
        /missing required contract facet phantom/,
      );
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  test("does not allow required evidence dimensions to be removed from policy", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    policy.requiredEvidence = policy.requiredEvidence.filter((facet) => facet !== "motionStates");

    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /required evidence dimensions/,
    );
  });

  test("rejects implementation-owned or digest-mismatched reference sources", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    policy.themes[0]!.authorizedSourceRoot = "apps/storefront/app/themes/fashion-store/upstream";
    policy.themes[0]!.pages[0]!.sourceEntrySha256 = "0".repeat(64);

    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /independent of implementation inputs|digest does not match policy/,
    );
  });
});

describe("source-equivalent imported trees", () => {
  test("accepts exact Fashion and Decor files and rejects drift in either tree", async () => {
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-fashion-store-source-"));
    const fixtures = [
      { id: "fashion-store", sourceIdentity: "local://fixture/demo-fashion-store.html" },
      { id: "decor-store", sourceIdentity: "local://fixture/demo-decor-store.html" },
    ] as const;
    const declarations: StorefrontThemeSourceManifest["themes"] = [];
    const manifestPath = resolve(temporaryRoot, "tools/storefront-theme-source-manifest.json");
    await mkdir(resolve(manifestPath, ".."), { recursive: true });
    for (const fixture of fixtures) {
      const contents = `.${fixture.id}{}\n`;
      const digest = new Bun.CryptoHasher("sha256").update(contents).digest("hex");
      const destinationPath = `upstream/demos/${fixture.id}/${fixture.id}.css`;
      const sourcePath = resolve(
        temporaryRoot,
        `apps/storefront/app/themes/${fixture.id}/${destinationPath}`,
      );
      await mkdir(resolve(sourcePath, ".."), { recursive: true });
      await writeFile(sourcePath, contents);
      await writeFile(
        resolve(temporaryRoot, `apps/storefront/app/themes/${fixture.id}/UPSTREAM.md`),
        `# Source\n\n${fixture.sourceIdentity}\n${digest}\njs/main.js is a behavioral reference.\n`,
      );
      declarations.push({
        allowlist: [
          {
            destinationPath,
            expectedSha256: digest,
            kind: "stylesheet",
            license: "Authorized fixture",
            sourcePath: `demos/${fixture.id}/${fixture.id}.css`,
          },
        ],
        importedAt: "2026-08-06",
        importedFiles: [
          {
            bytes: Buffer.byteLength(contents),
            destinationPath,
            expectedSha256: digest,
            kind: "stylesheet",
            license: "Authorized fixture",
            sha256: digest,
            sourcePath: `demos/${fixture.id}/${fixture.id}.css`,
          },
        ],
        ownershipApproval: "Fixture owner approved source reuse.",
        sourceIdentity: fixture.sourceIdentity,
        sourceRevision: "fixture-1",
        themeId: fixture.id,
      });
    }
    await writeFile(
      manifestPath,
      `${JSON.stringify({ schemaVersion: 1, themes: declarations }, null, 2)}\n`,
    );

    try {
      await expect(validateImportedSourceTree(temporaryRoot)).resolves.toBeUndefined();
      await writeFile(
        resolve(
          temporaryRoot,
          "apps/storefront/app/themes/decor-store/upstream/demos/decor-store/decor-store.css",
        ),
        ".drift{}\n",
      );
      await expect(validateImportedSourceTree(temporaryRoot)).rejects.toThrow(/hash|bytes/i);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});

describe("fidelity evidence freshness", () => {
  const artifactDigest = "d".repeat(64);
  const validRecord = {
    artifactDigest,
    captureMode: "static",
    capturedAt: "2026-08-05T00:00:00.000Z",
    commit: "abcdef1",
    density: 1,
    difference: { changedPixelRatio: 0.004, dimensionsMatch: true },
    failures: [],
    implementationUrl: "http://127.0.0.1:3433/",
    region: { id: "header", maxChangedPixelRatio: 0.005 },
    route: "fashion-store-home",
    sourceUrl: "http://127.0.0.1:4321/demo-fashion-store.html",
    viewport: { height: 1000, id: "desktop", width: 1440 },
  };
  const validRegionalRecords = themeFidelityMatrix.flatMap((route) =>
    route.regions.flatMap((region) =>
      route.viewports.flatMap((viewportId) =>
        route.densities.map((density) => ({
          ...validRecord,
          captureMode: captureModeForRegion(region.id),
          density,
          region: { id: region.id, maxChangedPixelRatio: region.maxChangedPixelRatio },
          route: route.id,
          sourceUrl: `http://127.0.0.1:4321${route.sourcePath}`,
          viewport: { id: viewportId, ...fidelityMatrixViewports[viewportId] },
        })),
      ),
    ),
  );
  const namedStateViewports = ["desktop", "laptop", "tablet", "mobile"] as const;
  const namedStateGeometry = {
    implementation: { height: 100, pageX: 0, pageY: 0, width: 100, x: 0, y: 0 },
    reference: { height: 100, pageX: 0, pageY: 0, width: 100, x: 0, y: 0 },
  };
  const validNamedStateRecord = {
    artifactDigest,
    capturedAt: "2026-08-05T00:00:00.000Z",
    commit: "abcdef1",
    failures: [],
    implementationUrl: "http://127.0.0.1:3434/",
    results: fashionStoreNamedStates.flatMap((stateContract) =>
      namedStateViewports.map((viewport) => ({
        captureMode: captureModeForNamedState(stateContract),
        difference: { changedPixelRatio: 0, dimensionsMatch: true },
        geometry: namedStateGeometry,
        state: stateContract.id,
        viewport,
      })),
    ),
    sourceUrl: "http://127.0.0.1:4321/demo-fashion-store.html",
    state: "fashion-store-named-states",
    themeId: "fashion-store",
    viewports: {
      desktop: { height: 1000, width: 1440 },
      laptop: { height: 900, width: 1024 },
      mobile: { height: 844, width: 390 },
      tablet: { height: 1024, width: 768 },
    },
  };

  test("accepts fresh, commit-bound evidence with distinct source and implementation origins", () => {
    expect(() =>
      validateFidelityEvidenceRecords(validRegionalRecords, {
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  test("rejects stale, mismatched, failed, or same-origin evidence", () => {
    expect(() =>
      validateFidelityEvidenceRecords(
        [
          {
            ...validRecord,
            commit: "stale123",
            failures: ["geometry mismatch"],
            implementationUrl: validRecord.sourceUrl,
          },
        ],
        { artifactDigest, commit: "abcdef1", now: new Date("2026-08-08T00:00:00.000Z") },
      ),
    ).toThrow(/commit|stale|failures|distinct origins/);

    expect(() =>
      validateFidelityEvidenceRecords(
        validRegionalRecords.map((record) => ({ ...record, commit: "not-a-sha" })),
        { artifactDigest, commit: "not-a-sha", now: new Date("2026-08-05T12:00:00.000Z") },
      ),
    ).toThrow(/real commit SHA/);
  });

  test("rejects self-reported thresholds and incomplete regional capture sets", () => {
    const tampered = structuredClone(validRegionalRecords);
    tampered[0]!.region.maxChangedPixelRatio = 1;
    tampered.pop();

    expect(() =>
      validateFidelityEvidenceRecords(tampered, {
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/threshold does not match|capture set is incomplete/);

    expect(() =>
      validateFidelityEvidenceRecords(
        validRegionalRecords.map((record) => ({
          ...record,
          sourceUrl: "http://127.0.0.1:4321/wrong-demo.html",
        })),
        { artifactDigest, commit: "abcdef1", now: new Date("2026-08-05T12:00:00.000Z") },
      ),
    ).toThrow(/source URL does not match/);
  });

  test("requires regional evidence alongside a commit-bound named-state aggregate report", () => {
    expect(() =>
      validateFidelityEvidenceRecords([validNamedStateRecord], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/regional capture set is incomplete/);

    expect(() =>
      validateFidelityEvidenceRecords([...validRegionalRecords, validNamedStateRecord], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  test("rejects incomplete named-state viewport coverage", () => {
    expect(() =>
      validateFidelityEvidenceRecords(
        [
          {
            ...validNamedStateRecord,
            results: validNamedStateRecord.results.slice(0, -1),
          },
        ],
        {
          behaviorDescriptors,
          artifactDigest,
          commit: "abcdef1",
          now: new Date("2026-08-05T12:00:00.000Z"),
        },
      ),
    ).toThrow(/named-state matrix is incomplete/);
  });

  test("rejects unknown named states and missing geometry evidence", () => {
    const invalid = structuredClone(validNamedStateRecord);
    invalid.results[0]!.state = "invented-state";
    Reflect.deleteProperty(invalid.results[0]!, "geometry");

    expect(() =>
      validateFidelityEvidenceRecords([invalid], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/absent from the named-state contract|geometry evidence is missing/);
  });

  test("honors an explicit viewport geometry space for reflowing named states", () => {
    const descriptor = behaviorDescriptors.get("fashion-store");
    expect(descriptor).toBeDefined();
    const stateId = descriptor!.namedStates[0]!.id;
    const viewportDescriptors = new Map([
      [
        "fashion-store",
        {
          ...descriptor!,
          namedStates: descriptor!.namedStates.map((state) =>
            state.id === stateId ? { ...state, geometrySpace: "viewport" as const } : state,
          ),
        },
      ],
    ]);
    const reflowed = structuredClone(validNamedStateRecord);
    for (const result of reflowed.results) {
      if (result.state !== stateId) continue;
      result.geometry = {
        implementation: { ...result.geometry.implementation, pageY: 1_000 },
        reference: { ...result.geometry.reference },
      };
    }

    expect(() =>
      validateFidelityEvidenceRecords([...validRegionalRecords, reflowed], {
        behaviorDescriptors: viewportDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  test("rejects evidence captured in the wrong acceptance mode", () => {
    const invalid = structuredClone(validNamedStateRecord);
    const search = invalid.results.find(({ state }) => state === "search-open");
    expect(search).toBeDefined();
    search!.captureMode = "static";

    expect(() =>
      validateFidelityEvidenceRecords([invalid], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/capture mode/);
  });

  test("honors stricter policy thresholds and rejects invalid evidence time windows", () => {
    const record = {
      ...validNamedStateRecord,
      results: validNamedStateRecord.results.map((result) => ({
        ...result,
        difference: { ...result.difference, changedPixelRatio: 0.004 },
      })),
    };

    expect(() =>
      validateFidelityEvidenceRecords([record], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
        thresholds: { geometryEdgePx: 1, namedStateChangedPixelRatio: 0.003 },
      }),
    ).toThrow(/named-state pixel threshold/);
    expect(() =>
      validateFidelityEvidenceRecords([record], {
        behaviorDescriptors,
        artifactDigest,
        commit: "abcdef1",
        maxAgeHours: Number.NaN,
        now: new Date("2026-08-04T12:00:00.000Z"),
      }),
    ).toThrow(/evidence age window|future/);
  });
});
