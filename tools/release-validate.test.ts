import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  RELEASE_GATES,
  assertCatalogReleaseSource,
  assertProductionApproval,
  assertReleaseReportContainsNoPreviewSecrets,
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
});
