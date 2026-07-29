import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import manifest from "../app/generated/route-manifest.json";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, ".output/public");

const outputPath = (route: string) =>
  route === "/" ? resolve(output, "index.html") : resolve(output, route.slice(1), "index.html");

for (const route of manifest.routes) {
  const html = await readFile(outputPath(route), "utf8");
  if (!html.includes('<link rel="canonical"') || !html.includes("<h1")) {
    throw new Error(`${route} is missing canonical metadata or meaningful static content.`);
  }
  if (route.startsWith("/products/")) {
    for (const required of [
      "application/ld+json",
      "Atlas Carry-on",
      'width="1200"',
      'height="1200"',
      "Travel essentials",
    ]) {
      if (!html.includes(required)) throw new Error(`${route} static HTML is missing ${required}.`);
    }
  }
}

for (const file of ["404.html", "robots.txt", "sitemap.xml", "_redirects"]) {
  await stat(resolve(output, file));
}

const fallback = await readFile(resolve(output, "404.html"), "utf8");
if (!fallback.includes("Page not found")) throw new Error("404 output is not human readable.");
try {
  await stat(resolve(output, "200.html"));
  throw new Error("Static output must not contain an SPA 200 fallback.");
} catch (error) {
  if (error instanceof Error && !("code" in error && error.code === "ENOENT")) throw error;
}

console.log(`Static SEO verification passed for ${manifest.routes.length} routes.`);
