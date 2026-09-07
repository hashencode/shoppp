import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { assertThemeBehaviorContractComplete } from "../e2e/support/theme-behavior-contract";
import { decorBehaviorContract } from "../theme-references/decor/behavior-contract";
import { decorSourceContract, decorSourceRegions } from "../theme-references/decor/source-contract";
import { decorStoreBehaviorContract } from "../theme-references/decor-store/behavior-contract";
import {
  decorStoreSourceContract,
  decorStoreSourceRegions,
} from "../theme-references/decor-store/source-contract";

const repositoryRoot = resolve(import.meta.dir, "../../..");
const sourceEntry = resolve(
  repositoryRoot,
  "templates/Crafto - The Multipurpose HTML5 Template/html/demo-decor-store.html",
);

describe("retired Decor reference evidence", () => {
  test("retains the hash-pinned source independently of either runtime package", () => {
    expect(createHash("sha256").update(readFileSync(sourceEntry)).digest("hex")).toBe(
      "90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271",
    );
    expect(decorSourceContract.sources.html).toBe("demo-decor-store.html");
    expect(decorStoreSourceContract.sourceEntry).toBe("demo-decor-store.html");
  });

  test("keeps both behavior ledgers structurally verifiable", () => {
    expect(() =>
      assertThemeBehaviorContractComplete(
        decorBehaviorContract,
        decorSourceRegions.map(({ id }) => id),
      ),
    ).not.toThrow();
    expect(() =>
      assertThemeBehaviorContractComplete(
        decorStoreBehaviorContract,
        decorStoreSourceRegions.map(({ key }) => key),
      ),
    ).not.toThrow();
  });

  test("rejects a controlled missing-region defect", () => {
    expect(() => assertThemeBehaviorContractComplete(decorBehaviorContract, ["hero"])).toThrow(
      /unknown region/,
    );
  });

  test("keeps Fashion production sources out of the reference tree", () => {
    const fashionRoot = resolve(repositoryRoot, "apps/storefront/app/themes/fashion-store");
    const sourceFiles = Array.from(
      new Bun.Glob("**/*.{ts,vue,css}").scanSync({ cwd: fashionRoot, onlyFiles: true }),
    );
    for (const file of sourceFiles) {
      const source = readFileSync(resolve(fashionRoot, file), "utf8");
      expect(source, file).not.toMatch(/theme-references|themes\/decor(?:-store)?/);
    }
  });
});
