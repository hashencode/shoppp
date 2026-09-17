import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

import { fashionStoreProductParityProfile } from "../app/themes/fashion-store/contracts/pages/product";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "./compare-theme-screenshots";

const storefrontRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(storefrontRoot, "../..");
const evidenceRoot = resolve(storefrontRoot, "test-results/fs-f11-u7/20260916T-current");
const referenceRoot = resolve(
  repositoryRoot,
  "test-results/fs-f11-u1-vue-target/20260916T-current",
);

const captures = [
  {
    implementation: "implementation-desktop-1440x1000.png",
    name: "desktop",
    reference: "source-vue-donor-1440x1000.png",
  },
  {
    implementation: "implementation-mobile-390x844.png",
    name: "mobile",
    reference: "source-vue-donor-390x844.png",
  },
] as const;

await mkdir(evidenceRoot, { recursive: true });
const report = [];
for (const capture of captures) {
  const profile = fashionStoreProductParityProfile.viewports.find(({ viewport }) =>
    capture.name === "desktop" ? viewport.width === 1440 : viewport.width === 390,
  );
  if (!profile) throw new Error(`Missing ${capture.name} Product parity profile.`);

  const referencePath = resolve(referenceRoot, capture.reference);
  const implementationPath = resolve(evidenceRoot, capture.implementation);
  const maskedReferencePath = resolve(evidenceRoot, `masked-${capture.name}-reference.png`);
  const maskedImplementationPath = resolve(
    evidenceRoot,
    `masked-${capture.name}-implementation.png`,
  );
  const overlays = profile.pixelMasks.map(({ height, left, top, width }) => ({
    input: { create: { background: "#fff", channels: 4 as const, height, width } },
    left,
    top,
  }));
  await Promise.all([
    sharp(referencePath).composite(overlays).png().toFile(maskedReferencePath),
    sharp(implementationPath).composite(overlays).png().toFile(maskedImplementationPath),
  ]);
  const difference = await compareThemeScreenshots(
    maskedReferencePath,
    maskedImplementationPath,
    resolve(evidenceRoot, `masked-difference-${capture.name}.png`),
    16,
    { spatialTolerance: 1 },
  );
  assertThemeScreenshotDifference(
    difference,
    fashionStoreProductParityProfile.capture.screenshotChangedPixelRatioMax,
  );
  if (
    difference.meanChannelDelta >
    fashionStoreProductParityProfile.capture.screenshotMeanChannelDeltaMax
  ) {
    throw new Error(
      `${capture.name} mean channel delta ${difference.meanChannelDelta.toFixed(3)} exceeds ` +
        `${fashionStoreProductParityProfile.capture.screenshotMeanChannelDeltaMax}.`,
    );
  }
  report.push({
    changedPixelRatio: difference.changedPixelRatio,
    dimensionsMatch: difference.dimensionsMatch,
    meanChannelDelta: difference.meanChannelDelta,
    name: capture.name,
  });
}

await writeFile(resolve(evidenceRoot, "masked-parity-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
