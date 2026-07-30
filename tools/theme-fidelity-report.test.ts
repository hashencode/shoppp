import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateThemeFidelityReport } from "./theme-fidelity-report";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))),
);

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

async function captureRoot(themeId: "fashion" | "decor", width = 1440): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-fidelity-"));
  roots.push(root);
  await mkdir(join(root, themeId), { recursive: true });
  await writeFile(join(root, themeId, "desktop.png"), png(width, 1000));
  await writeFile(join(root, themeId, "mobile.png"), png(412, 915));
  await writeFile(
    join(root, themeId, "metadata.json"),
    JSON.stringify({
      capturedAt: "2026-07-30T00:00:00.000Z",
      themeId,
      viewports: [
        { height: 1000, id: "desktop", width: 1440 },
        { height: 915, id: "mobile", width: 412 },
      ],
    }),
  );
  return root;
}

describe("theme fidelity report", () => {
  test("creates review evidence without blessing an unapproved implementation", async () => {
    const referenceRoot = await captureRoot("fashion");
    const implementationRoot = await captureRoot("fashion");
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    const report = await generateThemeFidelityReport({
      commit: "abcdef1234567",
      implementationRoot,
      outputRoot,
      referenceRoot,
      themes: ["fashion"],
    });
    expect(await readFile(report, "utf8")).toContain("does not imply approval");
    await expect(readFile(join(outputRoot, "approval.json"))).rejects.toThrow();
  });

  test("refuses missing, wrong-theme, or dimension-mismatched evidence", async () => {
    const referenceRoot = await captureRoot("fashion");
    const implementationRoot = await captureRoot("fashion", 1200);
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot,
        outputRoot,
        referenceRoot,
        themes: ["fashion"],
      }),
    ).rejects.toThrow("dimensions");
    await writeFile(
      join(implementationRoot, "fashion", "metadata.json"),
      JSON.stringify({
        capturedAt: "2026-07-30T00:00:00.000Z",
        themeId: "decor",
        viewports: [],
      }),
    );
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot,
        outputRoot,
        referenceRoot,
        themes: ["fashion"],
      }),
    ).rejects.toThrow("wrong theme");
  });
});
