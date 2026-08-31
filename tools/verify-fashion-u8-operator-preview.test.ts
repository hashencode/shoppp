import { describe, expect, test } from "bun:test";

import { verifyFashionU8OperatorPreview } from "./verify-fashion-u8-operator-preview";

const candidateSha = "a".repeat(40);
const harnessSha = "b".repeat(40);
const operatorRunId = "fashion-u8-123";
const preparationRunId = "123";
const sourceDraftId = "draft-source";
const workingDraftId = "draft-successor";
const snapshotId = "snapshot-preview-u8";
const buildId = "preview-build-u8-1";

function evidence() {
  const prepared = {
    data: {
      candidateSha,
      catalogReleaseId: "fashion-staging-release",
      contractTestDigest: "c".repeat(64),
      harnessManifestDigest: "d".repeat(64),
      harnessSha,
      runId: operatorRunId,
      runManifestDigest: "e".repeat(64),
      sourceDraftId,
      u12ReadinessDigest: "f".repeat(64),
      workflowRunId: preparationRunId,
    },
  };
  const manifest = {
    catalogReleaseId: prepared.data.catalogReleaseId,
    contractTestDigest: prepared.data.contractTestDigest,
    harnessManifestDigest: prepared.data.harnessManifestDigest,
    u12ReadinessDigest: prepared.data.u12ReadinessDigest,
  };
  const operator = {
    data: {
      ...prepared.data,
      status: "awaiting_operator",
      workingDraftId,
    },
  };
  const snapshot = {
    data: {
      id: snapshotId,
      kind: "preview",
      snapshot: { version: 1 },
      sourceDraftId: workingDraftId,
      sourceDraftVersion: 1,
    },
  };
  const build = {
    data: {
      id: buildId,
      inputIdentity: {
        catalogReleaseId: prepared.data.catalogReleaseId,
        experienceSnapshotId: snapshotId,
      },
      snapshotId,
      status: "building",
    },
  };
  return { build, manifest, operator, prepared, snapshot };
}

describe("Fashion U8 run-bound operator Preview verifier", () => {
  test("accepts one exact prepared run, successor Snapshot, and building build", () => {
    const input = evidence();
    expect(
      verifyFashionU8OperatorPreview(input, {
        buildId,
        candidateSha,
        harnessSha,
        operatorRunId,
        preparationRunId,
        runManifestDigest: input.prepared.data.runManifestDigest,
        snapshotId,
      }),
    ).toEqual({ passed: true, workingDraftId });
  });

  test("reports the exact mismatched field without dumping bearer-capable responses", () => {
    const input = evidence();
    input.snapshot.data.sourceDraftId = "draft-wrong";
    expect(() =>
      verifyFashionU8OperatorPreview(input, {
        buildId,
        candidateSha,
        harnessSha,
        operatorRunId,
        preparationRunId,
        runManifestDigest: input.prepared.data.runManifestDigest,
        snapshotId,
      }),
    ).toThrow("snapshot.sourceDraftId must match operator.workingDraftId");
  });
});
