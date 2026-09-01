import { describe, expect, test } from "bun:test";

import {
  createFashionU8HarnessManifest,
  FASHION_U8_SECURITY_SENSITIVE_PATHS,
  verifyFashionU8HarnessManifest,
} from "./create-fashion-u8-harness-manifest";

describe("Fashion U8 frozen harness manifest", () => {
  test("freezes the exact-main U12 readiness refresh workflow", () => {
    expect(FASHION_U8_SECURITY_SENSITIVE_PATHS).toContain(
      ".github/workflows/prepare-fashion-staging-u12.yml",
    );
    expect(FASHION_U8_SECURITY_SENSITIVE_PATHS).toContain(".github/workflows/post-commit-ci.yml");
    expect(FASHION_U8_SECURITY_SENSITIVE_PATHS).toContain(
      "apps/api/src/storefront-experience/u8-acceptance.ts",
    );
    expect(FASHION_U8_SECURITY_SENSITIVE_PATHS).toContain(
      "packages/db/migrations/0023_fashion_u8_acceptance_runs.sql",
    );
  });

  test("sorts paths, hashes canonical contents, and detects self or file drift", async () => {
    const files = new Map([
      ["tools/verify-staging-latency.ts", "latency"],
      [".github/workflows/accept-fashion-staging-u8.yml", "workflow"],
    ]);
    const read = async (path: string) => new TextEncoder().encode(files.get(path)!);
    const manifest = await createFashionU8HarnessManifest(
      {
        candidateSha: "a".repeat(40),
        harnessSha: "b".repeat(40),
        paths: [...files.keys()],
      },
      read,
    );
    expect(manifest.files.map(({ path }) => path)).toEqual([...files.keys()].sort());
    await expect(verifyFashionU8HarnessManifest(manifest, read)).resolves.toEqual(manifest);
    files.set("tools/verify-staging-latency.ts", "drift");
    await expect(verifyFashionU8HarnessManifest(manifest, read)).rejects.toThrow(/digest mismatch/);
    await expect(
      createFashionU8HarnessManifest(
        {
          candidateSha: "a".repeat(40),
          harnessSha: "a".repeat(40),
          paths: [...files.keys()],
        },
        read,
      ),
    ).rejects.toThrow(/separate/);
  });
});
