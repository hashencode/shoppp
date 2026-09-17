import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { fashionStoreProductParityProfile } from "../app/themes/fashion-store/contracts/pages/product";
import { compareThemeScreenshots } from "./compare-theme-screenshots";

const evidenceRoot = resolve(import.meta.dir, "../test-results/fs-f11-u7/20260917T-final-feedback");
const repositoryRoot = resolve(import.meta.dir, "../../..");
const referenceRoot = resolve(
  repositoryRoot,
  "test-results/fs-f11-u1-vue-target/20260916T-current",
);
const captures = [
  {
    name: "desktop",
    reference: "source-vue-donor-1440x1000.png",
    implementation: "product-desktop.png",
  },
  {
    name: "mobile",
    reference: "source-vue-donor-390x844.png",
    implementation: "product-mobile.png",
  },
] as const;

await mkdir(evidenceRoot, { recursive: true });
const report = [];
for (const capture of captures) {
  const profile = fashionStoreProductParityProfile.viewports.find(({ viewport }) =>
    capture.name === "desktop" ? viewport.width === 1440 : viewport.width === 390,
  );
  if (!profile) throw new Error(`Missing ${capture.name} Product parity profile.`);
  if (profile.pixelMasks.length > 0) {
    throw new Error(
      `${capture.name} Product parity cannot hide text, controls, or layout with masks.`,
    );
  }

  const referencePath = resolve(referenceRoot, capture.reference);
  const implementationPath = resolve(evidenceRoot, capture.implementation);
  const referenceHash = createHash("sha256")
    .update(await readFile(referencePath))
    .digest("hex");
  if (referenceHash !== profile.screenshotSha256) {
    throw new Error(`${capture.name} historical Vue Product reference hash changed.`);
  }
  const [reference, implementation] = await Promise.all([
    sharp(referencePath).metadata(),
    sharp(implementationPath).metadata(),
  ]);
  if (
    reference.width !== profile.viewport.width ||
    implementation.width !== profile.viewport.width ||
    !reference.height ||
    !implementation.height ||
    reference.height < profile.viewport.height ||
    implementation.height < profile.viewport.height
  ) {
    throw new Error(`${capture.name} evidence does not match its retained viewport.`);
  }

  // White padding retains every source and implementation pixel, including unmatched page tails.
  // User-approved R21-R23 changes alter text, geometry, and imagery, so donor pixel thresholds
  // cannot independently declare this intentionally changed Product accepted.
  const alignedHeight = Math.max(reference.height, implementation.height);
  const alignedReferencePath = resolve(evidenceRoot, `aligned-${capture.name}-vue-donor.png`);
  const alignedImplementationPath = resolve(
    evidenceRoot,
    `aligned-${capture.name}-implementation.png`,
  );
  await Promise.all([
    sharp(referencePath)
      .extend({ bottom: alignedHeight - reference.height, background: "#fff" })
      .png()
      .toFile(alignedReferencePath),
    sharp(implementationPath)
      .extend({ bottom: alignedHeight - implementation.height, background: "#fff" })
      .png()
      .toFile(alignedImplementationPath),
  ]);
  const difference = await compareThemeScreenshots(
    alignedReferencePath,
    alignedImplementationPath,
    resolve(evidenceRoot, `unmasked-difference-${capture.name}.png`),
    16,
    { spatialTolerance: 1 },
  );
  report.push({
    changedPixelRatio: difference.changedPixelRatio,
    heightDelta: implementation.height - reference.height,
    historicalPixelLimit: fashionStoreProductParityProfile.capture.screenshotChangedPixelRatioMax,
    historicalPixelLimitMet:
      difference.changedPixelRatio <=
      fashionStoreProductParityProfile.capture.screenshotChangedPixelRatioMax,
    meanChannelDelta: difference.meanChannelDelta,
    name: capture.name,
    referenceSha256: referenceHash,
    viewportWidth: profile.viewport.width,
  });
}

const result = {
  status: "diagnostic-unmasked",
  source: "U1-frozen historical Vue Product",
  implementation: "FS-F11 Product with R21-R23 user corrections",
  report,
};
await writeFile(
  resolve(evidenceRoot, "unmasked-parity-report.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
