import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type CiTier = "fast" | "post-commit";
export type FailureClassification = "test" | "infrastructure";

export interface GateDefinition {
  readonly name: string;
  readonly command: readonly string[];
  readonly nonzeroFailureClassification: FailureClassification;
  readonly transientPaths?: readonly string[];
}

export interface GitIdentity {
  testedSha: string;
  testedTree: string;
}

export interface GithubAdapterMetadata {
  provider: "github";
  sha?: string;
  runId?: string;
  runAttempt?: string;
  eventName?: string;
  workflow?: string;
  workflowSha?: string;
  repository?: string;
  ref?: string;
  serverUrl?: string;
}

export interface CiIdentity extends GitIdentity {
  executionId: string;
  attempt: string;
  trigger: string;
  executorClass: string;
  adapter?: GithubAdapterMetadata;
}

export interface GateResult {
  name: string;
  command: readonly string[];
  durationMs: number;
  status: "passed" | "failed";
  exitCode: number;
  failureClassification: FailureClassification | null;
  error?: string;
}

export interface CiReport extends CiIdentity {
  schemaVersion: 1;
  evidenceClass: "repository-validation";
  authority: "developer-feedback" | "integration" | "advisory-projection";
  tier: CiTier;
  observedGit: GitIdentity;
  workspace: {
    requiredClean: boolean;
    clean: boolean;
    changes: string[];
  };
  createdAt: string;
  toolVersions: Record<string, string>;
  result: "passed" | "failed";
  failureClassification: FailureClassification | null;
  failedGate?: string;
  error?: string;
  processExitCode: number;
  durationMs: number;
  gates: GateResult[];
}

const ROOT = resolve(import.meta.dir, "..");
const DEFAULT_REPORT_DIRECTORY = resolve(ROOT, "artifacts/ci");

const FAST_GATES: readonly GateDefinition[] = [
  {
    name: "reproducible-install",
    command: ["bun", "install", "--frozen-lockfile"],
    nonzeroFailureClassification: "infrastructure",
  },
  {
    name: "format",
    command: ["bun", "run", "format:check"],
    nonzeroFailureClassification: "test",
  },
  {
    name: "lint-boundaries",
    command: ["bun", "run", "lint"],
    nonzeroFailureClassification: "test",
  },
  {
    name: "types",
    command: ["bun", "run", "typecheck"],
    nonzeroFailureClassification: "test",
  },
  {
    name: "unit-contracts",
    command: ["bun", "run", "test"],
    nonzeroFailureClassification: "test",
  },
];

export const CI_TIERS: Readonly<Record<CiTier, readonly GateDefinition[]>> = {
  fast: FAST_GATES,
  "post-commit": [
    ...FAST_GATES,
    {
      name: "worker-integration",
      command: ["bun", "run", "test:workers"],
      nonzeroFailureClassification: "test",
    },
    {
      name: "production-builds",
      command: ["bun", "run", "build"],
      nonzeroFailureClassification: "test",
      transientPaths: [
        "apps/storefront/app/generated/active-experience.ts",
        "apps/storefront/app/generated/active-theme.ts",
      ],
    },
  ],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value(environment: Record<string, string | undefined>, name: string): string | undefined {
  return environment[name]?.trim() || undefined;
}

function safeReportComponent(component: string, label: string): string {
  assert(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(component),
    `${label} contains unsafe characters`,
  );
  return component;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyGateFailure(gate: GateDefinition, exitCode: number): FailureClassification {
  return exitCode === 126 || exitCode === 127 || exitCode >= 128
    ? "infrastructure"
    : gate.nonzeroFailureClassification;
}

async function runGateWithTransientRestore(
  gate: GateDefinition,
  run: (gate: GateDefinition) => Promise<number>,
): Promise<number> {
  const snapshots = await Promise.all(
    (gate.transientPaths ?? []).map(async (path) => ({
      path: resolve(ROOT, path),
      contents: await readFile(resolve(ROOT, path)),
    })),
  );
  try {
    return await run(gate);
  } finally {
    await Promise.all(snapshots.map(({ path, contents }) => writeFile(path, contents)));
  }
}

async function git(...arguments_: string[]): Promise<string> {
  const child = Bun.spawn(["git", ...arguments_], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, error, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(error.trim() || `git ${arguments_.join(" ")} failed`);
  }
  return output.trim();
}

async function observeGitIdentity(): Promise<GitIdentity> {
  const identities = (await git("rev-parse", "HEAD", "HEAD^{tree}")).split("\n");
  assert(identities.length === 2, "git rev-parse returned an unexpected identity count");
  const testedSha = identities[0]!;
  const testedTree = identities[1]!;
  return { testedSha, testedTree };
}

async function observeWorkspaceChanges(): Promise<string[]> {
  const status = await git("status", "--porcelain=v1", "--untracked-files=all");
  return status ? status.split("\n") : [];
}

function githubAdapter(
  environment: Record<string, string | undefined>,
): GithubAdapterMetadata | undefined {
  const fields = {
    sha: value(environment, "GITHUB_SHA"),
    runId: value(environment, "GITHUB_RUN_ID"),
    runAttempt: value(environment, "GITHUB_RUN_ATTEMPT"),
    eventName: value(environment, "GITHUB_EVENT_NAME"),
    workflow: value(environment, "GITHUB_WORKFLOW"),
    workflowSha: value(environment, "GITHUB_WORKFLOW_SHA"),
    repository: value(environment, "GITHUB_REPOSITORY"),
    ref: value(environment, "GITHUB_REF"),
    serverUrl: value(environment, "GITHUB_SERVER_URL"),
  };
  if (!Object.values(fields).some(Boolean)) return undefined;

  return {
    provider: "github",
    ...(fields.sha ? { sha: fields.sha } : {}),
    ...(fields.runId ? { runId: fields.runId } : {}),
    ...(fields.runAttempt ? { runAttempt: fields.runAttempt } : {}),
    ...(fields.eventName ? { eventName: fields.eventName } : {}),
    ...(fields.workflow ? { workflow: fields.workflow } : {}),
    ...(fields.workflowSha ? { workflowSha: fields.workflowSha } : {}),
    ...(fields.repository ? { repository: fields.repository } : {}),
    ...(fields.ref ? { ref: fields.ref } : {}),
    ...(fields.serverUrl ? { serverUrl: fields.serverUrl } : {}),
  };
}

export function resolveCiIdentity(options: {
  environment?: Record<string, string | undefined>;
  observedGit: GitIdentity;
  executionId?: () => string;
}): CiIdentity {
  const environment = options.environment ?? process.env;
  const adapter = githubAdapter(environment);
  return {
    testedSha: value(environment, "SHOPPP_CI_TESTED_SHA") ?? options.observedGit.testedSha,
    testedTree: value(environment, "SHOPPP_CI_TESTED_TREE") ?? options.observedGit.testedTree,
    executionId:
      value(environment, "SHOPPP_CI_EXECUTION_ID") ??
      options.executionId?.() ??
      `local-${process.pid}-${Date.now()}-${randomUUID()}`,
    attempt: value(environment, "SHOPPP_CI_ATTEMPT") ?? "1",
    trigger: value(environment, "SHOPPP_CI_TRIGGER") ?? "local",
    executorClass:
      value(environment, "SHOPPP_CI_EXECUTOR_CLASS") ?? `local-${process.platform}-${process.arch}`,
    ...(adapter ? { adapter } : {}),
  };
}

async function executeGate(gate: GateDefinition): Promise<number> {
  console.log(`\n[ci] ${gate.name}: ${gate.command.join(" ")}`);
  const child = Bun.spawn([...gate.command], {
    cwd: ROOT,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return child.exited;
}

async function writeReportAtomically(report: CiReport, reportDirectory: string): Promise<string> {
  await mkdir(reportDirectory, { recursive: true });
  const fileName = [
    safeReportComponent(report.testedSha, "tested SHA"),
    safeReportComponent(report.testedTree, "tested tree"),
    safeReportComponent(report.executionId, "execution ID"),
    "attempt",
    safeReportComponent(report.attempt, "attempt"),
    report.tier,
  ].join("-");
  const reportPath = resolve(reportDirectory, `${fileName}.json`);
  const temporaryPath = resolve(reportDirectory, `.${fileName}.tmp-${randomUUID()}`);

  try {
    await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    try {
      await link(temporaryPath, reportPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`CI report already exists: ${reportPath}`, { cause: error });
      }
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return reportPath;
}

export async function validateCi(options: {
  tier: CiTier;
  reportDirectory?: string;
  identity?: CiIdentity;
  workspaceChanges?: string[];
  observeGitIdentity?: () => Promise<GitIdentity>;
  observeWorkspaceChanges?: () => Promise<string[]>;
  executeGate?: (gate: GateDefinition) => Promise<number>;
  nowMs?: () => number;
  createdAt?: () => string;
  toolVersions?: Record<string, string>;
}): Promise<{ report: CiReport; reportPath: string; exitCode: number }> {
  const observeGit = options.observeGitIdentity ?? observeGitIdentity;
  const observeChanges =
    options.observeWorkspaceChanges ??
    (options.workspaceChanges === undefined
      ? observeWorkspaceChanges
      : async () => options.workspaceChanges!);
  let [observedGit, workspaceChanges] = await Promise.all([observeGit(), observeChanges()]);
  const identity = options.identity ?? resolveCiIdentity({ observedGit });
  let workspace = {
    requiredClean: options.tier === "post-commit",
    clean: workspaceChanges.length === 0,
    changes: workspaceChanges,
  };
  const run = options.executeGate ?? executeGate;
  const nowMs = options.nowMs ?? (() => performance.now());
  const started = nowMs();
  const gates: GateResult[] = [];
  const identityErrors: string[] = [];
  let failureClassification: FailureClassification | null = null;
  let failedGate: string | undefined;
  let processExitCode = 0;
  let error: string | undefined;

  if (identity.testedSha !== observedGit.testedSha) {
    identityErrors.push(
      `tested SHA ${identity.testedSha} does not match checkout HEAD ${observedGit.testedSha}`,
    );
  }
  if (identity.testedTree !== observedGit.testedTree) {
    identityErrors.push(
      `tested tree ${identity.testedTree} does not match checkout tree ${observedGit.testedTree}`,
    );
  }
  if (workspace.requiredClean && !workspace.clean) {
    identityErrors.push(
      `post-commit validation requires a clean worktree; observed ${workspace.changes.length} change(s)`,
    );
  }
  if (identityErrors.length > 0) {
    failureClassification = "infrastructure";
    processExitCode = 1;
    error = identityErrors.join("; ");
  }

  if (!failureClassification) {
    for (const gate of CI_TIERS[options.tier]) {
      const gateStarted = nowMs();
      try {
        const exitCode = await runGateWithTransientRestore(gate, run);
        const failed = exitCode !== 0;
        const gateFailureClassification = failed ? classifyGateFailure(gate, exitCode) : null;

        if (!failed && options.tier === "post-commit") {
          [observedGit, workspaceChanges] = await Promise.all([observeGit(), observeChanges()]);
          workspace = {
            requiredClean: true,
            clean: workspaceChanges.length === 0,
            changes: workspaceChanges,
          };
          const driftErrors: string[] = [];
          if (identity.testedSha !== observedGit.testedSha) {
            driftErrors.push(
              `tested SHA ${identity.testedSha} no longer matches checkout HEAD ${observedGit.testedSha}`,
            );
          }
          if (identity.testedTree !== observedGit.testedTree) {
            driftErrors.push(
              `tested tree ${identity.testedTree} no longer matches checkout tree ${observedGit.testedTree}`,
            );
          }
          if (!workspace.clean) {
            driftErrors.push(
              `post-commit gate ${gate.name} changed the worktree; observed ${workspace.changes.length} change(s)`,
            );
          }
          if (driftErrors.length > 0) {
            const driftError = driftErrors.join("; ");
            gates.push({
              name: gate.name,
              command: gate.command,
              durationMs: Math.max(0, Math.round(nowMs() - gateStarted)),
              status: "failed",
              exitCode: 1,
              failureClassification: "infrastructure",
              error: driftError,
            });
            failureClassification = "infrastructure";
            failedGate = gate.name;
            processExitCode = 1;
            error = driftError;
            break;
          }
        }

        gates.push({
          name: gate.name,
          command: gate.command,
          durationMs: Math.max(0, Math.round(nowMs() - gateStarted)),
          status: failed ? "failed" : "passed",
          exitCode,
          failureClassification: gateFailureClassification,
        });
        if (failed) {
          failureClassification = gateFailureClassification;
          failedGate = gate.name;
          processExitCode = exitCode;
          break;
        }
      } catch (gateError) {
        gates.push({
          name: gate.name,
          command: gate.command,
          durationMs: Math.max(0, Math.round(nowMs() - gateStarted)),
          status: "failed",
          exitCode: 1,
          failureClassification: "infrastructure",
          error: errorMessage(gateError),
        });
        failureClassification = "infrastructure";
        failedGate = gate.name;
        processExitCode = 1;
        break;
      }
    }
  }

  const report: CiReport = {
    schemaVersion: 1,
    evidenceClass: "repository-validation",
    authority:
      options.tier === "fast"
        ? "developer-feedback"
        : identity.adapter?.provider === "github"
          ? "advisory-projection"
          : "integration",
    tier: options.tier,
    ...identity,
    observedGit,
    workspace,
    createdAt: options.createdAt?.() ?? new Date().toISOString(),
    toolVersions: options.toolVersions ?? {
      bun: Bun.version,
      bunNodeCompatibility: process.version,
    },
    result: failureClassification ? "failed" : "passed",
    failureClassification,
    ...(failedGate ? { failedGate } : {}),
    ...(error ? { error } : {}),
    processExitCode,
    durationMs: Math.max(0, Math.round(nowMs() - started)),
    gates,
  };
  const reportPath = await writeReportAtomically(
    report,
    options.reportDirectory ?? DEFAULT_REPORT_DIRECTORY,
  );
  return { report, reportPath, exitCode: processExitCode };
}

function tierFromArgument(argument: string | undefined): CiTier {
  assert(argument === "fast" || argument === "post-commit", "CI tier must be fast or post-commit");
  return argument;
}

if (import.meta.main) {
  try {
    const result = await validateCi({ tier: tierFromArgument(Bun.argv[2]) });
    console.log(`\n[ci] ${result.report.result}: ${result.reportPath}`);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`[ci] infrastructure failure: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}
