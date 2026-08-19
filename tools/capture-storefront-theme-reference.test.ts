import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  referenceCaptureConfigs,
  referenceCaptureViewports,
  resolveReferenceCaptureConfig,
  validateIndependentReferenceSource,
  validateReferenceSource,
} from "./capture-storefront-theme-reference";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture(themeId: "decor" | "fashion-store-source"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-reference-capture-"));
  roots.push(root);
  const config = referenceCaptureConfigs[themeId];
  await mkdir(dirname(join(root, config.firstHero)), { recursive: true });
  await writeFile(join(root, config.firstHero), "fixture");
  await writeFile(join(root, config.entry), `<img src="${config.firstHero}" alt="">`);
  return root;
}

describe("reference source validation", () => {
  test("keeps the Fashion Store source identity distinct from Fashion Store", () => {
    expect(resolveReferenceCaptureConfig("fashion-store-source")).toMatchObject({
      entry: "demo-fashion-store.html",
      themeId: "fashion-store-source",
    });
    expect(() => resolveReferenceCaptureConfig("fashion")).toThrow("Unsupported reference theme");
    expect(() => resolveReferenceCaptureConfig("fashion-store")).toThrow("implementation identity");
  });
  test("captures every approved fidelity width with stable viewport identities", () => {
    expect(referenceCaptureViewports).toEqual([
      { height: 1000, id: "desktop", width: 1440 },
      { height: 900, id: "laptop", width: 1024 },
      { height: 1024, id: "tablet", width: 768 },
      { height: 844, id: "mobile", width: 390 },
    ]);
  });

  test.each(["fashion-store-source", "decor"] as const)(
    "accepts the approved %s entry and first hero",
    async (themeId) => {
      const root = await fixture(themeId);
      await expect(
        validateReferenceSource(root, referenceCaptureConfigs[themeId]),
      ).resolves.toEqual({
        entryPath: join(root, referenceCaptureConfigs[themeId].entry),
        heroPath: join(root, referenceCaptureConfigs[themeId].firstHero),
      });
    },
  );

  test("fails clearly when the entry point, first hero, or expected reference is missing", async () => {
    const root = await fixture("fashion-store-source");
    const config = referenceCaptureConfigs["fashion-store-source"];
    await rm(join(root, config.firstHero));
    await expect(validateReferenceSource(root, config)).rejects.toThrow(
      "expected first hero is missing",
    );

    await writeFile(join(root, config.firstHero), "fixture");
    await writeFile(join(root, config.entry), "<main>wrong hero</main>");
    await expect(validateReferenceSource(root, config)).rejects.toThrow("does not reference");

    await rm(join(root, config.entry));
    await expect(validateReferenceSource(root, config)).rejects.toThrow(
      "HTML entry point is missing",
    );
  });

  test("rejects an implementation-owned reference root and a mismatched source digest", async () => {
    const sourceRoot = await fixture("fashion-store-source");
    const config = referenceCaptureConfigs["fashion-store-source"];
    const entry = await Bun.file(join(sourceRoot, config.entry)).arrayBuffer();
    const digest = new Bun.CryptoHasher("sha256").update(entry).digest("hex");

    await expect(
      validateIndependentReferenceSource({
        config,
        expectedEntrySha256: digest,
        implementationThemeRoot: join(sourceRoot, "implementation"),
        sourceRoot,
      }),
    ).resolves.toMatchObject({ entrySha256: digest, sourceRoot });

    await expect(
      validateIndependentReferenceSource({
        config,
        expectedEntrySha256: digest,
        implementationThemeRoot: sourceRoot,
        sourceRoot,
      }),
    ).rejects.toThrow("must not be served from the implementation theme directory");

    await expect(
      validateIndependentReferenceSource({
        config,
        expectedEntrySha256: "0".repeat(64),
        implementationThemeRoot: join(sourceRoot, "implementation"),
        sourceRoot,
      }),
    ).rejects.toThrow("digest mismatch");
  });
});
