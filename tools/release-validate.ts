import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { readReleaseSourceIdentity } from "./release-source-identity";
import { verifyEnvironmentIsolation } from "./verify-environment-isolation";

type ReleaseTarget = "staging" | "production";

interface GateDefinition {
  name: string;
  command: string[];
}

interface GateResult extends GateDefinition {
  durationMs: number;
  status: "passed" | "failed";
  exitCode: number;
}

export interface ReleaseReport {
  schemaVersion: 1;
  releaseId: string;
  target: ReleaseTarget;
  commit: string;
  createdAt: string;
  status: "passed" | "failed";
  gates: GateResult[];
  artifactDigests: Record<string, string>;
  environmentIsolation: {
    mode: "structural" | "strict";
    environments: string[];
  };
  approval?: {
    approvedBy: string;
    backupId: string;
    humanAccessApprovedBy: string;
    humanAccessEvidenceId: string;
    stagingReport: string;
  };
}

const ROOT = resolve(import.meta.dir, "..");
const REPORT_DIRECTORY = resolve(ROOT, "artifacts/releases");
const ATTESTATION_DIRECTORY = resolve(ROOT, "artifacts/validation-attestations");
const FULL_SHA = /^[a-f0-9]{40}$/;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;

export const RELEASE_GATES: GateDefinition[] = [
  { name: "reproducible-install", command: ["bun", "install", "--frozen-lockfile"] },
  { name: "format", command: ["bun", "run", "format:check"] },
  { name: "lint", command: ["bun", "run", "lint"] },
  { name: "types", command: ["bun", "run", "typecheck"] },
  { name: "source-equivalence", command: ["bun", "run", "verify:source-equivalence"] },
  { name: "theme-contracts", command: ["bun", "run", "verify:themes"] },
  {
    name: "fidelity-contract",
    command: ["bun", "run", "--cwd", "apps/storefront", "test:fidelity"],
  },
  { name: "unit-contract", command: ["bun", "run", "test"] },
  { name: "worker-integration", command: ["bun", "run", "test:workers"] },
  { name: "admin-browser", command: ["bun", "run", "test:admin-browser"] },
  { name: "representative-catalog", command: ["bun", "run", "test:catalog-scale"] },
  { name: "theme-matrix", command: ["bun", "run", "test:theme-matrix"] },
  { name: "production-builds", command: ["bun", "run", "build"] },
  { name: "static-output", command: ["bun", "run", "verify:static"] },
  { name: "browser-journeys", command: ["bun", "run", "test:e2e"] },
  { name: "accessibility", command: ["bun", "run", "test:a11y"] },
  { name: "performance", command: ["bun", "run", "test:perf"] },
];

export const RELEASE_ARTIFACT_PATHS = [
  "apps/storefront/.output/public",
  "apps/storefront/worker-dist",
  "apps/storefront/wrangler.jsonc",
  "apps/admin/dist",
  "apps/admin/worker-dist",
  "apps/admin/wrangler.jsonc",
  "apps/api/dist",
  "apps/api/wrangler.jsonc",
  "packages/db/migrations",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function releaseTarget(value: string | undefined): ReleaseTarget {
  const target = value ?? "staging";
  assert(
    target === "staging" || target === "production",
    "release target must be staging or production",
  );
  return target;
}

export function safeReleaseId(value: string, label = "release ID"): string {
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value), `${label} contains unsafe characters`);
  return value;
}

async function git(...arguments_: string[]): Promise<string> {
  const process = Bun.spawn(["git", ...arguments_], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(process.stdout).text();
  const error = await new Response(process.stderr).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(error.trim() || `git ${arguments_.join(" ")} failed`);
  return output.trim();
}

async function releaseSourceIdentity(): Promise<{ commit: string; tree: string }> {
  const source = await readReleaseSourceIdentity(ROOT);
  if (source) return source;
  const workspaceChanges = await git("status", "--porcelain", "--untracked-files=all");
  assert(
    !workspaceChanges,
    "release validation requires a clean checkout including untracked files",
  );
  const commit = await git("rev-parse", "HEAD");
  const tree = await git("rev-parse", `${commit}^{tree}`);
  assert(FULL_SHA.test(commit), "release source commit is invalid");
  assert(FULL_SHA.test(tree), "release source tree is invalid");
  const expectedCommit = process.env.RELEASE_EXPECTED_COMMIT?.trim();
  const expectedTree = process.env.RELEASE_EXPECTED_TREE?.trim();
  if (expectedCommit) {
    assert(FULL_SHA.test(expectedCommit), "expected release commit is invalid");
    assert(commit === expectedCommit, "checked-out release commit differs from the trusted source");
  }
  if (expectedTree) {
    assert(FULL_SHA.test(expectedTree), "expected release tree is invalid");
    assert(tree === expectedTree, "checked-out release tree differs from the trusted source");
  }
  return { commit, tree };
}

async function allFiles(path: string): Promise<string[]> {
  const metadata = await stat(path);
  if (metadata.isFile()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => allFiles(resolve(path, entry.name))),
  );
  return nested.flat();
}

export async function digestArtifact(path: string, root = ROOT): Promise<string> {
  const hash = createHash("sha256");
  for (const file of await allFiles(path)) {
    hash.update(relative(root, file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function artifactDigests(): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      RELEASE_ARTIFACT_PATHS.map(
        async (path) => [path, await digestArtifact(resolve(ROOT, path))] as const,
      ),
    ),
  );
}

export async function assertProductionApproval(options: {
  target: ReleaseTarget;
  commit: string;
  approvedBy?: string;
  backupId?: string;
  humanAccessApprovedBy?: string;
  humanAccessEvidenceId?: string;
  stagingReport?: string;
}): Promise<ReleaseReport | undefined> {
  if (options.target !== "production") return undefined;
  const approvedBy = options.approvedBy?.trim();
  const backupId = options.backupId?.trim();
  const humanAccessApprovedBy = options.humanAccessApprovedBy?.trim();
  const humanAccessEvidenceId = options.humanAccessEvidenceId?.trim();
  const stagingReport = options.stagingReport?.trim();
  assert(approvedBy, "production promotion requires RELEASE_APPROVED_BY");
  assert(backupId, "production promotion requires RELEASE_BACKUP_ID");
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(backupId),
    "production backup ID contains unsafe characters",
  );
  assert(humanAccessEvidenceId, "production promotion requires RELEASE_HUMAN_ACCESS_EVIDENCE_ID");
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(humanAccessEvidenceId),
    "human access evidence ID contains unsafe characters",
  );
  assert(humanAccessApprovedBy, "production promotion requires RELEASE_HUMAN_ACCESS_APPROVED_BY");
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(humanAccessApprovedBy),
    "human access approver contains unsafe characters",
  );
  assert(stagingReport, "production promotion requires STAGING_RELEASE_REPORT");
  const reportPath = resolve(ROOT, stagingReport);
  const report = JSON.parse(await readFile(reportPath, "utf8")) as ReleaseReport;
  assert(report.target === "staging", "promotion evidence must be a staging release report");
  assert(report.status === "passed", "staging release report did not pass");
  assert(
    report.commit === options.commit,
    "production commit differs from the staging-validated commit",
  );
  return report;
}

export function assertCatalogReleaseSource(options: {
  catalogReleaseToken?: string;
  catalogReleaseUrl?: string;
  releaseId: string;
  stagingApiOrigin?: string;
}): void {
  const token = options.catalogReleaseToken?.trim();
  const url = options.catalogReleaseUrl?.trim();
  const stagingApiOrigin = options.stagingApiOrigin?.trim();
  assert(token && token.length >= 32, "strict staging validation requires a build manifest token");
  assert(url, "strict staging validation requires NUXT_CATALOG_RELEASE_URL");
  assert(stagingApiOrigin, "staging API PUBLIC_ORIGIN is missing");

  const source = new URL(url);
  const expectedOrigin = new URL(stagingApiOrigin).origin;
  assert(source.origin === expectedOrigin, "catalog release source crosses the staging API origin");
  assert(
    source.pathname === `/build/catalog/releases/${encodeURIComponent(options.releaseId)}`,
    "catalog release source does not match the selected release ID",
  );
  assert(!source.username && !source.password, "catalog release URL must not embed credentials");
}

async function runGate(gate: GateDefinition): Promise<GateResult> {
  const started = performance.now();
  console.log(`\n[release] ${gate.name}: ${gate.command.join(" ")}`);
  const child = Bun.spawn(gate.command, {
    cwd: ROOT,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  return {
    ...gate,
    durationMs: Math.round(performance.now() - started),
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
  };
}

async function writeReport(report: ReleaseReport): Promise<string> {
  assertReleaseReportContainsNoPreviewSecrets(report);
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const path = resolve(REPORT_DIRECTORY, `${safeReleaseId(report.releaseId)}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return path;
}

export function assertReleaseReportContainsNoPreviewSecrets(report: unknown): void {
  const candidate = report as { artifactDigests?: Record<string, string> };
  for (const path of Object.keys(candidate.artifactDigests ?? {})) {
    assert(
      !/(?:^|[/_-])preview(?:[/_.-]|$)/i.test(path),
      "production release reports must not include preview artifacts",
    );
  }
  const serialized = JSON.stringify(report);
  assert(
    !/(?:grant_[A-Za-z0-9_-]{16,}|__preview\/session|authorization["':\s]+bearer)/i.test(
      serialized,
    ),
    "production release reports must not include preview credentials",
  );
}

interface ValidationAttestationOptions {
  releaseId: string;
  source: { commit: string; tree: string };
  report: { commit: string; digest: string; path: string };
  artifactDigests: Record<string, string>;
  github: {
    repository: string;
    workflowRef: string;
    runId: string;
    runAttempt: string;
  };
  toolchain: {
    runnerOs: string;
    runnerArch: string;
    runnerImage: string;
    bun: string;
    playwright: string;
    chromium: string;
    woff2: string;
    system: string;
  };
}

export interface ValidationAttestation {
  schemaVersion: 1;
  releaseId: string;
  createdAt: string;
  source: { commit: string; tree: string };
  report: { commit: string; digest: string; path: string };
  artifactDigests: Record<string, string>;
  github: {
    repository: string;
    workflowRef: string;
    runId: string;
    runAttempt: number;
  };
  toolchain: ValidationAttestationOptions["toolchain"];
}

function safeAttestationValue(value: string, label: string): string {
  const normalized = value.trim();
  assert(normalized.length > 0 && normalized.length <= 512, `${label} is missing or too long`);
  assert(!/[\u0000-\u001f\u007f]/.test(normalized), `${label} contains control characters`);
  return normalized;
}

export function createValidationAttestation(
  options: ValidationAttestationOptions,
): ValidationAttestation {
  const releaseId = safeReleaseId(options.releaseId);
  assert(FULL_SHA.test(options.source.commit), "attestation source commit is invalid");
  assert(FULL_SHA.test(options.source.tree), "attestation source tree is invalid");
  assert(
    options.report.commit === options.source.commit,
    "attestation source differs from release report",
  );
  assert(SHA256_DIGEST.test(options.report.digest), "attestation report digest is invalid");
  assert(
    Object.keys(options.artifactDigests).length > 0,
    "attestation requires deployable artifact digests",
  );
  for (const [path, digest] of Object.entries(options.artifactDigests)) {
    assert(path.length > 0 && SHA256_DIGEST.test(digest), "attestation artifact digest is invalid");
  }
  assert(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.github.repository),
    "GitHub repository is invalid",
  );
  assert(/^[1-9][0-9]*$/.test(options.github.runId), "GitHub run ID is invalid");
  assert(/^[1-9][0-9]*$/.test(options.github.runAttempt), "GitHub run attempt is invalid");
  const toolchain = Object.fromEntries(
    Object.entries(options.toolchain).map(([key, value]) => [
      key,
      safeAttestationValue(value, `toolchain ${key}`),
    ]),
  ) as ValidationAttestationOptions["toolchain"];
  const attestation: ValidationAttestation = {
    schemaVersion: 1,
    releaseId,
    createdAt: new Date().toISOString(),
    source: options.source,
    report: {
      commit: options.report.commit,
      digest: options.report.digest,
      path: safeAttestationValue(options.report.path, "release report path"),
    },
    artifactDigests: options.artifactDigests,
    github: {
      repository: options.github.repository,
      workflowRef: safeAttestationValue(options.github.workflowRef, "GitHub workflow ref"),
      runId: options.github.runId,
      runAttempt: Number(options.github.runAttempt),
    },
    toolchain,
  };
  assertReleaseReportContainsNoPreviewSecrets(attestation);
  assert(
    !/(?:password|private[_ -]?key|authorization["':\s]+bearer|token["':\s]+[A-Za-z0-9_-]{16,})/i.test(
      JSON.stringify(attestation),
    ),
    "validation attestation contains credential material",
  );
  return attestation;
}

function contentsDigest(contents: Uint8Array): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

async function fileDigest(path: string): Promise<string> {
  return contentsDigest(await readFile(path));
}

function artifactMapDigest(artifactDigests: Record<string, string>): string {
  const ordered = Object.fromEntries(
    Object.entries(artifactDigests).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
  return `sha256:${createHash("sha256")
    .update(`${JSON.stringify(ordered)}\n`)
    .digest("hex")}`;
}

export async function verifyValidationAttestation(options: {
  root?: string;
  reportPath: string;
  attestationPath: string;
  sourceCommit: string;
  sourceTree: string;
  releaseId: string;
  runId: string;
  runAttempt: string;
  reportDigest: string;
  attestationDigest: string;
  deployableDigest: string;
}): Promise<void> {
  const root = resolve(options.root ?? ROOT);
  const releaseId = safeReleaseId(options.releaseId);
  assert(FULL_SHA.test(options.sourceCommit), "expected source commit is invalid");
  assert(FULL_SHA.test(options.sourceTree), "expected source tree is invalid");
  assert(/^[1-9][0-9]*$/.test(options.runId), "expected run ID is invalid");
  assert(/^[1-9][0-9]*$/.test(options.runAttempt), "expected run attempt is invalid");
  for (const [label, digest] of [
    ["report", options.reportDigest],
    ["attestation", options.attestationDigest],
    ["deployable", options.deployableDigest],
  ] as const) {
    assert(SHA256_DIGEST.test(digest), `expected ${label} digest is invalid`);
  }
  const reportPath = resolve(options.reportPath);
  const attestationPath = resolve(options.attestationPath);
  assert(
    reportPath.startsWith(`${root}/`) && attestationPath.startsWith(`${root}/`),
    "validation evidence path escapes the checkout",
  );
  const [attestationContents, reportContents] = await Promise.all([
    readFile(attestationPath),
    readFile(reportPath),
  ]);
  assert(
    contentsDigest(attestationContents) === options.attestationDigest,
    "attestation digest mismatch",
  );
  assert(contentsDigest(reportContents) === options.reportDigest, "release report digest mismatch");
  const report = JSON.parse(reportContents.toString("utf8")) as ReleaseReport;
  const attestation = JSON.parse(attestationContents.toString("utf8")) as ValidationAttestation;
  assert(report.schemaVersion === 1, "release report schema is invalid");
  assert(report.releaseId === releaseId, "release report ID mismatch");
  assert(
    report.target === "staging" && report.status === "passed",
    "release report did not pass staging",
  );
  assert(report.commit === options.sourceCommit, "release report source commit mismatch");
  assert(report.gates.length === RELEASE_GATES.length, "release report gate count mismatch");
  for (const [index, gate] of RELEASE_GATES.entries()) {
    const result = report.gates[index];
    assert(
      result?.name === gate.name &&
        JSON.stringify(result.command) === JSON.stringify(gate.command) &&
        result.status === "passed" &&
        result.exitCode === 0,
      `release report gate ${gate.name} is invalid`,
    );
  }
  assert(attestation.schemaVersion === 1, "validation attestation schema is invalid");
  assert(attestation.releaseId === releaseId, "validation attestation release ID mismatch");
  assert(
    attestation.source.commit === options.sourceCommit,
    "validation attestation source commit mismatch",
  );
  assert(
    attestation.source.tree === options.sourceTree,
    "validation attestation source tree mismatch",
  );
  assert(attestation.report.commit === options.sourceCommit, "attestation report source mismatch");
  assert(attestation.report.digest === options.reportDigest, "attestation report digest mismatch");
  assert(
    attestation.report.path === relative(root, reportPath),
    "attestation release report path mismatch",
  );
  assert(attestation.github.runId === options.runId, "validation attestation run ID mismatch");
  assert(
    attestation.github.runAttempt === Number(options.runAttempt),
    "validation attestation run attempt mismatch",
  );
  assert(
    JSON.stringify(attestation.artifactDigests) === JSON.stringify(report.artifactDigests),
    "attestation artifact map differs from release report",
  );
  assert(
    artifactMapDigest(attestation.artifactDigests) === options.deployableDigest,
    "deployable artifact map digest mismatch",
  );
  const artifactEntries = Object.entries(attestation.artifactDigests);
  const artifactPaths = artifactEntries.map(([artifactPath]) => {
    assert(
      RELEASE_ARTIFACT_PATHS.includes(artifactPath as (typeof RELEASE_ARTIFACT_PATHS)[number]),
      "attestation contains an unknown deployable artifact path",
    );
    const absolutePath = resolve(root, artifactPath);
    assert(absolutePath.startsWith(`${root}/`), "deployable artifact path escapes the checkout");
    return absolutePath;
  });
  const artifactResults = await Promise.allSettled(
    artifactPaths.map((absolutePath) => digestArtifact(absolutePath, root)),
  );
  for (const [index, [artifactPath, expectedDigest]] of artifactEntries.entries()) {
    const result = artifactResults[index]!;
    if (result.status === "rejected") throw result.reason;
    assert(result.value === expectedDigest, `deployable artifact digest mismatch: ${artifactPath}`);
  }
  assertReleaseReportContainsNoPreviewSecrets(report);
  assertReleaseReportContainsNoPreviewSecrets(attestation);
}

async function writeValidationAttestation(options: {
  report: ReleaseReport;
  reportPath: string;
  source: { commit: string; tree: string };
}): Promise<string> {
  assert(
    options.report.status === "passed",
    "failed validation cannot produce a passing attestation",
  );
  const environment = process.env;
  const attestation = createValidationAttestation({
    releaseId: options.report.releaseId,
    source: options.source,
    report: {
      commit: options.report.commit,
      digest: await fileDigest(options.reportPath),
      path: relative(ROOT, options.reportPath),
    },
    artifactDigests: options.report.artifactDigests,
    github: {
      repository: environment.GITHUB_REPOSITORY ?? "",
      workflowRef: environment.GITHUB_WORKFLOW_REF ?? "",
      runId: environment.RELEASE_GITHUB_RUN_ID ?? environment.GITHUB_RUN_ID ?? "",
      runAttempt: environment.RELEASE_GITHUB_RUN_ATTEMPT ?? environment.GITHUB_RUN_ATTEMPT ?? "",
    },
    toolchain: {
      runnerOs: environment.RUNNER_OS ?? "",
      runnerArch: environment.RUNNER_ARCH ?? "",
      runnerImage: environment.RELEASE_RUNNER_IMAGE ?? "",
      bun: environment.RELEASE_BUN_VERSION ?? "",
      playwright: environment.RELEASE_PLAYWRIGHT_VERSION ?? "",
      chromium: environment.RELEASE_CHROMIUM_VERSION ?? "",
      woff2: environment.RELEASE_WOFF2_VERSION ?? "",
      system: environment.RELEASE_SYSTEM_VERSION ?? "",
    },
  });
  await mkdir(ATTESTATION_DIRECTORY, { recursive: true });
  const path = resolve(
    ATTESTATION_DIRECTORY,
    `${safeReleaseId(attestation.releaseId)}-${attestation.github.runId}-attempt-${attestation.github.runAttempt}.json`,
  );
  await writeFile(path, `${JSON.stringify(attestation, null, 2)}\n`, { flag: "wx" });
  return path;
}

export async function validateRelease(options: {
  target: ReleaseTarget;
  releaseId?: string;
  strictEnvironment?: boolean;
  promotion?: boolean;
}): Promise<{
  report: ReleaseReport;
  reportPath: string;
  source: { commit: string; tree: string };
}> {
  const source = await releaseSourceIdentity();
  const commit = source.commit;
  const strictEnvironment = options.strictEnvironment ?? false;
  const releaseId = safeReleaseId(
    options.releaseId ??
      `${commit.slice(0, 12)}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
  );
  const stagingEvidence = await assertProductionApproval({
    target: options.target,
    commit,
    ...(process.env.RELEASE_APPROVED_BY ? { approvedBy: process.env.RELEASE_APPROVED_BY } : {}),
    ...(process.env.RELEASE_BACKUP_ID ? { backupId: process.env.RELEASE_BACKUP_ID } : {}),
    ...(process.env.RELEASE_HUMAN_ACCESS_APPROVED_BY
      ? { humanAccessApprovedBy: process.env.RELEASE_HUMAN_ACCESS_APPROVED_BY }
      : {}),
    ...(process.env.RELEASE_HUMAN_ACCESS_EVIDENCE_ID
      ? { humanAccessEvidenceId: process.env.RELEASE_HUMAN_ACCESS_EVIDENCE_ID }
      : {}),
    ...(process.env.STAGING_RELEASE_REPORT
      ? { stagingReport: process.env.STAGING_RELEASE_REPORT }
      : {}),
  });

  const snapshots = await verifyEnvironmentIsolation({
    ...(strictEnvironment ? { strictEnvironment: options.target } : {}),
  });
  if (strictEnvironment && !options.promotion) {
    const staging = snapshots.find((snapshot) => snapshot.environment === "staging");
    assertCatalogReleaseSource({
      releaseId,
      ...(staging?.apiVariables.PUBLIC_ORIGIN
        ? { stagingApiOrigin: staging.apiVariables.PUBLIC_ORIGIN }
        : {}),
      ...(process.env.NUXT_CATALOG_RELEASE_URL
        ? { catalogReleaseUrl: process.env.NUXT_CATALOG_RELEASE_URL }
        : {}),
      ...(process.env.NUXT_CATALOG_RELEASE_TOKEN
        ? { catalogReleaseToken: process.env.NUXT_CATALOG_RELEASE_TOKEN }
        : {}),
    });
  }
  if (options.promotion) {
    assert(options.target === "production", "promotion mode is only valid for production");
    assert(stagingEvidence, "promotion mode requires a passing staging report");
  }
  const gates: GateResult[] = options.promotion ? [...stagingEvidence!.gates] : [];
  if (!options.promotion) {
    for (const gate of RELEASE_GATES) {
      const result = await runGate(gate);
      gates.push(result);
      if (result.status === "failed") break;
    }
  }

  const passed =
    gates.length === RELEASE_GATES.length && gates.every((gate) => gate.status === "passed");
  const digests = passed ? await artifactDigests() : {};
  if (passed && stagingEvidence) {
    assert(
      JSON.stringify(digests) === JSON.stringify(stagingEvidence.artifactDigests),
      "production artifacts differ from the staging-validated artifact digests",
    );
  }
  const report: ReleaseReport = {
    schemaVersion: 1,
    releaseId,
    target: options.target,
    commit,
    createdAt: new Date().toISOString(),
    status: passed ? "passed" : "failed",
    gates,
    artifactDigests: digests,
    environmentIsolation: {
      mode: strictEnvironment ? "strict" : "structural",
      environments: snapshots.map((snapshot) => snapshot.environment),
    },
    ...(stagingEvidence
      ? {
          approval: {
            approvedBy: process.env.RELEASE_APPROVED_BY!,
            backupId: process.env.RELEASE_BACKUP_ID!,
            humanAccessApprovedBy: process.env.RELEASE_HUMAN_ACCESS_APPROVED_BY!,
            humanAccessEvidenceId: process.env.RELEASE_HUMAN_ACCESS_EVIDENCE_ID!,
            stagingReport: basename(process.env.STAGING_RELEASE_REPORT!),
          },
        }
      : {}),
  };
  const reportPath = await writeReport(report);
  return { report, reportPath, source };
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      env: { type: "string" },
      target: { type: "string" },
      "release-id": { type: "string" },
      "strict-environment": { type: "boolean", default: false },
      promotion: { type: "boolean", default: false },
      "write-attestation": { type: "boolean", default: false },
      "verify-attestation": { type: "boolean", default: false },
    },
  });
  if (values["verify-attestation"]) {
    const releaseId = safeReleaseId(process.env.RELEASE_ID ?? "");
    const runId = process.env.RELEASE_GITHUB_RUN_ID ?? process.env.GITHUB_RUN_ID ?? "";
    const runAttempt =
      process.env.RELEASE_GITHUB_RUN_ATTEMPT ?? process.env.GITHUB_RUN_ATTEMPT ?? "";
    await verifyValidationAttestation({
      reportPath: resolve(REPORT_DIRECTORY, `${releaseId}.json`),
      attestationPath: resolve(
        ATTESTATION_DIRECTORY,
        `${releaseId}-${runId}-attempt-${runAttempt}.json`,
      ),
      sourceCommit: process.env.RELEASE_EXPECTED_COMMIT ?? "",
      sourceTree: process.env.RELEASE_EXPECTED_TREE ?? "",
      releaseId,
      runId,
      runAttempt,
      reportDigest: process.env.EXPECTED_REPORT_DIGEST ?? "",
      attestationDigest: process.env.EXPECTED_ATTESTATION_DIGEST ?? "",
      deployableDigest: process.env.EXPECTED_DEPLOYABLE_DIGEST ?? "",
    });
    console.log("Validation attestation and deployable artifacts verified");
    process.exit(0);
  }
  const releaseId = values["release-id"] ?? process.env.RELEASE_ID;
  const result = await validateRelease({
    target: releaseTarget(values.env ?? values.target ?? process.env.RELEASE_TARGET),
    ...(releaseId ? { releaseId } : {}),
    strictEnvironment:
      values["strict-environment"] || process.env.RELEASE_STRICT_ENVIRONMENT === "true",
    promotion: values.promotion,
  });
  console.log(`\nRelease report: ${relative(ROOT, result.reportPath)}`);
  if (values["write-attestation"] && result.report.status === "passed") {
    const attestationPath = await writeValidationAttestation(result);
    console.log(`Validation attestation: ${relative(ROOT, attestationPath)}`);
  }
  if (result.report.status !== "passed") process.exitCode = 1;
}
