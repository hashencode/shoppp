import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
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
import {
  canonicalStorefrontJson,
  sameStorefrontPublicationIdentity,
  storefrontReleaseMarkerSchema,
} from "@shoppp/contracts";
import { experienceBuildInputSchema } from "./experience-build-input";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, ".output/public");
const previewBuild = process.env.STOREFRONT_BUILD_MODE === "preview";
const publicBuild = process.env.STOREFRONT_BUILD_MODE === "public";
const themedBuild = previewBuild || publicBuild;

async function outputFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await outputFiles(path)));
    else if (entry.isFile()) files.push(relative(output, path).split(sep).join("/"));
  }
  return files;
}

if (themedBuild) {
  if (!activeExperienceSnapshot || activeThemeId === "production-fallback") {
    throw new Error("Themed output must use one immutable experience snapshot.");
  }
  if (
    publicBuild &&
    (activeExperienceSnapshot.kind !== "approved" || activeExperienceProviderInput.mode !== "live")
  ) {
    throw new Error("Public output requires the approved live snapshot.");
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
  experience: themedBuild
    ? {
        catalogRelease:
          activeExperienceProviderInput.mode === "live"
            ? activeExperienceProviderInput.release
            : undefined,
        environment: publicBuild ? "public" : "preview",
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
  if (!themedBuild && route.startsWith("/products/")) {
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

if (themedBuild && activeThemeId === "fashion-store") {
  const homeHtml = await readFile(outputPath("/"), "utf8");
  const firstRenderCss = (
    await Promise.all(
      linkedStylesheets(homeHtml).map((href) => readFile(resolve(output, href.slice(1)), "utf8")),
    )
  ).join("\n");
  if (!firstRenderCss.includes("[data-fashion-store-product-card]")) {
    throw new Error(
      "Fashion Store output must link its selected-theme CSS in the initial document.",
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

if (publicBuild) {
  const marker = storefrontReleaseMarkerSchema.parse(
    JSON.parse(await readFile(resolve(output, "__shoppp-release.json"), "utf8")),
  );
  const input = experienceBuildInputSchema.parse(
    JSON.parse(await readFile(resolve(process.env.STOREFRONT_EXPERIENCE_FILE ?? ""), "utf8")),
  );
  const retainedCatalog = await readFile(resolve(output, "__shoppp-catalog.json"), "utf8");
  if (
    input.environment !== "public" ||
    retainedCatalog !== input.catalogManifestJson ||
    !sameStorefrontPublicationIdentity(marker.identity, input.inputIdentity) ||
    marker.sourceEnvironment !== input.sourceEnvironment ||
    createHash("sha256").update(canonicalStorefrontJson(activeExperienceSnapshot)).digest("hex") !==
      marker.identity.snapshotDigest ||
    marker.identity.experienceSnapshotId !== activeExperienceSnapshot?.id ||
    marker.identity.catalogReleaseId !== manifest.releaseId
  ) {
    throw new Error("Public output marker does not match its compiled Catalog and Snapshot.");
  }
  for (const route of pageRoutes.filter(
    (route) =>
      !productionPlatformRoutes.includes(route as (typeof productionPlatformRoutes)[number]) &&
      !["/wishlist", "/account"].includes(route),
  )) {
    const html = await readFile(outputPath(route), "utf8");
    if (
      /<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/.test(html) ||
      /Private preview|Preview only|__preview\//i.test(html)
    ) {
      throw new Error(`${route} public output contains private Preview presentation.`);
    }
  }
}

console.log(
  themedBuild
    ? `Static ${publicBuild ? "public storefront" : "preview"} verification passed for ${activeThemeId} snapshot ${activeExperienceSnapshot?.id}.`
    : `Static SEO verification passed for ${manifest.routes.length} indexable routes and ${productionPlatformRoutes.length} private commerce shells.`,
);
