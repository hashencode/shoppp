import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    expect(policy.themes.map(({ id }) => id)).toEqual(["fashion-store"]);
    expect(policy.themes[0]).toMatchObject({
      authorizedSourceRoot: "templates/Crafto - The Multipurpose HTML5 Template/html",
      sourceEntry: "demo-fashion-store.html",
    });
    expect(policy.waivers).toEqual([]);
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
    invalid.themes[0]!.requiredContractFacets = ["sources", "not-present"];

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
      policy.themes[0]!.sourceContractPath = contractPath;
      policy.themes[0]!.requiredContractFacets = ["sources", "phantom"];

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
    policy.themes[0]!.sourceEntrySha256 = "0".repeat(64);

    await expect(validateSourceEquivalencePolicy(policy, root)).rejects.toThrow(
      /independent of implementation inputs|digest does not match policy/,
    );
  });
});

describe("Fashion Store imported source tree", () => {
  test("accepts exact manifest-bound files and rejects later drift", async () => {
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-fashion-store-source-"));
    const contents = ".fashion{}\n";
    const digest = new Bun.CryptoHasher("sha256").update(contents).digest("hex");
    const sourcePath = resolve(
      temporaryRoot,
      "apps/storefront/app/themes/fashion-store/upstream/demos/fashion-store/fashion-store.css",
    );
    const provenancePath = resolve(
      temporaryRoot,
      "apps/storefront/app/themes/fashion-store/UPSTREAM.md",
    );
    const manifestPath = resolve(temporaryRoot, "tools/storefront-theme-source-manifest.json");
    await mkdir(resolve(sourcePath, ".."), { recursive: true });
    await mkdir(resolve(manifestPath, ".."), { recursive: true });
    await writeFile(sourcePath, contents);
    await writeFile(
      provenancePath,
      `# Fashion Store\n\nlocal://fixture/demo-fashion-store.html\n${digest}\njs/main.js is a behavioral reference.\n`,
    );
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          themes: [
            {
              allowlist: [
                {
                  destinationPath: "upstream/demos/fashion-store/fashion-store.css",
                  expectedSha256: digest,
                  kind: "stylesheet",
                  license: "Authorized fixture",
                  sourcePath: "demos/fashion-store/fashion-store.css",
                },
              ],
              importedAt: "2026-08-06",
              importedFiles: [
                {
                  bytes: Buffer.byteLength(contents),
                  destinationPath: "upstream/demos/fashion-store/fashion-store.css",
                  expectedSha256: digest,
                  kind: "stylesheet",
                  license: "Authorized fixture",
                  sha256: digest,
                  sourcePath: "demos/fashion-store/fashion-store.css",
                },
              ],
              ownershipApproval: "Fixture owner approved source reuse.",
              sourceIdentity: "local://fixture/demo-fashion-store.html",
              sourceRevision: "fixture-1",
              themeId: "fashion-store",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    try {
      await expect(validateImportedSourceTree(temporaryRoot)).resolves.toBeUndefined();
      await writeFile(sourcePath, ".drift{}\n");
      await expect(validateImportedSourceTree(temporaryRoot)).rejects.toThrow(/hash|bytes/i);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});

describe("fidelity evidence freshness", () => {
  const validRecord = {
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
        { commit: "abcdef1", now: new Date("2026-08-08T00:00:00.000Z") },
      ),
    ).toThrow(/commit|stale|failures|distinct origins/);

    expect(() =>
      validateFidelityEvidenceRecords(
        validRegionalRecords.map((record) => ({ ...record, commit: "not-a-sha" })),
        { commit: "not-a-sha", now: new Date("2026-08-05T12:00:00.000Z") },
      ),
    ).toThrow(/real commit SHA/);
  });

  test("rejects self-reported thresholds and incomplete regional capture sets", () => {
    const tampered = structuredClone(validRegionalRecords);
    tampered[0]!.region.maxChangedPixelRatio = 1;
    tampered.pop();

    expect(() =>
      validateFidelityEvidenceRecords(tampered, {
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
        { commit: "abcdef1", now: new Date("2026-08-05T12:00:00.000Z") },
      ),
    ).toThrow(/source URL does not match/);
  });

  test("requires regional evidence alongside a commit-bound named-state aggregate report", () => {
    expect(() =>
      validateFidelityEvidenceRecords([validNamedStateRecord], {
        behaviorDescriptors,
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/regional capture set is incomplete/);

    expect(() =>
      validateFidelityEvidenceRecords([...validRegionalRecords, validNamedStateRecord], {
        behaviorDescriptors,
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
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/absent from the named-state contract|geometry evidence is missing/);
  });

  test("rejects evidence captured in the wrong acceptance mode", () => {
    const invalid = structuredClone(validNamedStateRecord);
    const search = invalid.results.find(({ state }) => state === "search-open");
    expect(search).toBeDefined();
    search!.captureMode = "static";

    expect(() =>
      validateFidelityEvidenceRecords([invalid], {
        behaviorDescriptors,
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
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
        thresholds: { geometryEdgePx: 1, namedStateChangedPixelRatio: 0.003 },
      }),
    ).toThrow(/named-state pixel threshold/);
    expect(() =>
      validateFidelityEvidenceRecords([record], {
        behaviorDescriptors,
        commit: "abcdef1",
        maxAgeHours: Number.NaN,
        now: new Date("2026-08-04T12:00:00.000Z"),
      }),
    ).toThrow(/evidence age window|future/);
  });
});
