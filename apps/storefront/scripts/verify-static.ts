import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { activeExperienceSnapshot, activeThemeId } from "../app/generated/active-theme";
import manifest from "../app/generated/route-manifest.json";
import verificationCatalog from "../app/generated/verification-catalog.json";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, ".output/public");
const previewBuild = process.env.STOREFRONT_BUILD_MODE === "preview";

async function outputFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await outputFiles(path)));
    else if (entry.isFile()) files.push(relative(output, path).split(sep).join("/"));
  }
  return files;
}

if (previewBuild) {
  if (!activeExperienceSnapshot || activeThemeId === "production-fallback") {
    throw new Error("Preview output must use one immutable experience snapshot.");
  }
} else if (activeExperienceSnapshot || activeThemeId !== "production-fallback") {
  throw new Error("Production output must retain the unchanged storefront fallback.");
}

const outputPath = (route: string) =>
  route === "/" ? resolve(output, "index.html") : resolve(output, route.slice(1), "index.html");

for (const route of manifest.routes) {
  const html = await readFile(outputPath(route), "utf8");
  if (!html.includes('<link rel="canonical"') || !html.includes("<h1")) {
    throw new Error(`${route} is missing canonical metadata or meaningful static content.`);
  }
  if (previewBuild && !/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html)) {
    throw new Error(`${route} preview HTML must be non-indexable.`);
  }
  if (!previewBuild && route.startsWith("/products/")) {
    const product = verificationCatalog.products.find(
      (item) => item.slug === route.slice("/products/".length),
    );
    if (!product) throw new Error(`${route} has no generated product verification record.`);
    for (const required of [
      "application/ld+json",
      product.name,
      `width="${product.width}"`,
      `height="${product.height}"`,
      product.collectionName ?? product.name,
    ]) {
      if (!html.includes(required)) throw new Error(`${route} static HTML is missing ${required}.`);
    }
  }
}

for (const route of ["/cart", "/checkout", "/checkout/complete", "/orders/access"]) {
  const html = await readFile(outputPath(route), "utf8");
  if (!/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html)) {
    throw new Error(`${route} must be a deployable, non-indexable static commerce shell.`);
  }
}

for (const file of ["404.html", "robots.txt", "sitemap.xml", "_redirects"]) {
  await stat(resolve(output, file));
}

const redirects = await readFile(resolve(output, "_redirects"), "utf8");
if (redirects.includes("/orders/*")) {
  throw new Error(
    "Opaque order routes must use the Worker asset fallback, not a wildcard redirect.",
  );
}

const fallback = await readFile(resolve(output, "404.html"), "utf8");
if (!fallback.includes("Page not found")) throw new Error("404 output is not human readable.");
try {
  await stat(resolve(output, "200.html"));
  throw new Error("Static output must not contain an SPA 200 fallback.");
} catch (error) {
  if (error instanceof Error && !("code" in error && error.code === "ENOENT")) throw error;
}

const sitemapText = (
  await Promise.all(
    ["sitemap-products.xml", "sitemap-collections.xml", "sitemap-pages.xml"].map((name) =>
      readFile(resolve(output, name), "utf8"),
    ),
  )
).join("\n");
if (
  sitemapText.includes("/cart") ||
  sitemapText.includes("/checkout") ||
  sitemapText.includes("/orders/")
) {
  throw new Error("Private commerce routes must not appear in sitemaps.");
}

if (!previewBuild) {
  const files = await outputFiles(output);
  if (files.some((file) => /(?:^|\/)(?:preview|experience-preview)(?:\/|$)/i.test(file))) {
    throw new Error("Production output must not contain a preview route or artifact.");
  }
}

console.log(
  previewBuild
    ? `Static preview verification passed for ${activeThemeId} snapshot ${activeExperienceSnapshot?.id}.`
    : `Static SEO verification passed for ${manifest.routes.length} indexable routes and 4 private commerce shells.`,
);
