import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  type CanonicalCatalogRelease,
} from "@shoppp/contracts";
import { format, resolveConfig } from "prettier";
import { composeProductPageModel } from "../app/theme-engine/composer";
import { experienceBuildInputSchema } from "./experience-build-input";

function assertCanonicalCatalogRelease(input: unknown): asserts input is CanonicalCatalogRelease {
  const v3 = catalogReleaseV3Schema.safeParse(input);
  if (v3.success && v3.data.purpose === "private-preview") {
    throw new Error(
      "catalog_candidate_private: Private Preview candidates cannot be prepared for deployment.",
    );
  }
  canonicalCatalogReleaseSchema.parse(input);
}

const root = resolve(import.meta.dir, "..");
const prettierConfig = await resolveConfig(root);
const sourceFile = process.env.NUXT_CATALOG_RELEASE_FILE
  ? resolve(process.env.NUXT_CATALOG_RELEASE_FILE)
  : resolve(root, "fixtures/release.json");

const releaseSource = process.env.NUXT_CATALOG_RELEASE_URL
  ? await fetch(process.env.NUXT_CATALOG_RELEASE_URL, {
      headers: process.env.NUXT_CATALOG_RELEASE_TOKEN
        ? { Authorization: `Bearer ${process.env.NUXT_CATALOG_RELEASE_TOKEN}` }
        : {},
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Catalog release fetch failed: ${response.status}`);
      return response.json() as Promise<unknown>;
    })
  : (JSON.parse(await readFile(sourceFile, "utf8")) as unknown);
assertCanonicalCatalogRelease(releaseSource);
const release = releaseSource;
const experienceInput =
  process.env.STOREFRONT_BUILD_MODE === "preview" && process.env.STOREFRONT_EXPERIENCE_FILE
    ? experienceBuildInputSchema.parse(
        JSON.parse(await readFile(resolve(process.env.STOREFRONT_EXPERIENCE_FILE), "utf8")),
      )
    : undefined;
const experience =
  experienceInput &&
  experienceInput.environment === "preview" &&
  "presentationMode" in experienceInput &&
  experienceInput.presentationMode === "live"
    ? experienceInput.snapshot
    : undefined;

const products = release.products.filter(
  (product) =>
    product.status === "published" &&
    product.variants.some((variant) => variant.status === "active"),
);
const collections = release.collections.filter((collection) => collection.status === "published");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
for (const [kind, values] of [
  ["product", products],
  ["collection", collections],
] as const) {
  for (const value of values) {
    if (!slugPattern.test(value.slug)) {
      throw new Error(`Published ${kind} slug is unsafe: ${value.slug}`);
    }
  }
}
const routes = [
  "/",
  ...collections.map((collection) => `/collections/${collection.slug}`),
  ...release.policies.map((policy) => `/policies/${policy.slug}`),
  ...products.map((product) => `/products/${product.slug}`),
].sort((left, right) => (left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right)));

if (new Set(routes).size !== routes.length) {
  throw new Error("Published storefront routes must be unique.");
}

const selected = {
  releaseId: release.releaseId,
  site: release.site,
  collections: collections.map(({ name, slug }) => ({ name, slug })),
  policies: release.policies,
};
const collectionsBySlug = new Map(collections.map((collection) => [collection.slug, collection]));
const primaryCollection = (product: (typeof products)[number]) =>
  product.collectionSlugs
    .map((slug) => collectionsBySlug.get(slug))
    .find((collection) => collection !== undefined);
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

const generatedRoot = resolve(root, "app/generated");
const generatedProducts = resolve(generatedRoot, "products");
const generatedCollections = resolve(generatedRoot, "collections");
await rm(generatedProducts, { force: true, recursive: true });
await rm(generatedCollections, { force: true, recursive: true });
await mkdir(generatedProducts, { recursive: true });
await mkdir(generatedCollections, { recursive: true });
await mkdir(resolve(root, "public"), { recursive: true });
await writeFile(
  resolve(root, "app/generated/catalog.ts"),
  await format(`export const catalogRelease = ${JSON.stringify(selected)} as const\n`, {
    ...prettierConfig,
    parser: "typescript",
  }),
);
await writeFile(
  resolve(generatedRoot, "featured-products.ts"),
  await format(
    `import type { StorefrontProduct } from "../types/catalog-release"\n\nexport const featuredProducts = ${JSON.stringify(
      products.slice(0, 8),
    )} satisfies StorefrontProduct[]\n`,
    {
      ...prettierConfig,
      parser: "typescript",
    },
  ),
);
await writeFile(
  resolve(generatedRoot, "verification-catalog.json"),
  `${JSON.stringify(
    {
      collections: collections.map(({ name, slug }) => ({ name, slug })),
      products: products.map((product) => {
        const collection = primaryCollection(product);
        return {
          collectionName: collection?.name ?? null,
          height: product.media[0]?.height ?? null,
          name: product.name,
          slug: product.slug,
          width: product.media[0]?.width ?? null,
        };
      }),
    },
    null,
    2,
  )}\n`,
);
for (const product of products) {
  const collection = primaryCollection(product);
  const viewModel = composeProductPageModel({
    experience,
    locale: "en-US",
    productId: product.id,
    release,
    slug: product.slug,
  });
  await writeFile(
    resolve(generatedProducts, `${product.slug}.ts`),
    `import type { StorefrontProductPage } from "../../types/catalog-release"\n\nexport default ${JSON.stringify(
      {
        collection: collection ? { name: collection.name, slug: collection.slug } : null,
        product,
        releaseId: release.releaseId,
        siteOrigin: release.site.origin,
        viewModel,
      },
    )} satisfies StorefrontProductPage\n`,
  );
}
const productsBySlug = new Map(products.map((product) => [product.slug, product]));
await Promise.all(
  collections.map(async (collection) => {
    await writeFile(
      resolve(generatedCollections, `${collection.slug}.ts`),
      `import type { StorefrontCollectionPage } from "../../types/catalog-release"\n\nexport default ${JSON.stringify(
        {
          collection,
          products: collection.productSlugs
            .map((slug) => productsBySlug.get(slug))
            .filter((product): product is (typeof products)[number] => Boolean(product)),
        },
      )} satisfies StorefrontCollectionPage\n`,
    );
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
  `${routeManifest.redirects
    .map((redirect) => `${redirect.from} ${redirect.to} ${redirect.status}`)
    .join("\n")}\n`,
);

console.log(`Prepared ${routes.length} static routes from ${release.releaseId}.`);
