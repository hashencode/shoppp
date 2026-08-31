import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

type JsonObject = Record<string, unknown>;

export interface FashionU8OperatorPreviewEvidence {
  build: JsonObject;
  manifest: JsonObject;
  operator: JsonObject;
  prepared: JsonObject;
  snapshot: JsonObject;
}

export interface FashionU8OperatorPreviewExpectation {
  buildId: string;
  candidateSha: string;
  harnessSha: string;
  operatorRunId: string;
  preparationRunId: string;
  runManifestDigest: string;
  snapshotId: string;
}

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as JsonObject;
}

function field(value: JsonObject, name: string, owner: string): unknown {
  if (!(name in value)) throw new Error(`${owner}.${name} is missing`);
  return value[name];
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label} mismatch`);
}

export function verifyFashionU8OperatorPreview(
  evidence: FashionU8OperatorPreviewEvidence,
  expected: FashionU8OperatorPreviewExpectation,
): { passed: true; workingDraftId: string } {
  const operator = object(
    field(object(evidence.operator, "operator"), "data", "operator"),
    "operator.data",
  );
  const prepared = object(
    field(object(evidence.prepared, "prepared"), "data", "prepared"),
    "prepared.data",
  );
  const manifest = object(evidence.manifest, "manifest");
  const snapshot = object(
    field(object(evidence.snapshot, "snapshot"), "data", "snapshot"),
    "snapshot.data",
  );
  const build = object(field(object(evidence.build, "build"), "data", "build"), "build.data");

  const exactOperatorFields: [string, unknown][] = [
    ["status", "awaiting_operator"],
    ["runId", expected.operatorRunId],
    ["candidateSha", expected.candidateSha],
    ["harnessSha", expected.harnessSha],
    ["workflowRunId", expected.preparationRunId],
  ];
  for (const [name, value] of exactOperatorFields) {
    equal(field(operator, name, "operator.data"), value, `operator.${name}`);
  }
  equal(
    field(operator, "runManifestDigest", "operator.data"),
    expected.runManifestDigest,
    "operator.runManifestDigest/run-manifest SHA-256",
  );
  for (const name of [
    "harnessManifestDigest",
    "contractTestDigest",
    "u12ReadinessDigest",
    "catalogReleaseId",
  ]) {
    equal(
      field(operator, name, "operator.data"),
      field(manifest, name, "manifest"),
      `operator.${name}/manifest.${name}`,
    );
  }
  for (const name of [
    "runId",
    "candidateSha",
    "harnessSha",
    "workflowRunId",
    "runManifestDigest",
    "harnessManifestDigest",
    "contractTestDigest",
    "u12ReadinessDigest",
    "catalogReleaseId",
    "sourceDraftId",
  ]) {
    equal(
      field(operator, name, "operator.data"),
      field(prepared, name, "prepared.data"),
      `operator.${name}/prepared.${name}`,
    );
  }

  const workingDraftId = field(operator, "workingDraftId", "operator.data");
  if (typeof workingDraftId !== "string" || workingDraftId.length === 0) {
    throw new Error("operator.workingDraftId must be a non-empty string");
  }
  equal(field(snapshot, "id", "snapshot.data"), expected.snapshotId, "snapshot.id");
  equal(field(snapshot, "kind", "snapshot.data"), "preview", "snapshot.kind");
  if (field(snapshot, "sourceDraftId", "snapshot.data") !== workingDraftId) {
    throw new Error("snapshot.sourceDraftId must match operator.workingDraftId");
  }
  const immutableSnapshot = object(
    field(snapshot, "snapshot", "snapshot.data"),
    "snapshot.data.snapshot",
  );
  equal(
    field(snapshot, "sourceDraftVersion", "snapshot.data"),
    field(immutableSnapshot, "version", "snapshot.data.snapshot"),
    "snapshot.sourceDraftVersion/snapshot.version",
  );

  equal(field(build, "id", "build.data"), expected.buildId, "build.id");
  equal(field(build, "snapshotId", "build.data"), expected.snapshotId, "build.snapshotId");
  equal(field(build, "status", "build.data"), "building", "build.status");
  const inputIdentity = object(
    field(build, "inputIdentity", "build.data"),
    "build.data.inputIdentity",
  );
  equal(
    field(inputIdentity, "experienceSnapshotId", "build.inputIdentity"),
    expected.snapshotId,
    "build.inputIdentity.experienceSnapshotId",
  );
  equal(
    field(inputIdentity, "catalogReleaseId", "build.inputIdentity"),
    field(operator, "catalogReleaseId", "operator.data"),
    "build.inputIdentity.catalogReleaseId/operator.catalogReleaseId",
  );
  return { passed: true, workingDraftId };
}

if (import.meta.main) {
  const [operatorPath, preparedPath, manifestPath, snapshotPath, buildPath] = process.argv.slice(2);
  if (!operatorPath || !preparedPath || !manifestPath || !snapshotPath || !buildPath) {
    throw new Error(
      "Use: bun tools/verify-fashion-u8-operator-preview.ts <operator> <prepared> <manifest> <snapshot> <build>",
    );
  }
  const paths = [operatorPath, preparedPath, manifestPath, snapshotPath, buildPath] as const;
  const contents = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const [operator, prepared, manifest, snapshot, build] = contents.map(
    (content) => JSON.parse(content) as JsonObject,
  ) as [JsonObject, JsonObject, JsonObject, JsonObject, JsonObject];
  const verified = verifyFashionU8OperatorPreview(
    { build, manifest, operator, prepared, snapshot },
    {
      buildId: process.env.BUILD_ID?.trim() ?? "",
      candidateSha: process.env.CANDIDATE_SHA?.trim() ?? "",
      harnessSha: process.env.HARNESS_SHA?.trim() ?? "",
      operatorRunId: process.env.OPERATOR_RUN_ID?.trim() ?? "",
      preparationRunId: process.env.PREPARATION_RUN_ID?.trim() ?? "",
      runManifestDigest: createHash("sha256").update(contents[2]!).digest("hex"),
      snapshotId: process.env.SNAPSHOT_ID?.trim() ?? "",
    },
  );
  console.log(JSON.stringify(verified));
}
