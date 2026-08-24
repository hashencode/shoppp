import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import packageManifest from "../package.json";
import { readReleaseSourceIdentity } from "./release-source-identity";
import {
  CI_TIERS,
  resolveCiIdentity,
  validateCi,
  type CiIdentity,
  type GitIdentity,
} from "./ci-validate";

const temporaryDirectories: string[] = [];
const repositoryRoot = resolve(import.meta.dir, "..");
const gitignorePath = resolve(repositoryRoot, ".gitignore");
const prettierignorePath = resolve(repositoryRoot, ".prettierignore");
const eslintConfigPath = resolve(repositoryRoot, "eslint.config.mjs");

async function git(argument: string): Promise<string> {
  const child = Bun.spawn(["git", "rev-parse", argument], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = (await new Response(child.stdout).text()).trim();
  const error = (await new Response(child.stderr).text()).trim();
  if ((await child.exited) !== 0) throw new Error(error || `git rev-parse ${argument} failed`);
  return output;
}

async function observedSourceIdentity(): Promise<GitIdentity> {
  try {
    const source = JSON.parse(
      await readFile(resolve(repositoryRoot, ".release-source.json"), "utf8"),
    ) as { commit?: unknown; tree?: unknown };
    if (
      typeof source.commit === "string" &&
      /^[a-f0-9]{40}$/.test(source.commit) &&
      typeof source.tree === "string" &&
      /^[a-f0-9]{40}$/.test(source.tree)
    ) {
      return { testedSha: source.commit, testedTree: source.tree };
    }
    throw new Error("release source identity is invalid");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      testedSha: await git("HEAD"),
      testedTree: await git("HEAD^{tree}"),
    };
  }
}

const observedGit = await observedSourceIdentity();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function reportDirectory(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "shoppp-ci-"));
  temporaryDirectories.push(root);
  return resolve(root, "reports");
}

function fixedIdentity(overrides: Partial<CiIdentity> = {}): CiIdentity {
  return {
    ...observedGit,
    executionId: "local-check-9001",
    attempt: "1",
    trigger: "post-commit",
    executorClass: "local-macos-arm64",
    ...overrides,
  };
}

describe("repository-owned CI validation", () => {
  test("honors release source markers only in explicit capsule mode", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-source-"));
    temporaryDirectories.push(root);
    const source = {
      schemaVersion: 1,
      commit: "a".repeat(40),
      tree: "b".repeat(40),
    };
    await writeFile(resolve(root, ".release-source.json"), JSON.stringify(source));

    expect(await readReleaseSourceIdentity(root, {})).toBeUndefined();
    expect(await readReleaseSourceIdentity(root, { RELEASE_SOURCE_MODE: "capsule" })).toEqual({
      commit: source.commit,
      tree: source.tree,
    });
  });

  test("defines stable fast and post-commit gates without changing release validation", () => {
    expect(packageManifest.scripts["ci:fast"]).toBe("bun tools/ci-validate.ts fast");
    expect(packageManifest.scripts["ci:post-commit"]).toBe("bun tools/ci-validate.ts post-commit");
    expect(packageManifest.scripts["release:validate"]).toBe("bun tools/release-validate.ts");
    expect(CI_TIERS.fast.map((gate) => gate.name)).toEqual([
      "reproducible-install",
      "format",
      "lint-boundaries",
      "types",
      "unit-contracts",
    ]);
    expect(CI_TIERS["post-commit"].map((gate) => gate.name)).toEqual([
      "reproducible-install",
      "format",
      "lint-boundaries",
      "types",
      "unit-contracts",
      "worker-integration",
      "production-builds",
    ]);
    expect(CI_TIERS["post-commit"].at(-1)?.transientPaths).toEqual([
      "apps/storefront/app/generated/active-experience.ts",
      "apps/storefront/app/generated/active-theme.ts",
    ]);
  });

  test("writes a successful provider-neutral report and removes its temporary file", async () => {
    const directory = await reportDirectory();
    const observed: string[] = [];
    let timestamp = 0;

    const result = await validateCi({
      tier: "fast",
      reportDirectory: directory,
      identity: fixedIdentity(),
      executeGate: async (gate) => {
        observed.push(gate.name);
        return 0;
      },
      nowMs: () => (timestamp += 25),
      createdAt: () => "2026-08-24T10:00:00.000Z",
      toolVersions: { bun: "1.3.5", bunNodeCompatibility: "v24.0.0" },
    });

    expect(result.exitCode).toBe(0);
    expect(observed).toEqual(CI_TIERS.fast.map((gate) => gate.name));
    expect(result.report).toMatchObject({
      schemaVersion: 1,
      evidenceClass: "repository-validation",
      authority: "developer-feedback",
      tier: "fast",
      ...fixedIdentity(),
      result: "passed",
      failureClassification: null,
      processExitCode: 0,
    });
    expect(result.report).not.toHaveProperty("adapter");
    expect(JSON.parse(await readFile(result.reportPath, "utf8"))).toEqual(result.report);
    expect((await readdir(directory)).some((file) => file.includes(".tmp-"))).toBe(false);
  });

  test("stops at a failing gate and classifies it as a test failure", async () => {
    const directory = await reportDirectory();
    const observed: string[] = [];

    const result = await validateCi({
      tier: "post-commit",
      reportDirectory: directory,
      identity: fixedIdentity(),
      workspaceChanges: [],
      executeGate: async (gate) => {
        observed.push(gate.name);
        return gate.name === "lint-boundaries" ? 42 : 0;
      },
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(result.exitCode).toBe(42);
    expect(observed).toEqual(["reproducible-install", "format", "lint-boundaries"]);
    expect(result.report).toMatchObject({
      authority: "integration",
      result: "failed",
      failureClassification: "test",
      failedGate: "lint-boundaries",
      processExitCode: 42,
    });
  });

  test("classifies a prerequisite exception as infrastructure failure", async () => {
    const directory = await reportDirectory();

    const result = await validateCi({
      tier: "fast",
      reportDirectory: directory,
      identity: fixedIdentity(),
      executeGate: async () => {
        throw new Error("spawn bun ENOENT");
      },
      toolVersions: { bun: "unavailable", bunNodeCompatibility: "test" },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      result: "failed",
      failureClassification: "infrastructure",
      failedGate: "reproducible-install",
      processExitCode: 1,
    });
    expect(result.report.gates[0]).toMatchObject({
      status: "failed",
      failureClassification: "infrastructure",
      error: "spawn bun ENOENT",
    });
  });

  test("classifies signal-style gate exits as infrastructure failures", async () => {
    const directory = await reportDirectory();

    const result = await validateCi({
      tier: "post-commit",
      reportDirectory: directory,
      identity: fixedIdentity(),
      workspaceChanges: [],
      executeGate: async (gate) => (gate.name === "format" ? 137 : 0),
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(result.exitCode).toBe(137);
    expect(result.report).toMatchObject({
      result: "failed",
      failureClassification: "infrastructure",
      failedGate: "format",
      processExitCode: 137,
    });
    expect(result.report.gates.at(-1)).toMatchObject({
      name: "format",
      failureClassification: "infrastructure",
    });
  });

  test("rejects SHA and tree mismatches before running gates", async () => {
    const directory = await reportDirectory();
    const observed: string[] = [];

    const result = await validateCi({
      tier: "fast",
      reportDirectory: directory,
      identity: fixedIdentity({
        testedSha: "0000000000000000000000000000000000000000",
        testedTree: "1111111111111111111111111111111111111111",
      }),
      executeGate: async (gate) => {
        observed.push(gate.name);
        return 0;
      },
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(observed).toEqual([]);
    expect(result.report).toMatchObject({
      result: "failed",
      failureClassification: "infrastructure",
      processExitCode: 1,
      observedGit,
    });
    expect(result.report.error).toContain("tested SHA");
    expect(result.report.error).toContain("tested tree");
  });

  test("same SHA uses distinct paths for different attempts", async () => {
    const directory = await reportDirectory();
    const common = {
      tier: "fast" as const,
      reportDirectory: directory,
      executeGate: async () => 0,
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    };

    const first = await validateCi({ ...common, identity: fixedIdentity({ attempt: "1" }) });
    const second = await validateCi({ ...common, identity: fixedIdentity({ attempt: "2" }) });

    expect(first.reportPath).not.toBe(second.reportPath);
    expect(await readdir(directory)).toHaveLength(2);
  });

  test("duplicate report identity cannot overwrite evidence and leaves no temp file", async () => {
    const directory = await reportDirectory();
    const options = {
      tier: "fast" as const,
      reportDirectory: directory,
      identity: fixedIdentity(),
      executeGate: async () => 0,
      createdAt: () => "2026-08-24T10:00:00.000Z",
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    };
    const first = await validateCi(options);
    const original = await readFile(first.reportPath, "utf8");

    await expect(validateCi(options)).rejects.toThrow("already exists");

    expect(await readFile(first.reportPath, "utf8")).toBe(original);
    expect((await readdir(directory)).some((file) => file.includes(".tmp-"))).toBe(false);
  });

  test("keeps core identity local when GitHub environment variables are absent", () => {
    const identity = resolveCiIdentity({
      environment: {},
      observedGit,
      executionId: () => "local-generated",
    });

    expect(identity).toEqual({
      ...observedGit,
      executionId: "local-generated",
      attempt: "1",
      trigger: "local",
      executorClass: `local-${process.platform}-${process.arch}`,
    });
  });

  test("maps GitHub variables only into optional adapter metadata", () => {
    const identity = resolveCiIdentity({
      environment: {
        SHOPPP_CI_EXECUTION_ID: "provider-neutral-7",
        SHOPPP_CI_ATTEMPT: "3",
        SHOPPP_CI_TRIGGER: "trusted-main",
        SHOPPP_CI_EXECUTOR_CLASS: "self-hosted-nonsecret",
        GITHUB_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        GITHUB_RUN_ID: "12345",
        GITHUB_RUN_ATTEMPT: "9",
        GITHUB_EVENT_NAME: "push",
        GITHUB_WORKFLOW: "post-commit",
        GITHUB_WORKFLOW_SHA: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        GITHUB_REPOSITORY: "example/shoppp",
        GITHUB_REF: "refs/heads/main",
        GITHUB_SERVER_URL: "https://github.example",
      },
      observedGit,
    });

    expect(identity).toMatchObject({
      ...observedGit,
      executionId: "provider-neutral-7",
      attempt: "3",
      trigger: "trusted-main",
      executorClass: "self-hosted-nonsecret",
      adapter: {
        provider: "github",
        sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        runId: "12345",
        runAttempt: "9",
        eventName: "push",
        workflow: "post-commit",
        workflowSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        repository: "example/shoppp",
        ref: "refs/heads/main",
        serverUrl: "https://github.example",
      },
    });
    expect(identity.testedSha).toBe(observedGit.testedSha);
    expect(identity.executionId).not.toBe("12345");
    expect(identity.attempt).not.toBe("9");
  });

  test("treats a GitHub-backed post-commit run as an advisory projection", async () => {
    const directory = await reportDirectory();
    const identity = resolveCiIdentity({
      environment: {
        SHOPPP_CI_EXECUTION_ID: "github-projection-1",
        GITHUB_RUN_ID: "12345",
      },
      observedGit,
    });

    const result = await validateCi({
      tier: "post-commit",
      reportDirectory: directory,
      identity,
      workspaceChanges: [],
      executeGate: async () => 0,
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(result.report.authority).toBe("advisory-projection");
    expect(result.report.adapter).toEqual({ provider: "github", runId: "12345" });
  });

  test("refuses post-commit integration evidence from a dirty worktree", async () => {
    const directory = await reportDirectory();
    const observed: string[] = [];

    const result = await validateCi({
      tier: "post-commit",
      reportDirectory: directory,
      identity: fixedIdentity(),
      workspaceChanges: [" M apps/storefront/example.ts", "?? untracked-source.ts"],
      executeGate: async (gate) => {
        observed.push(gate.name);
        return 0;
      },
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(observed).toEqual([]);
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      authority: "integration",
      result: "failed",
      failureClassification: "infrastructure",
      processExitCode: 1,
      workspace: {
        requiredClean: true,
        clean: false,
        changes: [" M apps/storefront/example.ts", "?? untracked-source.ts"],
      },
    });
    expect(result.report.error).toContain("post-commit validation requires a clean worktree");
  });

  test("stops when a successful post-commit gate changes the worktree", async () => {
    const directory = await reportDirectory();
    const observed: string[] = [];
    let workspaceObservation = 0;

    const result = await validateCi({
      tier: "post-commit",
      reportDirectory: directory,
      identity: fixedIdentity(),
      observeWorkspaceChanges: async () =>
        workspaceObservation++ === 0 ? [] : [" M apps/storefront/generated.ts"],
      executeGate: async (gate) => {
        observed.push(gate.name);
        return 0;
      },
      toolVersions: { bun: "test", bunNodeCompatibility: "test" },
    });

    expect(observed).toEqual(["reproducible-install"]);
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      result: "failed",
      failureClassification: "infrastructure",
      failedGate: "reproducible-install",
      workspace: {
        requiredClean: true,
        clean: false,
        changes: [" M apps/storefront/generated.ts"],
      },
    });
    expect(result.report.error).toContain("changed the worktree");
  });

  test("ignores generated CI reports", async () => {
    expect(await readFile(gitignorePath, "utf8")).toMatch(/^artifacts\/ci\/$/m);
  });

  test("keeps repository-local worktrees outside shared formatting and lint gates", async () => {
    expect(await readFile(prettierignorePath, "utf8")).toMatch(/^\.worktrees\/$/m);
    expect(await readFile(eslintConfigPath, "utf8")).toContain('"**/.worktrees/**"');
  });
});
