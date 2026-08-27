import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  RELEASE_ARTIFACT_PATHS,
  RELEASE_GATES,
  assertCatalogReleaseSource,
  assertProductionApproval,
  assertReleaseReportContainsNoPreviewSecrets,
  createValidationAttestation,
  digestArtifact,
  releaseGateEnvironment,
  verifyValidationAttestation,
  type ReleaseReport,
  type ValidationAttestation,
} from "./release-validate";

const temporaryDirectories: string[] = [];

type VerificationOptions = Parameters<typeof verifyValidationAttestation>[0];

interface EvidenceFixture {
  attestation: ValidationAttestation;
  attestationPath: string;
  expected: VerificationOptions;
  report: ReleaseReport;
  reportPath: string;
  root: string;
}

function sha256(contents: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

function completeArtifactDigestMap(digest: string): Record<string, string> {
  return Object.fromEntries(RELEASE_ARTIFACT_PATHS.map((path) => [path, digest]));
}

function deployableMapDigest(artifactDigests: Record<string, string>): string {
  const ordered = Object.fromEntries(
    Object.entries(artifactDigests).sort(([left], [right]) => left.localeCompare(right)),
  );
  return sha256(`${JSON.stringify(ordered)}\n`);
}

async function writeArtifactFixture(root: string): Promise<Record<string, string>> {
  const entries = await Promise.all(
    RELEASE_ARTIFACT_PATHS.map(async (path) => {
      const absolutePath = resolve(root, path);
      if (path.endsWith(".jsonc")) {
        await mkdir(resolve(absolutePath, ".."), { recursive: true });
        await writeFile(absolutePath, `{ "artifact": ${JSON.stringify(path)} }\n`);
      } else {
        await mkdir(absolutePath, { recursive: true });
        await writeFile(resolve(absolutePath, "fixture.txt"), `validated:${path}\n`);
      }
      return [path, await digestArtifact(absolutePath, root)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function persistEvidenceFixture(fixture: EvidenceFixture): Promise<void> {
  const reportContents = `${JSON.stringify(fixture.report, null, 2)}\n`;
  await writeFile(fixture.reportPath, reportContents);
  fixture.expected.reportDigest = sha256(reportContents);
  fixture.attestation.report.digest = fixture.expected.reportDigest;
  const attestationContents = `${JSON.stringify(fixture.attestation, null, 2)}\n`;
  await writeFile(fixture.attestationPath, attestationContents);
  fixture.expected.attestationDigest = sha256(attestationContents);
  fixture.expected.deployableDigest = deployableMapDigest(fixture.attestation.artifactDigests);
}

async function createEvidenceFixture(): Promise<EvidenceFixture> {
  const root = await mkdtemp(resolve(tmpdir(), "shoppp-validation-attestation-"));
  temporaryDirectories.push(root);
  await mkdir(resolve(root, "artifacts/releases"), { recursive: true });
  await mkdir(resolve(root, "artifacts/validation-attestations"), { recursive: true });
  const artifactDigests = await writeArtifactFixture(root);
  const commit = "a".repeat(40);
  const tree = "b".repeat(40);
  const releaseId = "release-2026-08-27";
  const reportPath = resolve(root, `artifacts/releases/${releaseId}.json`);
  const attestationPath = resolve(
    root,
    `artifacts/validation-attestations/${releaseId}-12345-attempt-2.json`,
  );
  const report: ReleaseReport = {
    schemaVersion: 1,
    releaseId,
    target: "staging",
    commit,
    createdAt: "2026-08-27T00:00:00.000Z",
    status: "passed",
    gates: RELEASE_GATES.map((gate) => ({
      ...gate,
      durationMs: 1,
      status: "passed",
      exitCode: 0,
    })),
    artifactDigests,
    environmentIsolation: { mode: "strict", environments: ["staging", "production"] },
  };
  const reportContents = `${JSON.stringify(report, null, 2)}\n`;
  const reportDigest = sha256(reportContents);
  const attestation = createValidationAttestation({
    releaseId,
    source: { commit, tree },
    report: { commit, digest: reportDigest, path: `artifacts/releases/${releaseId}.json` },
    artifactDigests,
    github: {
      repository: "hashencode/shoppp",
      workflowRef: "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main",
      runId: "12345",
      runAttempt: "2",
    },
    toolchain: {
      runnerOs: "Linux",
      runnerArch: "X64",
      runnerImage: "ubuntu24/20260820.1",
      bun: "1.3.5",
      playwright: "1.62.0",
      chromium: "Chromium 140.0.0.0",
      woff2: "1.0.2",
      system: "Linux runner 6.11 x86_64",
    },
  });
  const fixture: EvidenceFixture = {
    root,
    report,
    attestation,
    reportPath,
    attestationPath,
    expected: {
      root,
      reportPath,
      attestationPath,
      sourceCommit: commit,
      sourceTree: tree,
      releaseId,
      runId: "12345",
      runAttempt: "2",
      reportDigest,
      attestationDigest: "",
      deployableDigest: "",
    },
  };
  await persistEvidenceFixture(fixture);
  return fixture;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("release validation", () => {
  test("exposes catalog credentials only to the production build and reuses it for browser gates", async () => {
    const environment = {
      PATH: "/usr/bin",
      NUXT_CATALOG_RELEASE_TOKEN: "catalog-token",
      NUXT_CATALOG_RELEASE_URL: "https://staging.example.test/build/catalog/releases/release-1",
    };

    for (const gate of RELEASE_GATES) {
      if (gate.name === "production-builds") {
        expect(releaseGateEnvironment(gate.name, environment)).toEqual(environment);
      } else if (["browser-journeys", "accessibility", "performance"].includes(gate.name)) {
        expect(releaseGateEnvironment(gate.name, environment)).toEqual({
          PATH: "/usr/bin",
          STOREFRONT_REUSE_VALIDATED_BUILD: "1",
        });
      } else {
        expect(releaseGateEnvironment(gate.name, environment)).toEqual({ PATH: "/usr/bin" });
      }
    }

    const configs = await Promise.all(
      [
        "../apps/storefront/playwright.config.ts",
        "../apps/storefront/playwright.a11y.config.ts",
        "../apps/storefront/playwright.performance.config.ts",
      ].map((path) => readFile(resolve(import.meta.dir, path), "utf8")),
    );
    for (const config of configs) {
      expect(config).toContain("STOREFRONT_REUSE_VALIDATED_BUILD");
    }
  });

  test("aggregates every verification-contract gate", () => {
    expect(RELEASE_GATES.map((gate) => gate.name)).toEqual([
      "reproducible-install",
      "format",
      "lint",
      "types",
      "source-equivalence",
      "theme-contracts",
      "fidelity-contract",
      "unit-contract",
      "worker-integration",
      "admin-browser",
      "representative-catalog",
      "theme-matrix",
      "production-builds",
      "static-output",
      "browser-journeys",
      "accessibility",
      "performance",
    ]);
  });

  test("artifact digest changes when content changes", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-"));
    temporaryDirectories.push(root);
    const artifact = resolve(root, "artifact");
    await mkdir(artifact);
    await writeFile(resolve(artifact, "index.html"), "first");
    const first = await digestArtifact(artifact, root);
    await writeFile(resolve(artifact, "index.html"), "second");
    expect(await digestArtifact(artifact, root)).not.toBe(first);
  });

  test("production cannot promote without human and staging evidence", async () => {
    await expect(assertProductionApproval({ target: "production", commit: "abc" })).rejects.toThrow(
      /RELEASE_APPROVED_BY/,
    );
    await expect(
      assertProductionApproval({
        target: "production",
        commit: "abc",
        approvedBy: "operator",
      }),
    ).rejects.toThrow(/RELEASE_BACKUP_ID/);
    await expect(
      assertProductionApproval({
        target: "production",
        commit: "abc",
        approvedBy: "operator",
        backupId: "backup\ninjected=true",
      }),
    ).rejects.toThrow(/unsafe characters/);
    await expect(
      assertProductionApproval({
        target: "production",
        commit: "abc",
        approvedBy: "operator",
        backupId: "backup-001",
      }),
    ).rejects.toThrow(/RELEASE_HUMAN_ACCESS_EVIDENCE_ID/);
    await expect(
      assertProductionApproval({
        target: "production",
        commit: "abc",
        approvedBy: "operator",
        backupId: "backup-001",
        humanAccessEvidenceId: "proof-001",
      }),
    ).rejects.toThrow(/RELEASE_HUMAN_ACCESS_APPROVED_BY/);
    await expect(
      assertProductionApproval({
        target: "production",
        commit: "abc",
        approvedBy: "operator",
        backupId: "backup-001",
        humanAccessApprovedBy: "reviewer",
        humanAccessEvidenceId: "proof\ninjected=true",
      }),
    ).rejects.toThrow(/human access evidence ID contains unsafe characters/);
  });

  test("strict staging builds fetch the selected immutable catalog release", () => {
    expect(() =>
      assertCatalogReleaseSource({
        catalogReleaseToken: "a".repeat(32),
        catalogReleaseUrl:
          "https://api.staging.example.com/build/catalog/releases/release-2026-07-30",
        releaseId: "release-2026-07-30",
        stagingApiOrigin: "https://api.staging.example.com",
      }),
    ).not.toThrow();
    expect(() =>
      assertCatalogReleaseSource({
        catalogReleaseToken: "a".repeat(32),
        catalogReleaseUrl: "https://api.example.com/build/catalog/releases/release-2026-07-30",
        releaseId: "release-2026-07-30",
        stagingApiOrigin: "https://api.staging.example.com",
      }),
    ).toThrow(/crosses the staging API origin/);
  });

  test("release reports reject preview artifacts and credential material", () => {
    expect(() =>
      assertReleaseReportContainsNoPreviewSecrets({
        artifactDigests: { "apps/storefront/.output/public": "sha256:fixture" },
        gates: [{ command: ["bun", "run", "verify:themes"] }],
      }),
    ).not.toThrow();
    expect(() =>
      assertReleaseReportContainsNoPreviewSecrets({
        artifactDigests: { "apps/storefront/preview-worker-dist": "sha256:fixture" },
      }),
    ).toThrow("preview artifacts");
    expect(() =>
      assertReleaseReportContainsNoPreviewSecrets({
        artifactDigests: {},
        grant: "grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      }),
    ).toThrow("preview credentials");
  });

  test("validation attestation binds the unchanged report and deployable artifacts", () => {
    const commit = "a".repeat(40);
    const tree = "b".repeat(40);
    const reportDigest = `sha256:${"c".repeat(64)}`;
    const artifactDigest = `sha256:${"d".repeat(64)}`;
    const attestation = createValidationAttestation({
      releaseId: "release-2026-08-27",
      source: { commit, tree },
      report: {
        commit,
        digest: reportDigest,
        path: "artifacts/releases/release-2026-08-27.json",
      },
      artifactDigests: completeArtifactDigestMap(artifactDigest),
      github: {
        repository: "hashencode/shoppp",
        workflowRef: "hashencode/shoppp/.github/workflows/full-validation.yml@refs/heads/main",
        runId: "12345",
        runAttempt: "2",
      },
      toolchain: {
        runnerOs: "Linux",
        runnerArch: "X64",
        runnerImage: "ubuntu24/20260820.1",
        bun: "1.3.5",
        playwright: "1.62.0",
        chromium: "Chromium 140.0.0.0",
        woff2: "1.0.2",
        system: "Linux runner 6.11 x86_64",
      },
    });

    expect(attestation).toMatchObject({
      schemaVersion: 1,
      releaseId: "release-2026-08-27",
      source: { commit, tree },
      report: { digest: reportDigest },
      artifactDigests: completeArtifactDigestMap(artifactDigest),
      github: { runId: "12345", runAttempt: 2 },
    });
  });

  test("validation attestation refuses mismatched or failed release proof", () => {
    const base = {
      releaseId: "release-2026-08-27",
      source: { commit: "a".repeat(40), tree: "b".repeat(40) },
      report: {
        commit: "a".repeat(40),
        digest: `sha256:${"c".repeat(64)}`,
        path: "artifacts/releases/release-2026-08-27.json",
      },
      artifactDigests: completeArtifactDigestMap(`sha256:${"d".repeat(64)}`),
      github: {
        repository: "hashencode/shoppp",
        workflowRef: "hashencode/shoppp/.github/workflows/full-validation.yml@refs/heads/main",
        runId: "12345",
        runAttempt: "1",
      },
      toolchain: {
        runnerOs: "Linux",
        runnerArch: "X64",
        runnerImage: "ubuntu24/20260820.1",
        bun: "1.3.5",
        playwright: "1.62.0",
        chromium: "Chromium 140.0.0.0",
        woff2: "1.0.2",
        system: "Linux runner 6.11 x86_64",
      },
    };

    expect(() =>
      createValidationAttestation({
        ...base,
        report: { ...base.report, commit: "e".repeat(40) },
      }),
    ).toThrow("attestation source differs from release report");
    expect(() => createValidationAttestation({ ...base, artifactDigests: {} })).toThrow(
      "missing deployable artifact path",
    );
  });

  test("deployment evidence verification accepts the complete artifact inventory", async () => {
    const fixture = await createEvidenceFixture();
    expect(Object.keys(fixture.report.artifactDigests)).toEqual([...RELEASE_ARTIFACT_PATHS]);
    await expect(verifyValidationAttestation(fixture.expected)).resolves.toBeUndefined();
  });

  const refusalCases: Array<{
    name: string;
    expectedMessage: string | RegExp;
    mutate: (fixture: EvidenceFixture) => Promise<void> | void;
  }> = [
    {
      name: "source commit mismatch",
      expectedMessage: "release report source commit mismatch",
      mutate: (fixture) => {
        fixture.expected.sourceCommit = "e".repeat(40);
      },
    },
    {
      name: "source tree mismatch",
      expectedMessage: "validation attestation source tree mismatch",
      mutate: (fixture) => {
        fixture.expected.sourceTree = "e".repeat(40);
      },
    },
    {
      name: "release ID mismatch",
      expectedMessage: "release report ID mismatch",
      mutate: (fixture) => {
        fixture.expected.releaseId = "release-2026-08-28";
      },
    },
    {
      name: "report target mismatch",
      expectedMessage: "release report did not pass staging",
      mutate: async (fixture) => {
        fixture.report.target = "production";
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "report status mismatch",
      expectedMessage: "release report did not pass staging",
      mutate: async (fixture) => {
        fixture.report.status = "failed";
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "report digest mismatch",
      expectedMessage: "release report digest mismatch",
      mutate: (fixture) => {
        fixture.expected.reportDigest = `sha256:${"e".repeat(64)}`;
      },
    },
    {
      name: "attestation digest mismatch",
      expectedMessage: "attestation digest mismatch",
      mutate: (fixture) => {
        fixture.expected.attestationDigest = `sha256:${"e".repeat(64)}`;
      },
    },
    {
      name: "attestation report linkage mismatch",
      expectedMessage: "attestation report source mismatch",
      mutate: async (fixture) => {
        fixture.attestation.report.commit = "e".repeat(40);
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate count mismatch",
      expectedMessage: "release report gate count mismatch",
      mutate: async (fixture) => {
        fixture.report.gates.pop();
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate order mismatch",
      expectedMessage: "release report gate reproducible-install is invalid",
      mutate: async (fixture) => {
        [fixture.report.gates[0], fixture.report.gates[1]] = [
          fixture.report.gates[1]!,
          fixture.report.gates[0]!,
        ];
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate command mismatch",
      expectedMessage: "release report gate reproducible-install is invalid",
      mutate: async (fixture) => {
        fixture.report.gates[0]!.command = ["bun", "run", "false"];
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate status mismatch",
      expectedMessage: "release report gate reproducible-install is invalid",
      mutate: async (fixture) => {
        fixture.report.gates[0]!.status = "failed";
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate exit mismatch",
      expectedMessage: "release report gate reproducible-install is invalid",
      mutate: async (fixture) => {
        fixture.report.gates[0]!.exitCode = 1;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "run attempt mismatch",
      expectedMessage: "validation attestation run attempt mismatch",
      mutate: (fixture) => {
        fixture.expected.runAttempt = "3";
      },
    },
    {
      name: "deployable map digest mismatch",
      expectedMessage: "deployable artifact map digest mismatch",
      mutate: (fixture) => {
        fixture.expected.deployableDigest = `sha256:${"e".repeat(64)}`;
      },
    },
    {
      name: "unknown artifact path",
      expectedMessage: "contains unknown deployable artifact path: ../escape",
      mutate: async (fixture) => {
        const digest = `sha256:${"e".repeat(64)}`;
        fixture.report.artifactDigests["../escape"] = digest;
        fixture.attestation.artifactDigests["../escape"] = digest;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "missing artifact path",
      expectedMessage: /missing deployable artifact path/,
      mutate: async (fixture) => {
        const path = RELEASE_ARTIFACT_PATHS[0];
        delete fixture.report.artifactDigests[path];
        delete fixture.attestation.artifactDigests[path];
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "evidence path escape",
      expectedMessage: "validation evidence path escapes the checkout",
      mutate: (fixture) => {
        fixture.expected.reportPath = resolve(fixture.root, "../escape.json");
      },
    },
    {
      name: "altered artifact bytes",
      expectedMessage: "deployable artifact digest mismatch",
      mutate: async (fixture) => {
        const path = RELEASE_ARTIFACT_PATHS.find((candidate) => !candidate.endsWith(".jsonc"))!;
        await writeFile(resolve(fixture.root, path, "fixture.txt"), "altered\n");
      },
    },
  ];

  for (const refusal of refusalCases) {
    test(`deployment evidence refuses ${refusal.name}`, async () => {
      const fixture = await createEvidenceFixture();
      await refusal.mutate(fixture);
      await expect(verifyValidationAttestation(fixture.expected)).rejects.toThrow(
        refusal.expectedMessage,
      );
    });
  }

  const malformedEvidenceCases: Array<{
    name: string;
    expectedMessage: string | RegExp;
    mutate: (fixture: EvidenceFixture) => Promise<void>;
  }> = [
    {
      name: "report creation time",
      expectedMessage: "release report creation time is invalid",
      mutate: async (fixture) => {
        delete (fixture.report as unknown as Record<string, unknown>).createdAt;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "report environment isolation",
      expectedMessage: "release report environment isolation is invalid",
      mutate: async (fixture) => {
        delete (fixture.report as unknown as Record<string, unknown>).environmentIsolation;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "gate duration",
      expectedMessage: "release report gate 0 duration is invalid",
      mutate: async (fixture) => {
        delete (fixture.report.gates[0] as unknown as Record<string, unknown>).durationMs;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "attestation creation time",
      expectedMessage: "validation attestation creation time is invalid",
      mutate: async (fixture) => {
        delete (fixture.attestation as unknown as Record<string, unknown>).createdAt;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "GitHub workflow ref",
      expectedMessage: "validation attestation GitHub workflow ref is invalid",
      mutate: async (fixture) => {
        delete (fixture.attestation.github as unknown as Record<string, unknown>).workflowRef;
        await persistEvidenceFixture(fixture);
      },
    },
    {
      name: "toolchain system version",
      expectedMessage: "validation attestation system version is invalid",
      mutate: async (fixture) => {
        delete (fixture.attestation.toolchain as unknown as Record<string, unknown>).system;
        await persistEvidenceFixture(fixture);
      },
    },
  ];

  for (const malformed of malformedEvidenceCases) {
    test(`deployment evidence refuses malformed ${malformed.name}`, async () => {
      const fixture = await createEvidenceFixture();
      await malformed.mutate(fixture);
      await expect(verifyValidationAttestation(fixture.expected)).rejects.toThrow(
        malformed.expectedMessage,
      );
    });
  }
});
