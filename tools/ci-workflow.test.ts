import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workflowsDirectory = resolve(import.meta.dir, "../.github/workflows");
const postCommitWorkflowPath = resolve(workflowsDirectory, "post-commit-ci.yml");
const fullValidationWorkflowPath = resolve(workflowsDirectory, "full-validation.yml");
const legacyCiWorkflowPath = resolve(workflowsDirectory, "ci.yml");

async function workflow(path: string): Promise<string> {
  return readFile(path, "utf8");
}

const postCommitWorkflow = workflow(postCommitWorkflowPath);
const fullValidationWorkflow = workflow(fullValidationWorkflowPath);

function expectActionsPinnedToFullShas(contents: string): void {
  const actionReferences = [...contents.matchAll(/^\s+(?:- )?uses: ([^\s]+)$/gm)].map(
    (match) => match[1],
  );
  expect(actionReferences.length).toBeGreaterThan(0);
  for (const reference of actionReferences) {
    expect(reference).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
  }
}

describe("local-first CI workflow contracts", () => {
  test("retires mixed PR/main/scheduled orchestration without adding PR automation", async () => {
    const [postCommit, fullValidation] = await Promise.all([
      postCommitWorkflow,
      fullValidationWorkflow,
    ]);

    for (const contents of [postCommit, fullValidation]) {
      expect(contents).not.toMatch(/^\s+pull_request(?:_target)?:/m);
    }
    await expect(workflow(legacyCiWorkflowPath)).rejects.toThrow();
  });

  test("routes only a non-deletion main push to the non-secret advisory tier", async () => {
    const contents = await postCommitWorkflow;

    expect(contents).toMatch(/^\s+push:\n\s+branches:\n\s+- main$/m);
    expect(contents).not.toMatch(/^\s+(?:workflow_dispatch|schedule):/m);
    expect(contents).toContain("github.event.deleted == false");
    expect(contents).toContain("github.ref == 'refs/heads/main'");
    expect(contents).toContain("runs-on: [self-hosted, macOS, ARM64, shoppp-main-nonsecret]");
    expect(contents).toContain("run: bun run ci:post-commit");
    expect(contents).not.toMatch(/\$\{\{\s*secrets\./);
    expect(contents).not.toMatch(/^\s+environment:/m);
  });

  test("finishes the running main validation while GitHub coalesces pending tips", async () => {
    const contents = await postCommitWorkflow;

    expect(contents).toMatch(
      /concurrency:\n\s+group: post-commit-main\n\s+cancel-in-progress: false/,
    );
  });

  test("binds exact checkout and report identity to the immutable event SHA", async () => {
    const contents = await postCommitWorkflow;

    expect(contents).toContain("ref: ${{ github.sha }}");
    expect(contents).toContain('test "$actual_sha" = "$GITHUB_SHA"');
    expect(contents).toContain("SHOPPP_CI_TESTED_SHA: ${{ github.sha }}");
    expect(contents).toContain("SHOPPP_CI_TESTED_TREE: ${{ steps.identity.outputs.tree }}");
    expect(contents).toContain("SHOPPP_CI_EXECUTION_ID: github-${{ github.run_id }}");
    expect(contents).toContain("SHOPPP_CI_ATTEMPT: ${{ github.run_attempt }}");
    expect(contents).toContain(
      "path: artifacts/ci/${{ github.sha }}-${{ steps.identity.outputs.tree }}-github-${{ github.run_id }}-attempt-${{ github.run_attempt }}-post-commit.json",
    );
    expect(contents).toContain("if-no-files-found: error");
  });

  test("keeps manual and scheduled full validation hosted with unchanged release semantics", async () => {
    const contents = await fullValidationWorkflow;

    expect(contents).toMatch(/^\s+workflow_dispatch:$/m);
    expect(contents).toMatch(/^\s+schedule:\n\s+- cron: "17 3 \* \* 2"$/m);
    expect(contents).not.toMatch(/^\s+push:/m);
    expect(contents).toContain("runs-on: ubuntu-latest");
    expect(contents).toContain("timeout-minutes: 45");
    expect(contents).toContain("Install browser runtime");
    expect(contents).toContain("Install font inspection runtime");
    expect(contents).toContain('bun run release:validate -- --release-id "ci-${GITHUB_SHA}"');
    expect(contents).toContain("path: artifacts/releases/ci-${{ github.sha }}.json");
  });

  test("uses read-only checkout and immutable bounded dependencies", async () => {
    const [postCommit, fullValidation] = await Promise.all([
      postCommitWorkflow,
      fullValidationWorkflow,
    ]);

    for (const contents of [postCommit, fullValidation]) {
      expect(contents).toMatch(/permissions:\n\s+contents: read/);
      expect(contents).toContain("persist-credentials: false");
      expect(contents).toContain("ref: ${{ github.sha }}");
      expect(contents).toMatch(/timeout-minutes: \d+/);
      expectActionsPinnedToFullShas(contents);
    }
  });

  test("does not reuse or reinterpret Fashion U8 workflow boundaries", async () => {
    const postCommit = await postCommitWorkflow;
    expect(postCommit).not.toMatch(/fashion|preview|acceptance/i);

    const featureWorkflowNames = (await readdir(workflowsDirectory)).filter((name) =>
      /fashion|preview/.test(name),
    );
    expect(featureWorkflowNames.length).toBeGreaterThan(0);
    const featureWorkflows = await Promise.all(
      featureWorkflowNames.map((name) => workflow(resolve(workflowsDirectory, name))),
    );
    for (const contents of featureWorkflows) {
      expect(contents).not.toContain("shoppp-main-nonsecret");
      expect(contents).not.toContain("bun run ci:post-commit");
    }
  });
});
