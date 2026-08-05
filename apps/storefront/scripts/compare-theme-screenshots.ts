import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

export interface ScreenshotDifference {
  channelTolerance: number;
  changedPixelRatio: number;
  changedPixels: number;
  diagnosticArtifacts: {
    crops: Array<{
      bounds: DifferenceBounds;
      implementationPath: string;
      rank: number;
      referencePath: string;
    }>;
    differencePath?: string;
    heatmapPath?: string;
  };
  diffBounds: DifferenceBounds | null;
  dimensionsMatch: boolean;
  heightDelta: number;
  implementation: { height: number; width: number };
  meanChannelDelta: number;
  reference: { height: number; width: number };
  totalPixels: number;
  widthDelta: number;
  rankedRegions: DifferenceRegion[];
}

export interface DifferenceBounds {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface DifferenceRegion {
  bounds: DifferenceBounds;
  changedPixelRatio: number;
  changedPixels: number;
  rank: number;
  totalPixels: number;
}

export interface ScreenshotDiagnosticOptions {
  cropsDirectory?: string;
  emitWhenChangedPixelRatioExceeds?: number;
  heatmapPath?: string;
  maximumCrops?: number;
  regionHeight?: number;
  regionWidth?: number;
}

export function assertThemeScreenshotDifference(
  result: ScreenshotDifference,
  maxChangedPixelRatio = 0.01,
): void {
  if (
    !Number.isFinite(maxChangedPixelRatio) ||
    maxChangedPixelRatio < 0 ||
    maxChangedPixelRatio > 1
  ) {
    throw new Error(
      `Screenshot acceptance ratio must be a number between 0 and 1; received ${maxChangedPixelRatio}.`,
    );
  }
  if (!result.dimensionsMatch) {
    throw new Error(
      `Screenshot dimensions differ: reference ${result.reference.width}x${result.reference.height}, ` +
        `implementation ${result.implementation.width}x${result.implementation.height}.`,
    );
  }
  if (result.changedPixelRatio > maxChangedPixelRatio) {
    throw new Error(
      `Screenshot changed-pixel ratio ${(result.changedPixelRatio * 100).toFixed(3)}% exceeds ` +
        `${(maxChangedPixelRatio * 100).toFixed(3)}%.`,
    );
  }
}

export async function compareThemeScreenshots(
  referencePath: string,
  implementationPath: string,
  differencePath?: string,
  channelTolerance = 16,
  diagnosticOptions: ScreenshotDiagnosticOptions = {},
): Promise<ScreenshotDifference> {
  const reference = await sharp(referencePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const implementation = await sharp(implementationPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const dimensionsMatch =
    reference.info.width === implementation.info.width &&
    reference.info.height === implementation.info.height;
  const result: ScreenshotDifference = {
    channelTolerance,
    changedPixelRatio: dimensionsMatch ? 0 : 1,
    changedPixels: 0,
    diagnosticArtifacts: { crops: [], ...(differencePath ? { differencePath } : {}) },
    diffBounds: null,
    dimensionsMatch,
    heightDelta: implementation.info.height - reference.info.height,
    implementation: {
      height: implementation.info.height,
      width: implementation.info.width,
    },
    meanChannelDelta: dimensionsMatch ? 0 : 255,
    reference: { height: reference.info.height, width: reference.info.width },
    totalPixels: reference.info.width * reference.info.height,
    widthDelta: implementation.info.width - reference.info.width,
    rankedRegions: [],
  };
  if (!dimensionsMatch) {
    const width = Math.max(reference.info.width, implementation.info.width);
    const height = Math.max(reference.info.height, implementation.info.height);
    const bounds = { bottom: height, height, left: 0, right: width, top: 0, width };
    result.changedPixels = width * height;
    result.diffBounds = bounds;
    result.totalPixels = width * height;
    result.rankedRegions = [
      {
        bounds,
        changedPixelRatio: 1,
        changedPixels: result.changedPixels,
        rank: 1,
        totalPixels: result.totalPixels,
      },
    ];

    const diagnosticWrites: Promise<unknown>[] = [];
    if (differencePath) {
      await mkdir(dirname(differencePath), { recursive: true });
      diagnosticWrites.push(
        sharp({ create: { background: "#ff00ff", channels: 4, height, width } })
          .png()
          .toFile(differencePath),
      );
    }
    const diagnosticThreshold = diagnosticOptions.emitWhenChangedPixelRatioExceeds ?? 0;
    if (diagnosticOptions.heatmapPath && result.changedPixelRatio > diagnosticThreshold) {
      await mkdir(dirname(diagnosticOptions.heatmapPath), { recursive: true });
      diagnosticWrites.push(
        sharp({ create: { background: "#ff0000", channels: 4, height, width } })
          .png()
          .toFile(diagnosticOptions.heatmapPath),
      );
      result.diagnosticArtifacts.heatmapPath = diagnosticOptions.heatmapPath;
    }
    await Promise.all(diagnosticWrites);
    return result;
  }

  const diff = Buffer.alloc(reference.data.length);
  const heatmap = Buffer.alloc(reference.data.length);
  const regionWidth = Math.max(1, diagnosticOptions.regionWidth ?? 160);
  const regionHeight = Math.max(1, diagnosticOptions.regionHeight ?? 120);
  const regionColumns = Math.ceil(reference.info.width / regionWidth);
  const regionRows = Math.ceil(reference.info.height / regionHeight);
  const regionChangedPixels = new Uint32Array(regionColumns * regionRows);
  let minimumX = reference.info.width;
  let minimumY = reference.info.height;
  let maximumX = -1;
  let maximumY = -1;
  let channelDeltaTotal = 0;
  for (let pixel = 0; pixel < result.totalPixels; pixel += 1) {
    const offset = pixel * 4;
    let changed = false;
    let maximumChannelDelta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        reference.data[offset + channel]! - implementation.data[offset + channel]!,
      );
      channelDeltaTotal += delta;
      maximumChannelDelta = Math.max(maximumChannelDelta, delta);
      changed ||= delta > channelTolerance;
    }
    const x = pixel % reference.info.width;
    const y = Math.floor(pixel / reference.info.width);
    diff[offset] = changed ? 255 : implementation.data[offset]!;
    diff[offset + 1] = changed ? 0 : implementation.data[offset + 1]!;
    diff[offset + 2] = changed ? 255 : implementation.data[offset + 2]!;
    diff[offset + 3] = changed ? 255 : 80;
    heatmap[offset] = changed ? 255 : 0;
    heatmap[offset + 1] = changed ? Math.max(0, 255 - maximumChannelDelta) : 0;
    heatmap[offset + 2] = 0;
    heatmap[offset + 3] = changed ? 220 : 0;
    if (changed) {
      result.changedPixels += 1;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
      const regionIndex =
        Math.floor(y / regionHeight) * regionColumns + Math.floor(x / regionWidth);
      regionChangedPixels[regionIndex] = (regionChangedPixels[regionIndex] ?? 0) + 1;
    }
  }
  result.changedPixelRatio = result.changedPixels / result.totalPixels;
  result.meanChannelDelta = channelDeltaTotal / (result.totalPixels * 3);
  if (result.changedPixels > 0) {
    result.diffBounds = {
      bottom: maximumY + 1,
      height: maximumY - minimumY + 1,
      left: minimumX,
      right: maximumX + 1,
      top: minimumY,
      width: maximumX - minimumX + 1,
    };
  }
  result.rankedRegions = [...regionChangedPixels]
    .map((changedPixels, index): DifferenceRegion | null => {
      if (changedPixels === 0) return null;
      const column = index % regionColumns;
      const row = Math.floor(index / regionColumns);
      const left = column * regionWidth;
      const top = row * regionHeight;
      const right = Math.min(reference.info.width, left + regionWidth);
      const bottom = Math.min(reference.info.height, top + regionHeight);
      const totalPixels = (right - left) * (bottom - top);
      return {
        bounds: {
          bottom,
          height: bottom - top,
          left,
          right,
          top,
          width: right - left,
        },
        changedPixelRatio: changedPixels / totalPixels,
        changedPixels,
        rank: 0,
        totalPixels,
      };
    })
    .filter((region): region is DifferenceRegion => region !== null)
    .sort(
      (left, right) =>
        right.changedPixels - left.changedPixels ||
        right.changedPixelRatio - left.changedPixelRatio,
    )
    .slice(0, 8)
    .map((region, index) => ({ ...region, rank: index + 1 }));
  if (differencePath) {
    await mkdir(dirname(differencePath), { recursive: true });
    await sharp(diff, {
      raw: {
        channels: 4,
        height: reference.info.height,
        width: reference.info.width,
      },
    })
      .png()
      .toFile(differencePath);
  }
  const diagnosticThreshold = diagnosticOptions.emitWhenChangedPixelRatioExceeds ?? 0;
  if (result.changedPixelRatio > diagnosticThreshold) {
    if (diagnosticOptions.heatmapPath) {
      await mkdir(dirname(diagnosticOptions.heatmapPath), { recursive: true });
      await sharp(heatmap, {
        raw: {
          channels: 4,
          height: reference.info.height,
          width: reference.info.width,
        },
      })
        .png()
        .toFile(diagnosticOptions.heatmapPath);
      result.diagnosticArtifacts.heatmapPath = diagnosticOptions.heatmapPath;
    }
    if (diagnosticOptions.cropsDirectory) {
      await mkdir(diagnosticOptions.cropsDirectory, { recursive: true });
      const maximumCrops = Math.max(0, diagnosticOptions.maximumCrops ?? 3);
      for (const region of result.rankedRegions.slice(0, maximumCrops)) {
        const referenceCropPath = resolve(
          diagnosticOptions.cropsDirectory,
          `rank-${region.rank}-reference.png`,
        );
        const implementationCropPath = resolve(
          diagnosticOptions.cropsDirectory,
          `rank-${region.rank}-implementation.png`,
        );
        await Promise.all([
          sharp(referencePath).extract(region.bounds).png().toFile(referenceCropPath),
          sharp(implementationPath).extract(region.bounds).png().toFile(implementationCropPath),
        ]);
        result.diagnosticArtifacts.crops.push({
          bounds: region.bounds,
          implementationPath: implementationCropPath,
          rank: region.rank,
          referencePath: referenceCropPath,
        });
      }
    }
  }
  return result;
}

if (import.meta.main) {
  const [referencePath, implementationPath, differencePath, reportPath, maximumRatioInput] =
    process.argv.slice(2);
  if (!referencePath || !implementationPath) {
    throw new Error(
      "Usage: bun scripts/compare-theme-screenshots.ts <reference> <implementation> [diff.png] [report.json] [maximum-ratio]",
    );
  }
  const maximumRatio = maximumRatioInput === undefined ? 0.01 : Number(maximumRatioInput);
  const result = await compareThemeScreenshots(
    resolve(referencePath),
    resolve(implementationPath),
    differencePath ? resolve(differencePath) : undefined,
  );
  if (reportPath) {
    await mkdir(dirname(resolve(reportPath)), { recursive: true });
    await writeFile(resolve(reportPath), `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  assertThemeScreenshotDifference(result, maximumRatio);
}
