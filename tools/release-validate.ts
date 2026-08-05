import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
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

interface ReleaseReport {
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
    stagingReport: string;
  };
}

const ROOT = resolve(import.meta.dir, "..");
const REPORT_DIRECTORY = resolve(ROOT, "artifacts/releases");

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

function safeReleaseId(value: string): string {
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value), "release ID contains unsafe characters");
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
  const paths = [
    "apps/storefront/.output/public",
    "apps/storefront/worker-dist",
    "apps/storefront/wrangler.jsonc",
    "apps/admin/dist",
    "apps/admin/worker-dist",
    "apps/admin/wrangler.jsonc",
    "apps/api/dist",
    "apps/api/wrangler.jsonc",
    "packages/db/migrations",
  ];
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [path, await digestArtifact(resolve(ROOT, path))] as const),
    ),
  );
}

export async function assertProductionApproval(options: {
  target: ReleaseTarget;
  commit: string;
  approvedBy?: string;
  backupId?: string;
  stagingReport?: string;
}): Promise<ReleaseReport | undefined> {
  if (options.target !== "production") return undefined;
  const approvedBy = options.approvedBy?.trim();
  const backupId = options.backupId?.trim();
  const stagingReport = options.stagingReport?.trim();
  assert(approvedBy, "production promotion requires RELEASE_APPROVED_BY");
  assert(backupId, "production promotion requires RELEASE_BACKUP_ID");
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(backupId),
    "production backup ID contains unsafe characters",
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

export async function validateRelease(options: {
  target: ReleaseTarget;
  releaseId?: string;
  strictEnvironment?: boolean;
  promotion?: boolean;
}): Promise<{ report: ReleaseReport; reportPath: string }> {
  const commit = await git("rev-parse", "HEAD");
  const strictEnvironment = options.strictEnvironment ?? false;
  const releaseId = safeReleaseId(
    options.releaseId ??
      `${commit.slice(0, 12)}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`,
  );
  const trackedChanges = await git("status", "--porcelain", "--untracked-files=no");
  assert(!trackedChanges, "release validation requires a clean tracked working tree");

  const stagingEvidence = await assertProductionApproval({
    target: options.target,
    commit,
    ...(process.env.RELEASE_APPROVED_BY ? { approvedBy: process.env.RELEASE_APPROVED_BY } : {}),
    ...(process.env.RELEASE_BACKUP_ID ? { backupId: process.env.RELEASE_BACKUP_ID } : {}),
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
            stagingReport: basename(process.env.STAGING_RELEASE_REPORT!),
          },
        }
      : {}),
  };
  const reportPath = await writeReport(report);
  return { report, reportPath };
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      target: { type: "string" },
      "release-id": { type: "string" },
      "strict-environment": { type: "boolean", default: false },
      promotion: { type: "boolean", default: false },
    },
  });
  const releaseId = values["release-id"] ?? process.env.RELEASE_ID;
  const result = await validateRelease({
    target: releaseTarget(values.target ?? process.env.RELEASE_TARGET),
    ...(releaseId ? { releaseId } : {}),
    strictEnvironment:
      values["strict-environment"] || process.env.RELEASE_STRICT_ENVIRONMENT === "true",
    promotion: values.promotion,
  });
  console.log(`\nRelease report: ${relative(ROOT, result.reportPath)}`);
  if (result.report.status !== "passed") process.exitCode = 1;
}
