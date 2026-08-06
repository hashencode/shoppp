import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  decorNamedStates,
  fashion2NamedStates,
} from "../apps/storefront/e2e/support/theme-named-state-contract";
import {
  loadSourceEquivalencePolicy,
  validateImportedSourceTree,
  validateFidelityEvidenceRecords,
  validateSourceEquivalencePolicy,
  type SourceEquivalencePolicy,
} from "./verify-source-equivalent-themes";

const root = resolve(import.meta.dir, "..");

describe("source-equivalent theme policy", () => {
  test("accepts the repository policy and its explicit intentional-difference waivers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    expect(() => validateSourceEquivalencePolicy(policy, root)).not.toThrow();
    expect(policy.themes.map(({ id }) => id)).toEqual(["decor", "fashion", "fashion-2"]);
    expect(policy.waivers.map(({ id }) => id)).toEqual([
      "decor-home-journal-accessible-contrast",
      "decor-home-services-accessible-contrast",
    ]);
  });

  test("rejects permissive thresholds, excess workers, and unapproved waivers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    const permissive = structuredClone(policy);
    permissive.thresholds.fullPageChangedPixelRatio = 0.02;
    permissive.resources.maxConcurrentBrowserWorkers = 3;
    permissive.waivers[0]!.approvedBy = "";

    expect(() => validateSourceEquivalencePolicy(permissive, root)).toThrow(
      /full-page pixel threshold|concurrent browser workers|approvedBy/,
    );

    const nonsensical = structuredClone(policy);
    nonsensical.thresholds.channelTolerance = -1;
    nonsensical.resources.maxConcurrentBrowserWorkers = 0;
    expect(() => validateSourceEquivalencePolicy(nonsensical, root)).toThrow(
      /channel tolerance|concurrent browser workers/,
    );
  });

  test("rejects missing contract facets and unsafe theme identifiers", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    const invalid = structuredClone(policy) as SourceEquivalencePolicy;
    invalid.themes[0]!.id = "Decor Store";
    invalid.themes[0]!.requiredContractFacets = ["sources", "not-present"];

    expect(() => validateSourceEquivalencePolicy(invalid, root)).toThrow(
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

      expect(() => validateSourceEquivalencePolicy(policy, root)).toThrow(
        /missing required contract facet phantom/,
      );
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  test("does not allow required evidence dimensions to be removed from policy", async () => {
    const policy = await loadSourceEquivalencePolicy(root);
    policy.requiredEvidence = policy.requiredEvidence.filter((facet) => facet !== "motionStates");

    expect(() => validateSourceEquivalencePolicy(policy, root)).toThrow(
      /required evidence dimensions/,
    );
  });
});

describe("Fashion 2 imported source tree", () => {
  test("accepts exact manifest-bound files and rejects later drift", async () => {
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-fashion-2-source-"));
    const contents = ".fashion{}\n";
    const digest = new Bun.CryptoHasher("sha256").update(contents).digest("hex");
    const sourcePath = resolve(
      temporaryRoot,
      "apps/storefront/app/themes/fashion-2/upstream/demos/fashion-store/fashion-store.css",
    );
    const provenancePath = resolve(
      temporaryRoot,
      "apps/storefront/app/themes/fashion-2/UPSTREAM.md",
    );
    const manifestPath = resolve(temporaryRoot, "tools/storefront-theme-source-manifest.json");
    await mkdir(resolve(sourcePath, ".."), { recursive: true });
    await mkdir(resolve(manifestPath, ".."), { recursive: true });
    await writeFile(sourcePath, contents);
    await writeFile(
      provenancePath,
      `# Fashion 2\n\nlocal://fixture/demo-fashion-store.html\n${digest}\njs/main.js is a behavioral reference.\n`,
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
              themeId: "fashion-2",
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
    capturedAt: "2026-08-05T00:00:00.000Z",
    commit: "abcdef1",
    density: 1,
    difference: { changedPixelRatio: 0.004, dimensionsMatch: true },
    failures: [],
    implementationUrl: "http://127.0.0.1:3433/",
    region: { id: "header", maxChangedPixelRatio: 0.005 },
    route: "fashion-home",
    sourceUrl: "http://127.0.0.1:4321/demo-fashion-store.html",
    viewport: { height: 1000, id: "desktop", width: 1440 },
  };
  const validRegionalRecords = [
    { height: 1000, id: "desktop", width: 1440 },
    { height: 900, id: "laptop", width: 1024 },
    { height: 1024, id: "tablet", width: 768 },
    { height: 844, id: "mobile", width: 390 },
  ].flatMap((viewport) =>
    ([1, 2] as const).map((density) => ({ ...validRecord, density, viewport })),
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
    results: decorNamedStates.flatMap(({ id: state }) =>
      namedStateViewports.map((viewport) => ({
        difference: { changedPixelRatio: 0, dimensionsMatch: true },
        geometry: namedStateGeometry,
        state,
        viewport,
      })),
    ),
    sourceUrl: "http://127.0.0.1:4321/demo-decor-store.html",
    state: "decor-named-states",
    themeId: "decor",
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

  test("accepts a commit-bound named-state aggregate report", () => {
    expect(() =>
      validateFidelityEvidenceRecords([validNamedStateRecord], {
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  test("accepts Fashion 2 named-state evidence against the Fashion source identity", () => {
    const record = {
      ...validNamedStateRecord,
      implementationUrl: "http://127.0.0.1:3435/",
      results: fashion2NamedStates.flatMap(({ id: state }) =>
        namedStateViewports.map((viewport) => ({
          difference: { changedPixelRatio: 0, dimensionsMatch: true },
          geometry: namedStateGeometry,
          state,
          viewport,
        })),
      ),
      sourceUrl: "http://127.0.0.1:4321/demo-fashion-store.html",
      state: "fashion-2-named-states",
      themeId: "fashion-2",
    };

    expect(() =>
      validateFidelityEvidenceRecords([record], {
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
        { commit: "abcdef1", now: new Date("2026-08-05T12:00:00.000Z") },
      ),
    ).toThrow(/named-state matrix is incomplete/);
  });

  test("rejects unknown named states and missing geometry evidence", () => {
    const invalid = structuredClone(validNamedStateRecord);
    invalid.results[0]!.state = "invented-state";
    Reflect.deleteProperty(invalid.results[0]!, "geometry");

    expect(() =>
      validateFidelityEvidenceRecords([invalid], {
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).toThrow(/absent from the named-state contract|geometry evidence is missing/);
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
        commit: "abcdef1",
        now: new Date("2026-08-05T12:00:00.000Z"),
        thresholds: { geometryEdgePx: 1, namedStateChangedPixelRatio: 0.003 },
      }),
    ).toThrow(/named-state pixel threshold/);
    expect(() =>
      validateFidelityEvidenceRecords([record], {
        commit: "abcdef1",
        maxAgeHours: Number.NaN,
        now: new Date("2026-08-04T12:00:00.000Z"),
      }),
    ).toThrow(/evidence age window|future/);
  });
});
