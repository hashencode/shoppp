import { appendFile } from "node:fs/promises";
import { parseArgs } from "node:util";

export type TrustedSourcePreflightMode = "deploy" | "validation";

export interface TrustedSourcePreflightInput {
  mode: TrustedSourcePreflightMode;
  defaultBranch: string;
  eventName: string;
  fallbackSourceSha: string;
  frozenCandidateRef?: string;
  repository: string;
  repositoryOwner: string;
  requestedReleaseId?: string;
  requestedSourceRef?: string;
  requestedSourceSha?: string;
  releaseOperators?: string;
  scheduledCatalogReleaseId?: string;
  workflowActor: string;
  workflowRef: string;
}

export interface TrustedSourceRequest {
  defaultBranch: string;
  frozenCandidateRef?: string;
  mode: TrustedSourcePreflightMode;
  releaseId: string;
  requestedSourceRef?: string;
  sourceSha: string;
}

export interface TrustedSourceIdentity extends TrustedSourceRequest {
  sourceTree?: string;
}

export interface GitCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type GitRunner = (arguments_: string[]) => Promise<GitCommandResult>;

const FULL_SHA = /^[a-f0-9]{40}$/;
const SAFE_RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function assertGovernedRef(value: string): void {
  assert(
    value.startsWith("refs/heads/") || value.startsWith("refs/tags/"),
    "frozen candidate ref must be a branch or tag ref",
  );
}

export function prepareTrustedSourceRequest(
  input: TrustedSourcePreflightInput,
): TrustedSourceRequest {
  const defaultBranch = input.defaultBranch.trim();
  assert(defaultBranch.length > 0, "default branch is missing");
  const sourceSha = trimmed(input.requestedSourceSha) ?? input.fallbackSourceSha.trim();
  assert(FULL_SHA.test(sourceSha), "source SHA is invalid");

  const allowedWorkflowFiles =
    input.mode === "deploy" ? ["deploy.yml"] : ["full-validation.yml", "deploy.yml"];
  const workflowTrusted = allowedWorkflowFiles.some(
    (file) =>
      input.workflowRef ===
      `${input.repository}/.github/workflows/${file}@refs/heads/${defaultBranch}`,
  );
  assert(workflowTrusted, "release workflow must come from the protected default branch");

  const operators = new Set(
    (input.releaseOperators ?? "")
      .split(",")
      .map((operator) => operator.trim())
      .filter(Boolean),
  );
  assert(
    input.workflowActor === input.repositoryOwner || operators.has(input.workflowActor),
    "workflow actor is not an authorized release operator",
  );

  const frozenCandidateRef = trimmed(input.frozenCandidateRef);
  const requestedSourceRef = trimmed(input.requestedSourceRef);
  if (requestedSourceRef) {
    assert(frozenCandidateRef, "requested source ref is not governed");
    assert(requestedSourceRef === frozenCandidateRef, "requested source ref is not governed");
    assertGovernedRef(frozenCandidateRef);
  }

  let releaseId = trimmed(input.requestedReleaseId);
  if (!releaseId && input.eventName === "schedule") {
    releaseId = trimmed(input.scheduledCatalogReleaseId);
    assert(
      releaseId,
      "scheduled validation requires SCHEDULED_CATALOG_RELEASE_ID for an existing approved release",
    );
  }
  releaseId ??= `ci-${sourceSha}`;
  assert(SAFE_RELEASE_ID.test(releaseId), "release ID contains unsafe characters");

  return {
    defaultBranch,
    ...(frozenCandidateRef ? { frozenCandidateRef } : {}),
    mode: input.mode,
    releaseId,
    ...(requestedSourceRef ? { requestedSourceRef } : {}),
    sourceSha,
  };
}

async function systemGit(arguments_: string[]): Promise<GitCommandResult> {
  const child = Bun.spawn(["git", ...arguments_], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stderr: stderr.trim(), stdout: stdout.trim() };
}

function requireGit(result: GitCommandResult, operation: string): string {
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `${operation} failed`);
  }
  return result.stdout;
}

export async function resolveTrustedSourceIdentity(
  request: TrustedSourceRequest,
  git: GitRunner = systemGit,
): Promise<TrustedSourceIdentity> {
  if (request.requestedSourceRef) {
    requireGit(
      await git(["check-ref-format", request.requestedSourceRef]),
      "candidate ref validation",
    );
  }
  if (request.mode === "deploy") return request;

  const ancestry = await git([
    "merge-base",
    "--is-ancestor",
    request.sourceSha,
    `origin/${request.defaultBranch}`,
  ]);
  if (ancestry.exitCode === 1) {
    assert(request.frozenCandidateRef, "source is outside the protected reachable set");
    assert(
      request.requestedSourceRef === request.frozenCandidateRef,
      "source is outside the protected reachable set",
    );
    assertGovernedRef(request.frozenCandidateRef);
    requireGit(
      await git([
        "fetch",
        "--no-tags",
        "origin",
        `+${request.frozenCandidateRef}:${request.frozenCandidateRef}`,
      ]),
      "frozen candidate fetch",
    );
    const candidateSha = requireGit(
      await git(["rev-parse", `${request.frozenCandidateRef}^{commit}`]),
      "frozen candidate resolution",
    );
    assert(candidateSha === request.sourceSha, "frozen candidate ref resolved to a different SHA");
  } else if (ancestry.exitCode !== 0) {
    throw new Error(ancestry.stderr || "default-branch ancestry check failed");
  } else if (request.requestedSourceRef) {
    assert(
      request.requestedSourceRef === request.frozenCandidateRef,
      "requested source ref is not governed",
    );
  }

  requireGit(await git(["cat-file", "-e", `${request.sourceSha}^{commit}`]), "source lookup");
  const sourceTree = requireGit(
    await git(["rev-parse", `${request.sourceSha}^{tree}`]),
    "source tree resolution",
  );
  assert(FULL_SHA.test(sourceTree), "source tree is invalid");
  return { ...request, sourceTree };
}

async function appendGitHubOutputs(path: string, identity: TrustedSourceIdentity): Promise<void> {
  const outputs = [
    `source_sha=${identity.sourceSha}`,
    ...(identity.sourceTree ? [`source_tree=${identity.sourceTree}`] : []),
    `release_id=${identity.releaseId}`,
  ];
  await appendFile(path, `${outputs.join("\n")}\n`);
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: { mode: { type: "string" } },
  });
  assert(values.mode === "deploy" || values.mode === "validation", "preflight mode is invalid");
  const request = prepareTrustedSourceRequest({
    mode: values.mode,
    defaultBranch: process.env.DEFAULT_BRANCH ?? "",
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    fallbackSourceSha: process.env.GITHUB_SHA ?? "",
    ...(process.env.FROZEN_CANDIDATE_REF
      ? { frozenCandidateRef: process.env.FROZEN_CANDIDATE_REF }
      : {}),
    repository: process.env.GITHUB_REPOSITORY ?? "",
    repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER ?? "",
    ...(process.env.REQUESTED_RELEASE_ID || process.env.RELEASE_ID
      ? { requestedReleaseId: process.env.REQUESTED_RELEASE_ID ?? process.env.RELEASE_ID! }
      : {}),
    ...(process.env.REQUESTED_SOURCE_REF
      ? { requestedSourceRef: process.env.REQUESTED_SOURCE_REF }
      : {}),
    ...(process.env.REQUESTED_SOURCE_SHA
      ? { requestedSourceSha: process.env.REQUESTED_SOURCE_SHA }
      : {}),
    ...(process.env.RELEASE_OPERATORS ? { releaseOperators: process.env.RELEASE_OPERATORS } : {}),
    ...(process.env.SCHEDULED_CATALOG_RELEASE_ID
      ? { scheduledCatalogReleaseId: process.env.SCHEDULED_CATALOG_RELEASE_ID }
      : {}),
    workflowActor: process.env.GITHUB_ACTOR ?? "",
    workflowRef: process.env.GITHUB_WORKFLOW_REF ?? "",
  });
  const identity = await resolveTrustedSourceIdentity(request);
  const outputPath = process.env.GITHUB_OUTPUT;
  assert(outputPath, "GITHUB_OUTPUT is missing");
  await appendGitHubOutputs(outputPath, identity);
  console.log(`Trusted ${identity.mode} source: ${identity.sourceSha}`);
}
