import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "../apps/storefront/node_modules/sharp";
import { fashionStoreComparisonDescriptor } from "../apps/storefront/e2e/support/theme-capture-contract";
import { generateThemeFidelityReport } from "./theme-fidelity-report";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))),
);

async function png(path: string, width: number, height: number, background = "#ffffff") {
  await sharp({ create: { background, channels: 4, height, width } })
    .png()
    .toFile(path);
}

async function captureRoot(
  themeId: "fashion-store-source" | "decor" | "fashion-store",
  width = 1440,
  desktopViewportHeight = 1000,
  dpr = 1,
  capturedAt = new Date().toISOString(),
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-fidelity-"));
  roots.push(root);
  await mkdir(join(root, themeId), { recursive: true });
  await Promise.all([
    png(join(root, themeId, "desktop.png"), width, 1000),
    png(join(root, themeId, "laptop.png"), 1024, 900),
    png(join(root, themeId, "tablet.png"), 768, 1024),
    png(join(root, themeId, "mobile.png"), 390, 844),
  ]);
  await writeFile(
    join(root, themeId, "metadata.json"),
    JSON.stringify({
      captureMode: "static",
      capturedAt,
      commit: "abcdef1234567",
      state: "initial-home",
      themeId,
      viewports: [
        { dpr, height: desktopViewportHeight, id: "desktop", width: 1440 },
        { dpr, height: 900, id: "laptop", width: 1024 },
        { dpr, height: 1024, id: "tablet", width: 768 },
        { dpr, height: 844, id: "mobile", width: 390 },
      ],
    }),
  );
  return root;
}

describe("theme fidelity report", () => {
  test("retains over-threshold Fashion Store pixel evidence and rejects stale identity", async () => {
    const referenceRoot = await captureRoot("fashion-store-source");
    const implementationRoot = await captureRoot("fashion-store");
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    await png(join(implementationRoot, "fashion-store", "mobile.png"), 390, 844, "#000000");

    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        comparison: fashionStoreComparisonDescriptor,
        implementationRoot,
        outputRoot,
        referenceRoot,
      }),
    ).rejects.toThrow("fashion-store-source-to-fashion-store mobile");
    expect(
      await readFile(
        join(outputRoot, "fashion-store-source-to-fashion-store-mobile-diff.json"),
        "utf8",
      ),
    ).toContain('"changedPixelRatio": 1');

    const staleMetadata = JSON.parse(
      await readFile(join(implementationRoot, "fashion-store", "metadata.json"), "utf8"),
    ) as Record<string, unknown>;
    staleMetadata.commit = "deadbee";
    await writeFile(
      join(implementationRoot, "fashion-store", "metadata.json"),
      JSON.stringify(staleMetadata),
    );
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        comparison: fashionStoreComparisonDescriptor,
        implementationRoot,
        outputRoot,
        referenceRoot,
      }),
    ).rejects.toThrow("does not match commit");
  });

  test("rejects mismatched DPR and stale Fashion Store Source-to-Fashion Store captures", async () => {
    const referenceRoot = await captureRoot("fashion-store-source");
    const implementationRoot = await captureRoot("fashion-store", 1440, 1000, 2);
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);

    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        comparison: fashionStoreComparisonDescriptor,
        implementationRoot,
        outputRoot,
        referenceRoot,
      }),
    ).rejects.toThrow("viewport or DPR");

    const staleReferenceRoot = await captureRoot(
      "fashion-store-source",
      1440,
      1000,
      1,
      "2020-01-01T00:00:00.000Z",
    );
    const matchingImplementationRoot = await captureRoot("fashion-store");
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        comparison: fashionStoreComparisonDescriptor,
        implementationRoot: matchingImplementationRoot,
        outputRoot,
        referenceRoot: staleReferenceRoot,
      }),
    ).rejects.toThrow("reference capture is stale");
  });

  test("does not accept temporal-only evidence as the initial static report", async () => {
    const referenceRoot = await captureRoot("fashion-store-source");
    const implementationRoot = await captureRoot("fashion-store");
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    const path = join(implementationRoot, "fashion-store", "metadata.json");
    const metadata = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    metadata.captureMode = "temporal";
    await writeFile(path, JSON.stringify(metadata));

    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        comparison: fashionStoreComparisonDescriptor,
        implementationRoot,
        outputRoot,
        referenceRoot,
      }),
    ).rejects.toThrow(/requires static capture mode/);
  });

  test("creates review evidence without blessing an unapproved implementation", async () => {
    const referenceRoot = await captureRoot("decor");
    const implementationRoot = await captureRoot("decor");
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    const report = await generateThemeFidelityReport({
      commit: "abcdef1234567",
      implementationRoot,
      outputRoot,
      referenceRoot,
      themes: ["decor"],
    });
    const contents = await readFile(report, "utf8");
    await writeFile(join(outputRoot, "approval.json"), '{"commit":"stale"}\n');
    expect(contents).toContain("does not imply approval");
    expect(contents.match(/<section>/g)).toHaveLength(4);
    expect(contents).toContain("decor · laptop");
    expect(contents).toContain("decor · tablet");
    expect(contents).toContain("changed pixels <strong>0.000%</strong>");
    expect(await readFile(join(outputRoot, "decor-desktop-diff.json"), "utf8")).toContain(
      '"changedPixelRatio": 0',
    );
    await generateThemeFidelityReport({
      commit: "abcdef1234567",
      implementationRoot,
      outputRoot,
      referenceRoot,
      themes: ["decor"],
    });
    await expect(readFile(join(outputRoot, "approval.json"))).rejects.toThrow();
  });

  test("requires the explicit comparison descriptor for Fashion Store", async () => {
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot: "/tmp/implementation",
        outputRoot: "/tmp/output",
        referenceRoot: "/tmp/reference",
        themes: ["fashion-store" as never],
      }),
    ).rejects.toThrow(/comparison descriptor/);
  });

  test("fails above the full-page threshold and retains actionable diff artifacts", async () => {
    const referenceRoot = await captureRoot("decor");
    const implementationRoot = await captureRoot("decor");
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    await png(join(implementationRoot, "decor", "desktop.png"), 1440, 1000, "#000000");

    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot,
        outputRoot,
        referenceRoot,
        themes: ["decor"],
      }),
    ).rejects.toThrow("decor desktop");
    expect(await readFile(join(outputRoot, "index.html"), "utf8")).toContain("100.000%");
    expect(await readFile(join(outputRoot, "decor-desktop-diff.json"), "utf8")).toContain(
      '"changedPixelRatio": 1',
    );
    expect((await readFile(join(outputRoot, "decor-desktop-diff.png"))).byteLength).toBeGreaterThan(
      0,
    );
  });

  test("refuses missing, wrong-theme, or dimension-mismatched evidence", async () => {
    const referenceRoot = await captureRoot("decor");
    const implementationRoot = await captureRoot("decor", 1200);
    const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-fidelity-output-"));
    roots.push(outputRoot);
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot,
        outputRoot,
        referenceRoot,
        themes: ["decor"],
      }),
    ).rejects.toThrow("dimensions");
    const wrongHeightRoot = await captureRoot("decor", 1440, 900);
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot: wrongHeightRoot,
        outputRoot,
        referenceRoot,
        themes: ["decor"],
      }),
    ).rejects.toThrow("dimensions");
    await writeFile(
      join(implementationRoot, "decor", "metadata.json"),
      JSON.stringify({
        capturedAt: "2026-07-30T00:00:00.000Z",
        themeId: "fashion-store-source",
        viewports: [],
      }),
    );
    await expect(
      generateThemeFidelityReport({
        commit: "abcdef1234567",
        implementationRoot,
        outputRoot,
        referenceRoot,
        themes: ["decor"],
      }),
    ).rejects.toThrow("wrong theme");
  });
});
