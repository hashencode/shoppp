import { describe, expect, test } from "bun:test";

import {
  createCanonicalFashionU8HarnessManifest,
  FASHION_U8_SECURITY_SENSITIVE_PATHS,
} from "./create-fashion-u8-harness-manifest";
import { verifyFashionU8StandingAuthority } from "./verify-fashion-u8-standing-authority";
import {
  FASHION_U8_NON_EXECUTABLE_TAIL_PATHS,
  FASHION_U8_RETIRED_HARNESS_PATHS,
} from "./verify-fashion-u8-standing-authority";

const candidateSha = "a".repeat(40);
const harnessSha = "b".repeat(40);

describe("Fashion U8 standing authority", () => {
  test("requires the canonical frozen path set and rejects drift or dirty verifier state", async () => {
    const files = new Map<string, Uint8Array>(
      FASHION_U8_SECURITY_SENSITIVE_PATHS.map((path) => [path, new TextEncoder().encode(path)]),
    );
    const read = async (path: string) => files.get(path)!;
    const manifest = await createCanonicalFashionU8HarnessManifest(candidateSha, harnessSha, read);
    const dependencies = {
      candidateIsAncestor: true,
      changedPaths: [...FASHION_U8_SECURITY_SENSITIVE_PATHS],
      dirtyPaths: [] as string[],
      headSha: harnessSha,
      read,
    };

    await expect(verifyFashionU8StandingAuthority(manifest, dependencies)).resolves.toEqual(
      manifest,
    );
    await expect(
      verifyFashionU8StandingAuthority(manifest, {
        ...dependencies,
        changedPaths: [
          ...FASHION_U8_SECURITY_SENSITIVE_PATHS,
          ...FASHION_U8_NON_EXECUTABLE_TAIL_PATHS,
          ...FASHION_U8_RETIRED_HARNESS_PATHS,
        ],
      }),
    ).resolves.toEqual(manifest);
    await expect(
      verifyFashionU8StandingAuthority(manifest, {
        ...dependencies,
        changedPaths: [...dependencies.changedPaths, "apps/storefront/app/runtime.ts"],
      }),
    ).rejects.toThrow(/candidate-content drift/);
    await expect(
      verifyFashionU8StandingAuthority(manifest, {
        ...dependencies,
        dirtyPaths: ["tools/verify-fashion-u8-standing-authority.ts"],
      }),
    ).rejects.toThrow(/dirty/);
    await expect(
      verifyFashionU8StandingAuthority(
        { ...manifest, files: manifest.files.slice(1) },
        dependencies,
      ),
    ).rejects.toThrow(/canonical/);

    files.set("tools/verify-fashion-u8-standing-authority.ts", new TextEncoder().encode("drift"));
    await expect(verifyFashionU8StandingAuthority(manifest, dependencies)).rejects.toThrow(
      /digest mismatch/,
    );
  });
});
