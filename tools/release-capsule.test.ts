import { describe, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import packageManifest from "../package.json";
import { RELEASE_ARTIFACT_PATHS, RELEASE_GATES } from "./release-validate";
import { trackedSourcePaths } from "./verify-static-output";
import {
  CAPSULE_PLATFORM,
  RELEASE_CAPSULE_MANIFEST,
  assertReleaseCapsuleEnvironment,
  capsuleRunArguments,
  classifyCapsuleResult,
  finalizeCapsuleRun,
  prepareCapsuleEvidenceDirectory,
  sourceTreeRevision,
  writeCapsuleReceipt,
} from "./release-capsule";

const dockerfile = readFile(
  resolve(import.meta.dir, "../containers/release-validation/Dockerfile"),
  "utf8",
);
const containerEntrypoint = readFile(
  resolve(import.meta.dir, "../containers/release-validation/run.sh"),
  "utf8",
);

const sourceCommit = "c".repeat(40);
const sourceTree = "d".repeat(40);

function releaseReport(status: "passed" | "failed") {
  const gates = status === "passed" ? RELEASE_GATES : [RELEASE_GATES[0]!];
  return {
    schemaVersion: 1,
    releaseId: "release-1",
    target: "staging",
    commit: sourceCommit,
    createdAt: "2026-08-24T10:00:00.000Z",
    status,
    gates: gates.map((gate, index) => ({
      ...gate,
      durationMs: 1,
      status: status === "failed" && index === gates.length - 1 ? "failed" : "passed",
      exitCode: status === "failed" && index === gates.length - 1 ? 1 : 0,
    })),
    artifactDigests:
      status === "passed"
        ? Object.fromEntries(
            RELEASE_ARTIFACT_PATHS.map((path) => [path, `sha256:${"e".repeat(64)}`]),
          )
        : {},
    environmentIsolation: { mode: "structural", environments: [] },
  };
}

describe("provider-neutral release capsule", () => {
  test("pins the Linux amd64 browser and Bun images by platform manifest digest", async () => {
    const contents = await dockerfile;
    expect(CAPSULE_PLATFORM).toBe("linux/amd64");
    expect(contents).toContain(
      "oven/bun@sha256:7985c11f2d6f8b3cd67cfe6e4da08151102a63db596b79bcaed5e9a50965276e",
    );
    expect(contents).toContain(
      "mcr.microsoft.com/playwright@sha256:02bbb2155cd7109e3e9c741941097ed1608cf8b6fa44ee2595896da2bdc1f471",
    );
    for (const line of contents.split("\n").filter((line) => line.startsWith("FROM "))) {
      if (!line.includes(" AS bun") && !line.includes(" AS base")) continue;
      expect(line).toContain("@sha256:");
    }
    expect(contents).toContain(".release-tracked-files");
    expect(contents).toContain("FROM base AS dependency-cache");
    expect(contents).toContain("COPY --from=dependency-cache /root/.bun/install/cache");
    expect(contents).toContain("COPY --from=dependency-cache /root/.npm/_prebuilds");
    expect(contents).toContain("! find /workspace -type d -name node_modules");
    expect(contents).toContain("ca-certificates=20260601~24.04.1");
    expect(contents).toContain("git=1:2.43.0-1ubuntu7.3");
    expect(contents).toContain("python3=3.12.3-0ubuntu2.1");
    expect(contents).toContain("woff2=1.0.2-2build1");
    expect(contents).toContain("inspect-release-capsule.ts --verify");
  });

  test("uses the capsule tracked-source manifest without carrying Git history", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-capsule-"));
    try {
      await writeFile(
        resolve(root, ".release-tracked-files"),
        "./package.json\0./tools/example.ts\0",
      );
      expect(
        await trackedSourcePaths(root, {
          RELEASE_SOURCE_MODE: "capsule",
        }),
      ).toEqual(["package.json", "tools/example.ts"]);
      expect(await dockerfile).not.toContain("COPY .git");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("declares every full gate and its execution dependencies", () => {
    expect(RELEASE_CAPSULE_MANIFEST.gates.map(({ name }) => name)).toEqual(
      RELEASE_GATES.map(({ name }) => name),
    );
    expect(RELEASE_CAPSULE_MANIFEST.gates).toHaveLength(17);
    for (const gate of RELEASE_CAPSULE_MANIFEST.gates) {
      expect(gate.dependencies.length).toBeGreaterThan(0);
      expect(gate.credentials).toEqual([]);
    }
    expect(RELEASE_CAPSULE_MANIFEST.toolchain).toEqual({
      bun: "1.3.5",
      node: "v24.18.0",
      playwright: "1.62.0",
      platform: "linux/amd64",
      systemCommands: expect.any(Object),
      browserEntries: expect.arrayContaining(["chromium-1234", "webkit-2336"]),
      browserExecutables: expect.any(Object),
    });
    expect(RELEASE_CAPSULE_MANIFEST.toolchain.systemCommands).toHaveProperty("bunx", {
      path: "/usr/local/bin/bunx",
      sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });

  test("builds and runs only the exact source through a bounded Docker interface", () => {
    const args = capsuleRunArguments({
      image: "shoppp-release-capsule@sha256:" + "a".repeat(64),
      outputDirectory: "/tmp/shoppp-release-output",
      releaseId: "release-123",
    });
    expect(args).toEqual([
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--network",
      "none",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "2048",
      "--shm-size",
      "1gb",
      "--mount",
      "type=bind,src=/tmp/shoppp-release-output,dst=/evidence",
      "--env",
      "CI=true",
      "--env",
      "RELEASE_ID=release-123",
      "shoppp-release-capsule@sha256:" + "a".repeat(64),
    ]);
    expect(packageManifest.scripts["release:validate:capsule"]).toBe(
      "bun tools/release-capsule.ts",
    );
  });

  test("binds the tree lookup to the already captured commit", () => {
    const commit = "a".repeat(40);
    expect(sourceTreeRevision(commit)).toBe(`${commit}^{tree}`);
    expect(() => sourceTreeRevision("HEAD")).toThrow(/source commit is invalid/);
  });

  test("requires an empty canonical evidence directory", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-evidence-"));
    try {
      const empty = resolve(root, "empty");
      expect(await prepareCapsuleEvidenceDirectory(empty)).toBe(await realpath(empty));
      await writeFile(resolve(empty, "existing.json"), "{}\n");
      await expect(prepareCapsuleEvidenceDirectory(empty)).rejects.toThrow(/must be empty/);
      const linked = resolve(root, "linked");
      await symlink(empty, linked);
      await expect(prepareCapsuleEvidenceDirectory(linked)).rejects.toThrow(/not a real directory/);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("fails evidence finalization closed and never overwrites a report", async () => {
    const contents = await containerEntrypoint;
    expect(contents).toContain("release capsule validation produced no report");
    expect(contents).toContain('ln "${temporary}" "${final}"');
    expect(contents).not.toContain('mv "${temporary}" "${final}"');

    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-finalize-"));
    try {
      const workspace = resolve(root, "workspace");
      const evidence = resolve(root, "evidence");
      const binary = resolve(root, "bin");
      await Promise.all([mkdir(workspace), mkdir(evidence), mkdir(binary)]);
      await writeFile(resolve(workspace, ".release-source.json"), "{}\n");
      const fakeBun = resolve(binary, "bun");
      await writeFile(
        fakeBun,
        '#!/bin/sh\nif test "${FAKE_REPORT:-}" = 1; then mkdir -p "${SHOPPP_CAPSULE_WORKSPACE_ROOT}/artifacts/releases"; printf "new\\n" > "${SHOPPP_CAPSULE_WORKSPACE_ROOT}/artifacts/releases/${RELEASE_ID}.json"; fi\nexit 0\n',
      );
      await chmod(fakeBun, 0o755);
      const execute = async (extra: Record<string, string> = {}) => {
        const child = Bun.spawn(
          ["sh", resolve(import.meta.dir, "../containers/release-validation/run.sh")],
          {
            env: {
              ...process.env,
              ...extra,
              PATH: `${binary}:${process.env.PATH ?? ""}`,
              RELEASE_ID: "test-release",
              SHOPPP_CAPSULE_EVIDENCE_ROOT: evidence,
              SHOPPP_CAPSULE_WORKSPACE_ROOT: workspace,
            },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const stderr = await new Response(child.stderr).text();
        return { exitCode: await child.exited, stderr };
      };
      expect(await execute()).toEqual({
        exitCode: 67,
        stderr: "release capsule validation produced no report\n",
      });
      const final = resolve(evidence, "test-release.json");
      await writeFile(final, "existing\n");
      expect((await execute({ FAKE_REPORT: "1" })).exitCode).toBe(69);
      expect(await readFile(final, "utf8")).toBe("existing\n");
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("classifies only a matching validator report as validation", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-classification-"));
    const report = resolve(root, "release.json");
    try {
      await writeFile(report, JSON.stringify(releaseReport("failed")));
      expect(
        await classifyCapsuleResult({
          containerExitCode: 1,
          releaseId: "release-1",
          reportPath: report,
          expectedCommit: sourceCommit,
        }),
      ).toEqual({ kind: "validation", reportValid: true });
      expect(
        await classifyCapsuleResult({
          containerExitCode: 69,
          releaseId: "release-1",
          reportPath: report,
          expectedCommit: sourceCommit,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });
      expect(
        await classifyCapsuleResult({
          containerExitCode: 0,
          releaseId: "release-1",
          reportPath: report,
          expectedCommit: sourceCommit,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });

      await writeFile(
        report,
        JSON.stringify({ schemaVersion: 1, releaseId: "release-1", status: "passed" }),
      );
      expect(
        await classifyCapsuleResult({
          containerExitCode: 0,
          releaseId: "release-1",
          reportPath: report,
          expectedCommit: sourceCommit,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });

      const reordered = releaseReport("passed");
      [reordered.gates[0], reordered.gates[1]] = [reordered.gates[1]!, reordered.gates[0]!];
      await writeFile(report, JSON.stringify(reordered));
      expect(
        await classifyCapsuleResult({
          containerExitCode: 0,
          releaseId: "release-1",
          reportPath: report,
          expectedCommit: sourceCommit,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("writes immutable receipts and removes only the previous image after valid evidence", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "shoppp-release-receipt-"));
    try {
      await writeFile(resolve(root, "release-1.json"), JSON.stringify(releaseReport("passed")));
      const built = {
        image: `sha256:${"a".repeat(64)}`,
        previousImage: `sha256:${"b".repeat(64)}`,
        source: { commit: sourceCommit, tree: sourceTree },
      };
      expect(
        await writeCapsuleReceipt(
          { built, containerExitCode: 0, outputDirectory: root, releaseId: "release-1" },
          { readToolchain: async () => ({ manifestDigest: `sha256:${"f".repeat(64)}` }) },
        ),
      ).toBe(true);
      const receipt = JSON.parse(await readFile(resolve(root, "release-1.capsule.json"), "utf8"));
      expect(receipt).toMatchObject({
        source: built.source,
        imageId: built.image,
        classification: "validation",
        manifestDigest: `sha256:${"f".repeat(64)}`,
      });
      await expect(
        writeCapsuleReceipt(
          { built, containerExitCode: 0, outputDirectory: root, releaseId: "release-1" },
          { readToolchain: async () => ({ manifestDigest: `sha256:${"f".repeat(64)}` }) },
        ),
      ).rejects.toThrow();

      const removed: string[] = [];
      await finalizeCapsuleRun(
        { built, containerExitCode: 0, outputDirectory: root, releaseId: "release-1" },
        {
          writeReceipt: async () => true,
          removePreviousImage: async (candidate) => {
            removed.push(candidate.previousImage!);
          },
        },
      );
      expect(removed).toEqual([built.previousImage]);
      await expect(
        finalizeCapsuleRun(
          { built, containerExitCode: 0, outputDirectory: root, releaseId: "release-1" },
          {
            writeReceipt: async () => false,
            removePreviousImage: async () => {
              throw new Error("must not remove");
            },
          },
        ),
      ).rejects.toThrow(/invalid validation evidence/);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("rejects ordinary shells, GitHub identity, secrets, and an unpinned image", () => {
    expect(() => assertReleaseCapsuleEnvironment({})).toThrow(/release-operator context/);
    expect(() =>
      assertReleaseCapsuleEnvironment({
        SHOPPP_RELEASE_OPERATOR_CONTEXT: "approved",
        GITHUB_ACTIONS: "true",
      }),
    ).toThrow(/GitHub environment/);
    expect(() =>
      assertReleaseCapsuleEnvironment({
        SHOPPP_RELEASE_OPERATOR_CONTEXT: "approved",
        CLOUDFLARE_API_TOKEN: "secret",
      }),
    ).toThrow(/credential/);
    expect(() =>
      capsuleRunArguments({
        image: "shoppp-release-capsule:latest",
        outputDirectory: "/tmp/output",
        releaseId: "release-123",
      }),
    ).toThrow(/digest-pinned/);
  });
});
