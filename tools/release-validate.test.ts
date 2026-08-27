import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  RELEASE_GATES,
  assertCatalogReleaseSource,
  assertProductionApproval,
  assertReleaseReportContainsNoPreviewSecrets,
  createValidationAttestation,
  digestArtifact,
} from "./release-validate";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("release validation", () => {
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
      artifactDigests: { "apps/storefront/.output/public": artifactDigest },
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
      artifactDigests: { "apps/storefront/.output/public": artifactDigest },
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
      artifactDigests: { "apps/storefront/.output/public": `sha256:${"d".repeat(64)}` },
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
      "attestation requires deployable artifact digests",
    );
  });
});
