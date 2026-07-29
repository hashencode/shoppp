import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
await Promise.all(
  products.map(async (product) => {
    const collection = primaryCollection(product);
    await writeFile(
      resolve(generatedProducts, `${product.slug}.ts`),
      `import type { StorefrontProductPage } from "../../types/catalog-release"\n\nexport default ${JSON.stringify(
        {
          collection: collection ? { name: collection.name, slug: collection.slug } : null,
          product,
        },
      )} satisfies StorefrontProductPage\n`,
    );
  }),
);
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
  `${[
    ...routeManifest.redirects.map(
      (redirect) => `${redirect.from} ${redirect.to} ${redirect.status}`,
    ),
    "/orders/* /orders/access/index.html 200",
  ].join("\n")}\n`,
);

console.log(`Prepared ${routes.length} static routes from ${release.releaseId}.`);
