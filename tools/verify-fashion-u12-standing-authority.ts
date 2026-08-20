import { spawnSync } from "node:child_process";

const SHA_PATTERN = /^[a-f0-9]{40}$/;

export const FASHION_U12_AUTHORITY_BASELINE = "79fbee07f60245b036b5a4d42858227502947a5c";

const ALLOWED_PATHS = new Set([
  ".github/workflows/prepare-fashion-staging-u12.yml",
  ".github/workflows/preview-storefront.yml",
  "apps/storefront/scripts/prepare-experience.ts",
  "apps/storefront/tests/preview-access.test.ts",
  "apps/storefront/tests/theme-engine.test.ts",
  "apps/storefront/worker/preview-access.ts",
  "docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md",
  "docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md",
  "docs/progress/fashion-store-functional-integration.md",
  "docs/runbooks/storefront-theme-testing.md",
  "e2e/fashion-store-purchase.spec.ts",
  "packages/db/migrations/0021_fashion_shipping_method_public_id.sql",
  "packages/db/test/apply-migrations.ts",
  "packages/db/test/env.d.ts",
  "packages/db/test/migrations.test.ts",
  "packages/db/wrangler.jsonc",
  "tools/capture-fashion-staging-readiness.test.ts",
  "tools/capture-fashion-staging-readiness.ts",
  "tools/deploy-workflow.test.ts",
  "tools/verify-fashion-staging-readiness.test.ts",
  "tools/verify-fashion-staging-readiness.ts",
  "tools/verify-fashion-u12-standing-authority.test.ts",
  "tools/verify-fashion-u12-standing-authority.ts",
]);

interface StandingAuthorityCommit {
  files: string[];
  parentCount: number;
  sha: string;
  subject: string;
}

interface StandingAuthorityInput {
  baseline: string;
  commits: StandingAuthorityCommit[];
  head: string;
  isDescendant: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertStandingFashionU12Authority(input: StandingAuthorityInput): {
  baseline: string;
  commitCount: number;
  head: string;
} {
  assert(
    input.baseline === FASHION_U12_AUTHORITY_BASELINE,
    "Fashion U12 standing authority used an unapproved baseline",
  );
  assert(SHA_PATTERN.test(input.head), "Fashion U12 standing authority head is not a full SHA");
  assert(
    input.isDescendant,
    "Fashion U12 standing authority head must descend from the approved baseline",
  );
  for (const commit of input.commits) {
    assert(SHA_PATTERN.test(commit.sha), "Fashion U12 standing authority commit is not a full SHA");
    assert(
      commit.parentCount === 1,
      `Commit ${commit.sha} must have exactly one parent in the standing FS-U12 scope`,
    );
    assert(
      commit.subject.endsWith("(U12)"),
      `Commit ${commit.sha} is not an FS-U12 commit: ${commit.subject}`,
    );
    for (const path of commit.files) {
      assert(
        ALLOWED_PATHS.has(path),
        `Commit ${commit.sha} changes ${path} outside the standing FS-U12 scope`,
      );
    }
  }
  return { baseline: input.baseline, commitCount: input.commits.length, head: input.head };
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`Use --${name}=<full-sha>`);
  return value;
}

function git(arguments_: string[]): string {
  const result = spawnSync("git", arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${arguments_.join(" ")} failed`);
  }
  return result.stdout.trim();
}

if (import.meta.main) {
  const baseline = argument("baseline");
  const head = argument("head");
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", baseline, head]);
  const commits = git(["log", "--reverse", "--format=%H%x09%s", `${baseline}..${head}`])
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subjectParts] = line.split("\t");
      const parentCount = git(["rev-list", "--parents", "-n", "1", sha!]).split(" ").length - 1;
      return {
        files: git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha!])
          .split("\n")
          .filter(Boolean),
        parentCount,
        sha: sha!,
        subject: subjectParts.join("\t"),
      };
    });
  console.log(
    JSON.stringify(
      assertStandingFashionU12Authority({
        baseline,
        commits,
        head,
        isDescendant: ancestry.status === 0,
      }),
    ),
  );
}
