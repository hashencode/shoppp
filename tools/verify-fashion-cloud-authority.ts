export interface FashionCloudAuthorityInput {
  actor: string;
  authorizedActors: string;
  candidateSha: string;
  eventName: string;
  expectedRepository: string;
  harnessSha: string;
  isFork: boolean;
  ref: string;
  repository: string;
  repositoryOwner: string;
  workflowSha: string;
}

const sha = /^[a-f0-9]{40}$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyFashionCloudAuthority(input: FashionCloudAuthorityInput) {
  assert(input.eventName === "workflow_dispatch", "Fashion staging requires workflow_dispatch");
  assert(
    !input.isFork && input.repository === input.expectedRepository,
    "Fashion staging requires the exact base repository",
  );
  assert(input.ref === "refs/heads/main", "Fashion staging requires the exact main ref");
  assert(sha.test(input.candidateSha), "candidate SHA must be a full lowercase SHA");
  assert(sha.test(input.harnessSha), "harness SHA must be a full lowercase SHA");
  assert(
    input.workflowSha === input.harnessSha,
    "workflow SHA must equal the reviewed harness SHA",
  );
  const authorizedActors = new Set(
    input.authorizedActors
      .split(",")
      .map((actor) => actor.trim())
      .filter(Boolean),
  );
  assert(
    input.actor === input.repositoryOwner || authorizedActors.has(input.actor),
    "workflow actor is not authorized for Fashion staging",
  );
  return {
    candidateSha: input.candidateSha,
    harnessSha: input.harnessSha,
    passed: true as const,
    runnerClass: "github-hosted-ubuntu-24.04" as const,
  };
}

if (import.meta.main) {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const result = verifyFashionCloudAuthority({
    actor: required("GITHUB_ACTOR"),
    authorizedActors: process.env.FASHION_STAGING_OPERATORS ?? "",
    candidateSha: required("FASHION_CANDIDATE_SHA"),
    eventName: required("GITHUB_EVENT_NAME"),
    expectedRepository: required("EXPECTED_REPOSITORY"),
    harnessSha: required("FASHION_HARNESS_SHA"),
    isFork: required("GITHUB_REPOSITORY_IS_FORK") === "true",
    ref: required("GITHUB_REF"),
    repository: required("GITHUB_REPOSITORY"),
    repositoryOwner: required("GITHUB_REPOSITORY_OWNER"),
    workflowSha: required("GITHUB_SHA"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
