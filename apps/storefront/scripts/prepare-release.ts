import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type releaseFixture from "../fixtures/release.json";
import { format, resolveConfig } from "prettier";

type Release = typeof releaseFixture;

const root = resolve(import.meta.dir, "..");
const prettierConfig = await resolveConfig(root);
const sourceFile = process.env.NUXT_CATALOG_RELEASE_FILE
  ? resolve(process.env.NUXT_CATALOG_RELEASE_FILE)
  : resolve(root, "fixtures/release.json");

const release = process.env.NUXT_CATALOG_RELEASE_URL
  ? await fetch(process.env.NUXT_CATALOG_RELEASE_URL, {
      headers: process.env.NUXT_CATALOG_RELEASE_TOKEN
        ? { Authorization: `Bearer ${process.env.NUXT_CATALOG_RELEASE_TOKEN}` }
        : {},
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Catalog release fetch failed: ${response.status}`);
      return response.json() as Promise<Release>;
    })
  : (JSON.parse(await readFile(sourceFile, "utf8")) as Release);

const products = release.products.filter(
  (product) =>
    product.status === "published" &&
    product.variants.some((variant) => variant.status === "active"),
);
const collections = release.collections.filter((collection) => collection.status === "published");
const routes = [
  "/",
  ...collections.map((collection) => `/collections/${collection.slug}`),
  ...release.policies.map((policy) => `/policies/${policy.slug}`),
  ...products.map((product) => `/products/${product.slug}`),
].sort((left, right) => (left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right)));

if (new Set(routes).size !== routes.length) {
  throw new Error("Published storefront routes must be unique.");
}

const selected = { ...release, collections, products };
const routeManifest = {
  releaseId: release.releaseId,
  routes,
  redirects: release.redirects.map((redirect) => ({ ...redirect, status: 301 })),
};
const origin = release.site.origin.replace(/\/$/, "");
const xml = (values: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${values
    .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

await mkdir(resolve(root, "app/generated"), { recursive: true });
await mkdir(resolve(root, "public"), { recursive: true });
await writeFile(
  resolve(root, "app/generated/catalog.ts"),
  await format(`export const catalogRelease = ${JSON.stringify(selected)} as const\n`, {
    ...prettierConfig,
    parser: "typescript",
  }),
);
await writeFile(
  resolve(root, "app/generated/route-manifest.json"),
  `${JSON.stringify(routeManifest, null, 2)}\n`,
);
await writeFile(
  resolve(root, "public/sitemap-products.xml"),
  xml(products.map((product) => `/products/${product.slug}`)),
);
await writeFile(
  resolve(root, "public/sitemap-collections.xml"),
  xml(collections.map((collection) => `/collections/${collection.slug}`)),
);
await writeFile(
  resolve(root, "public/sitemap-pages.xml"),
  xml(["/", ...release.policies.map((policy) => `/policies/${policy.slug}`)]),
);
await writeFile(
  resolve(root, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    "sitemap-products.xml",
    "sitemap-collections.xml",
    "sitemap-pages.xml",
  ]
    .map((name) => `  <sitemap><loc>${origin}/${name}</loc></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`,
);
await writeFile(
  resolve(root, "public/robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /orders/\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  resolve(root, "public/_redirects"),
  `${[
    ...routeManifest.redirects.map(
      (redirect) => `${redirect.from} ${redirect.to} ${redirect.status}`,
    ),
    "/orders/* /orders/access/index.html 200",
  ].join("\n")}\n`,
);

console.log(`Prepared ${routes.length} static routes from ${release.releaseId}.`);
