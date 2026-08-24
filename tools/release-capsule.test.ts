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
import { RELEASE_GATES } from "./release-validate";
import { trackedSourcePaths } from "./verify-static-output";
import {
  CAPSULE_PLATFORM,
  RELEASE_CAPSULE_MANIFEST,
  assertReleaseCapsuleEnvironment,
  capsuleRunArguments,
  classifyCapsuleResult,
  prepareCapsuleEvidenceDirectory,
  sourceTreeRevision,
} from "./release-capsule";

const dockerfile = readFile(
  resolve(import.meta.dir, "../containers/release-validation/Dockerfile"),
  "utf8",
);
const containerEntrypoint = readFile(
  resolve(import.meta.dir, "../containers/release-validation/run.sh"),
  "utf8",
);

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
      await writeFile(
        report,
        JSON.stringify({ schemaVersion: 1, releaseId: "release-1", status: "failed" }),
      );
      expect(
        await classifyCapsuleResult({
          containerExitCode: 1,
          releaseId: "release-1",
          reportPath: report,
        }),
      ).toEqual({ kind: "validation", reportValid: true });
      expect(
        await classifyCapsuleResult({
          containerExitCode: 69,
          releaseId: "release-1",
          reportPath: report,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });
      expect(
        await classifyCapsuleResult({
          containerExitCode: 0,
          releaseId: "release-1",
          reportPath: report,
        }),
      ).toEqual({ kind: "infrastructure", reportValid: false });
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test("binds receipts and retention to the immutable image result", async () => {
    const contents = await readFile(resolve(import.meta.dir, "release-capsule.ts"), "utf8");
    expect(contents).toContain("manifestDigest: toolchain.manifestDigest");
    expect(contents).toContain("if (passed) await removePreviousCapsuleImage(built)");
    expect(contents).not.toContain(
      'fileDigest(resolve(ROOT, "containers/release-validation/manifest.json"))',
    );
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
