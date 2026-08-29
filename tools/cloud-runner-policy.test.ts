import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const workflowsDirectory = resolve(import.meta.dir, "../.github/workflows");
const protectedFashionWorkflows = [
  "accept-fashion-staging-u8.yml",
  "prepare-fashion-staging-u12.yml",
  "prepare-fashion-staging-u8.yml",
  "preview-storefront.yml",
] as const;

async function readWorkflow(name: string): Promise<string> {
  return readFile(resolve(workflowsDirectory, name), "utf8");
}

function externalActionReferences(contents: string): string[] {
  return (contents.match(/^\s+(?:-\s+)?uses:\s+\S+/gm) ?? [])
    .map((line) => line.replace(/^\s+(?:-\s+)?uses:\s+/, ""))
    .filter((reference) => !reference.startsWith("./"));
}

function jobBlocks(contents: string): string[] {
  const starts = [...contents.matchAll(/^ {2}([A-Za-z0-9_-]+):\n/gm)];
  return starts.map((match, index) => {
    const start = match.index!;
    const end = starts[index + 1]?.index ?? contents.length;
    return contents.slice(start, end);
  });
}

describe("GitHub-managed cloud runner policy", () => {
  test("uses one fixed standard hosted image for every current automation job", async () => {
    const names = (await readdir(workflowsDirectory)).filter((name) => name.endsWith(".yml"));
    for (const name of names) {
      const contents = await readWorkflow(name);
      expect(contents, name).not.toMatch(/self-hosted|runs-on:\s*\$\{\{/);
      for (const line of contents.match(/^\s+runs-on:.*$/gm) ?? []) {
        expect(line.trim(), name).toBe("runs-on: ubuntu-24.04");
      }
    }
  });

  test("pins every third-party Action in the complete workflow graph", async () => {
    const names = (await readdir(workflowsDirectory)).filter((name) => name.endsWith(".yml"));
    for (const name of names) {
      for (const reference of externalActionReferences(await readWorkflow(name))) {
        expect(reference, `${name}: ${reference}`).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
      }
    }
  });

  test("keeps Fashion staging authority behind credential-free fixed-ref verification", async () => {
    for (const name of protectedFashionWorkflows) {
      const contents = await readWorkflow(name);
      expect(contents, name).not.toMatch(/^\s+pull_request(?:_target)?:/m);
      expect(contents, name).toContain("EXPECTED_REPOSITORY: hashencode/shoppp");
      expect(contents, name).toContain("github.ref == 'refs/heads/main'");
      expect(contents, name).toContain("github.event.repository.fork == false");
      expect(contents, name).toContain("FASHION_STAGING_OPERATORS");

      const verifierStart = contents.indexOf("  verify-authority:");
      const jobs = jobBlocks(contents);
      const protectedJobs = jobs.filter(
        (job) => job.includes("environment: fashion-staging") || /\$\{\{\s*secrets\./.test(job),
      );
      expect(verifierStart, name).toBeGreaterThan(0);
      expect(protectedJobs.length, name).toBeGreaterThan(0);
      const protectedStart = contents.indexOf(protectedJobs[0]!);
      expect(protectedStart, name).toBeGreaterThan(verifierStart);
      const verifier = contents.slice(verifierStart, protectedStart);
      expect(verifier, name).not.toContain("environment:");
      expect(verifier, name).not.toMatch(/secrets\.|id-token:\s*write/);
      for (const job of jobs) {
        for (const checkout of job.matchAll(
          /uses: actions\/checkout@[0-9a-f]{40}[\s\S]*?(?=\n\s+- uses:|\n {2}\S|$)/g,
        )) {
          expect(checkout[0], name).toContain("ref: ${{ github.sha }}");
        }
      }
      for (const protectedJob of protectedJobs) {
        expect(protectedJob, name).toContain("needs: verify-authority");
        expect(protectedJob, name).toContain("environment: fashion-staging");
        expect(protectedJob, name).toContain("id-token: write");
        expect(
          protectedJob.indexOf('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"'),
          name,
        ).toBeLessThan(protectedJob.indexOf("ACTIONS_ID_TOKEN_REQUEST_TOKEN"));
      }
    }
  });
});
