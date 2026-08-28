import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("theme fidelity matrix capture orchestration", () => {
  test("requires and forwards the build artifact digest to every regional capture", async () => {
    const source = await readFile(
      resolve(import.meta.dir, "capture-theme-fidelity-matrix.ts"),
      "utf8",
    );
    expect(source).toContain('argumentValue(arguments_, "--artifact-digest")');
    expect(source).toContain("`--artifact-digest=${artifactDigest}`");
    expect(source).toContain("!artifactDigest");
  });
});
