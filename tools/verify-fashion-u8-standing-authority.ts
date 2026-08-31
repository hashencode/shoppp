import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  FASHION_U8_SECURITY_SENSITIVE_PATHS,
  verifyFashionU8HarnessManifest,
  type FashionU8HarnessManifest,
} from "./create-fashion-u8-harness-manifest";

const execute = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;

export const FASHION_U8_NON_EXECUTABLE_TAIL_PATHS = [
  "docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md",
  "docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md",
  "docs/progress/fashion-store-u8-acceptance.md",
  "docs/runbooks/storefront-theme-testing.md",
] as const;

export interface FashionU8StandingAuthorityDependencies {
  candidateIsAncestor: boolean;
  changedPaths: readonly string[];
  dirtyPaths: readonly string[];
  headSha: string;
  read(path: string): Promise<Uint8Array>;
}

function samePaths(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((path, index) => path === sortedExpected[index]);
}

export async function verifyFashionU8StandingAuthority(
  manifest: FashionU8HarnessManifest,
  dependencies: FashionU8StandingAuthorityDependencies,
): Promise<FashionU8HarnessManifest> {
  if (!SHA.test(dependencies.headSha) || dependencies.headSha !== manifest.harnessSha) {
    throw new Error("checkout HEAD does not match the frozen U8 harness SHA");
  }
  if (!dependencies.candidateIsAncestor) {
    throw new Error("the frozen U12 candidate is not an ancestor of the U8 harness");
  }
  if (
    !samePaths(
      manifest.files.map(({ path }) => path),
      FASHION_U8_SECURITY_SENSITIVE_PATHS,
    )
  ) {
    throw new Error("harness manifest does not contain the canonical security-sensitive path set");
  }
  const allowed = new Set<string>([
    ...FASHION_U8_SECURITY_SENSITIVE_PATHS,
    ...FASHION_U8_NON_EXECUTABLE_TAIL_PATHS,
  ]);
  const unauthorized = dependencies.changedPaths.filter((path) => !allowed.has(path));
  if (unauthorized.length > 0) {
    throw new Error(`candidate-content drift is not authorized: ${unauthorized.join(", ")}`);
  }
  const dirtySensitive = dependencies.dirtyPaths.filter((path) =>
    (FASHION_U8_SECURITY_SENSITIVE_PATHS as readonly string[]).includes(path),
  );
  if (dirtySensitive.length > 0) {
    throw new Error(`security-sensitive harness files are dirty: ${dirtySensitive.join(", ")}`);
  }
  return verifyFashionU8HarnessManifest(manifest, dependencies.read);
}

async function runCli(): Promise<void> {
  const manifestPath = process.argv[2];
  if (!manifestPath)
    throw new Error("Use: bun tools/verify-fashion-u8-standing-authority.ts <manifest.json>");
  const root = resolve(import.meta.dir, "..");
  const manifest = JSON.parse(
    await readFile(resolve(root, manifestPath), "utf8"),
  ) as FashionU8HarnessManifest;
  const ancestor = execute(
    "git",
    ["merge-base", "--is-ancestor", manifest.candidateSha, manifest.harnessSha],
    { cwd: root },
  ).then(
    () => true,
    () => false,
  );
  const [candidateIsAncestor, { stdout: head }, { stdout: changed }, { stdout: dirty }] =
    await Promise.all([
      ancestor,
      execute("git", ["rev-parse", "HEAD"], { cwd: root }),
      execute("git", ["diff", "--name-only", `${manifest.candidateSha}..${manifest.harnessSha}`], {
        cwd: root,
      }),
      execute(
        "git",
        [
          "diff",
          "--name-only",
          "--no-ext-diff",
          "HEAD",
          "--",
          ...FASHION_U8_SECURITY_SENSITIVE_PATHS,
        ],
        { cwd: root },
      ),
    ]);
  const verified = await verifyFashionU8StandingAuthority(manifest, {
    candidateIsAncestor,
    changedPaths: changed.trim().split("\n").filter(Boolean),
    dirtyPaths: dirty.trim().split("\n").filter(Boolean),
    headSha: head.trim(),
    read: (path) => readFile(resolve(root, path)),
  });
  process.stdout.write(
    `${JSON.stringify({
      candidateSha: verified.candidateSha,
      contractTestDigest: verified.contractTestDigest,
      harnessSha: verified.harnessSha,
      passed: true,
    })}\n`,
  );
}

if (import.meta.main) {
  try {
    await runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Fashion U8 standing authority failed: ${message}\n`);
    process.exitCode = 1;
  }
}
