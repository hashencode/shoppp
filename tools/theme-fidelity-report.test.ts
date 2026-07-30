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

async function captureRoot(
  themeId: "fashion" | "decor",
  width = 1440,
  desktopViewportHeight = 1000,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-fidelity-"));
  roots.push(root);
  await mkdir(join(root, themeId), { recursive: true });
  await writeFile(join(root, themeId, "desktop.png"), png(width, 1000));
  await writeFile(join(root, themeId, "laptop.png"), png(1024, 900));
  await writeFile(join(root, themeId, "tablet.png"), png(768, 1024));
  await writeFile(join(root, themeId, "mobile.png"), png(390, 844));
  await writeFile(
    join(root, themeId, "metadata.json"),
    JSON.stringify({
      capturedAt: "2026-07-30T00:00:00.000Z",
      commit: "abcdef1234567",
      state: "initial-home",
      themeId,
      viewports: [
        { height: desktopViewportHeight, id: "desktop", width: 1440 },
        { height: 900, id: "laptop", width: 1024 },
        { height: 1024, id: "tablet", width: 768 },
        { height: 844, id: "mobile", width: 390 },
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
    const contents = await readFile(report, "utf8");
    await writeFile(join(outputRoot, "approval.json"), '{"commit":"stale"}\n');
    expect(contents).toContain("does not imply approval");
    expect(contents.match(/<section>/g)).toHaveLength(4);
    expect(contents).toContain("fashion · laptop");
    expect(contents).toContain("fashion · tablet");
    await generateThemeFidelityReport({
      commit: "abcdef1234567",
      implementationRoot,
      outputRoot,
      referenceRoot,
      themes: ["fashion"],
    });
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
    const wrongHeightRoot = await captureRoot("fashion", 1440, 900);
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot: wrongHeightRoot,
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
