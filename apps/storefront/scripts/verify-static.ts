import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { activeExperienceSnapshot, activeThemeId } from "../app/generated/active-theme";
import { activeExperienceProviderInput } from "../app/generated/active-experience";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";
import manifest from "../app/generated/route-manifest.json";
import verificationCatalog from "../app/generated/verification-catalog.json";
import {
  productionPlatformRoutes,
  resolveStorefrontPrerenderRoutes,
} from "./resolve-prerender-routes";
import { assertStaticPageHtml } from "./static-page-verification";

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

function linkedStylesheets(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(([link]) => {
    if (!/\brel=["']stylesheet["']/i.test(link)) return [];
    const href = link.match(/\bhref=["'](\/_nuxt\/[^"']+\.css)["']/i)?.[1];
    return href ? [href] : [];
  });
}

const pageRoutes = resolveStorefrontPrerenderRoutes({
  experience: previewBuild
    ? {
        catalogRelease:
          activeExperienceProviderInput.mode === "live"
            ? activeExperienceProviderInput.release
            : undefined,
        environment: "preview",
        presentationMode: activeExperienceProviderInput.mode === "live" ? "live" : undefined,
        themeId: activeThemeId,
      }
    : undefined,
  previewBuild,
  productionRoutes: manifest.routes,
});
for (const route of pageRoutes) {
  const html = await readFile(outputPath(route), "utf8");
  assertStaticPageHtml({ html, previewBuild, route });
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

if (!previewBuild) {
  for (const route of productionPlatformRoutes) {
    const html = await readFile(outputPath(route), "utf8");
    if (!/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html)) {
      throw new Error(`${route} must be a deployable, non-indexable static commerce shell.`);
    }
  }
}

if (previewBuild && activeThemeId === "fashion-store") {
  const homeHtml = await readFile(outputPath("/"), "utf8");
  const firstRenderCss = (
    await Promise.all(
      linkedStylesheets(homeHtml).map((href) => readFile(resolve(output, href.slice(1)), "utf8")),
    )
  ).join("\n");
  if (!firstRenderCss.includes("[data-fashion-store-product-card]")) {
    throw new Error(
      "Fashion Store preview must link its selected-theme CSS in the initial document.",
    );
  }

  const enabledPaths = new Set(pageRoutes);
  for (const { path } of fashionStorePageContracts) {
    if (enabledPaths.has(path)) continue;
    try {
      await stat(outputPath(path));
      throw new Error(`Disabled Fashion Store route ${path} must not be prerendered.`);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }

  const checkoutComplete = await readFile(outputPath("/checkout/complete"), "utf8");
  if (
    !checkoutComplete.includes("Provider-verified status") ||
    !/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(checkoutComplete)
  ) {
    throw new Error(
      "Fashion Store preview must prerender the non-indexable checkout completion shell.",
    );
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
    : `Static SEO verification passed for ${manifest.routes.length} indexable routes and ${productionPlatformRoutes.length} private commerce shells.`,
);
