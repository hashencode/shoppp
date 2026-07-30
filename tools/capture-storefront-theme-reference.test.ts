import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  referenceCaptureConfigs,
  validateReferenceSource,
} from "./capture-storefront-theme-reference";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture(themeId: "decor" | "fashion"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-reference-capture-"));
  roots.push(root);
  const config = referenceCaptureConfigs[themeId];
  await mkdir(dirname(join(root, config.firstHero)), { recursive: true });
  await writeFile(join(root, config.firstHero), "fixture");
  await writeFile(join(root, config.entry), `<img src="${config.firstHero}" alt="">`);
  return root;
}

describe("reference source validation", () => {
  test.each(["fashion", "decor"] as const)(
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
    const root = await fixture("fashion");
    const config = referenceCaptureConfigs.fashion;
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
});
