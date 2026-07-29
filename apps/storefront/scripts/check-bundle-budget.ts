import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import manifest from "../app/generated/route-manifest.json";

const output = resolve(import.meta.dir, "../.output/public");
const representativeRoutes = [
  "/",
  manifest.routes.find((route) => route.startsWith("/collections/")),
  manifest.routes.find((route) => route.startsWith("/products/")),
].filter((route): route is string => Boolean(route));
const outputPath = (route: string) =>
  route === "/" ? resolve(output, "index.html") : resolve(output, route.slice(1), "index.html");
const budget = 200 * 1024;

for (const route of representativeRoutes) {
  const html = await readFile(outputPath(route), "utf8");
  const assets = new Set(
    [...html.matchAll(/(?:href|src)="(\/_nuxt\/[^"]+\.js)"/g)].map((match) => match[1]!),
  );
  if (assets.size === 0)
    throw new Error(`${route} did not reference an initial JavaScript bundle.`);
  let totalGzip = 0;
  for (const asset of assets) {
    totalGzip += gzipSync(await readFile(resolve(output, asset.slice(1)))).byteLength;
  }
  if (totalGzip > budget) {
    throw new Error(`${route} initial JavaScript ${totalGzip} bytes gzip exceeds ${budget}.`);
  }
  console.log(`${route} initial JavaScript budget passed: ${totalGzip} / ${budget} bytes gzip.`);
}
