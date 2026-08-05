import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../scripts/compare-theme-screenshots";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("theme screenshot comparison", () => {
  test("counts materially changed pixels and writes a difference image", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-theme-diff-"));
    directories.push(directory);
    const reference = join(directory, "reference.png");
    const implementation = join(directory, "implementation.png");
    const difference = join(directory, "difference.png");
    const heatmap = join(directory, "heatmap.png");
    const crops = join(directory, "crops");
    await sharp({
      create: { background: "#ffffff", channels: 4, height: 2, width: 2 },
    })
      .png()
      .toFile(reference);
    await sharp({
      create: { background: "#ffffff", channels: 4, height: 2, width: 2 },
    })
      .composite([
        { input: Buffer.from([0, 0, 0, 255]), raw: { channels: 4, height: 1, width: 1 } },
      ])
      .png()
      .toFile(implementation);

    const result = await compareThemeScreenshots(reference, implementation, difference, 16, {
      cropsDirectory: crops,
      emitWhenChangedPixelRatioExceeds: 0.1,
      heatmapPath: heatmap,
      maximumCrops: 1,
      regionHeight: 1,
      regionWidth: 1,
    });
    expect(result.dimensionsMatch).toBe(true);
    expect(result.changedPixels).toBe(1);
    expect(result.changedPixelRatio).toBe(0.25);
    expect(result.channelTolerance).toBe(16);
    expect(result.diffBounds).toEqual({
      bottom: 2,
      height: 1,
      left: 1,
      right: 2,
      top: 1,
      width: 1,
    });
    expect(result.rankedRegions).toHaveLength(1);
    expect(result.diagnosticArtifacts.crops).toHaveLength(1);
    await access(heatmap);
    await access(result.diagnosticArtifacts.crops[0]!.referencePath);
    expect((await sharp(difference).metadata()).width).toBe(2);
  });

  test("reports full mismatch when full-page dimensions differ", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-theme-diff-"));
    directories.push(directory);
    const reference = join(directory, "reference.png");
    const implementation = join(directory, "implementation.png");
    const difference = join(directory, "difference.png");
    const heatmap = join(directory, "heatmap.png");
    await sharp({ create: { background: "#fff", channels: 4, height: 2, width: 2 } })
      .png()
      .toFile(reference);
    await sharp({ create: { background: "#fff", channels: 4, height: 3, width: 2 } })
      .png()
      .toFile(implementation);

    const result = await compareThemeScreenshots(reference, implementation, difference, 16, {
      emitWhenChangedPixelRatioExceeds: 0.005,
      heatmapPath: heatmap,
    });
    expect(result).toMatchObject({
      changedPixelRatio: 1,
      dimensionsMatch: false,
      heightDelta: 1,
      widthDelta: 0,
    });
    expect(result.diffBounds).toEqual({
      bottom: 3,
      height: 3,
      left: 0,
      right: 2,
      top: 0,
      width: 2,
    });
    expect((await sharp(difference).metadata()).height).toBe(3);
    expect((await sharp(heatmap).metadata()).height).toBe(3);
    expect(() => assertThemeScreenshotDifference(result)).toThrow("dimensions differ");
  });

  test("enforces full-page and named-state acceptance ratios", () => {
    const result = {
      channelTolerance: 16,
      changedPixelRatio: 0.007,
      changedPixels: 7,
      diagnosticArtifacts: { crops: [] },
      diffBounds: null,
      dimensionsMatch: true,
      heightDelta: 0,
      implementation: { height: 10, width: 10 },
      meanChannelDelta: 1,
      reference: { height: 10, width: 10 },
      totalPixels: 100,
      widthDelta: 0,
      rankedRegions: [],
    };

    expect(() => assertThemeScreenshotDifference(result)).not.toThrow();
    expect(() => assertThemeScreenshotDifference(result, 0.005)).toThrow("0.700% exceeds 0.500%");
    expect(() => assertThemeScreenshotDifference(result, Number.NaN)).toThrow(
      "must be a number between 0 and 1",
    );
  });
});
