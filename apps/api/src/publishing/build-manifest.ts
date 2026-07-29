import { ApiError } from "../http/errors";

export interface StorefrontMedia {
  alt: string;
  height: number;
  src: string;
  width: number;
}

export interface StorefrontPrice {
  amount: number;
  currency: string;
}

export interface StorefrontVariant {
  optionValues: Record<string, string>;
  prices: StorefrontPrice[];
  sku: string;
  status: string;
  title: string;
  weightGrams: number;
}

export interface BuildCatalogInput {
  collections: Array<{
    description: string;
    name: string;
    productSlugs: string[];
    seoDescription: string;
    seoTitle: string;
    slug: string;
    status: string;
  }>;
  policies: Array<{ description: string; slug: string; title: string }>;
  products: Array<{
    collectionSlugs: string[];
    description: string;
    media: StorefrontMedia[];
    name: string;
    seoDescription: string;
    seoTitle: string;
    slug: string;
    status: string;
    variants: StorefrontVariant[];
  }>;
  redirects: Array<{ from: string; to: string }>;
  releaseId: string;
  site: {
    defaultCurrency: string;
    freshnessHours: number;
    name: string;
    origin: string;
  };
}

export interface StaticRouteManifest extends BuildCatalogInput {
  generatedAt: string;
  redirects: Array<{ from: string; status: 301; to: string }>;
  routes: string[];
  schemaVersion: 1;
}

interface BuildManifestOptions {
  candidateProductId: string;
  mediaOrigin: string;
  releaseId: string;
  storefrontOrigin: string;
}

interface ProductRow {
  description: string;
  id: string;
  name: string;
  seo_description: string;
  seo_title: string;
  slug: string;
  status: string;
}

interface VariantRow {
  id: string;
  option_values_json: string;
  product_id: string;
  sku: string;
  status: string;
  title: string;
  weight_grams: number;
}

interface PriceRow {
  amount: number;
  currency: string;
  variant_id: string;
}

interface MediaRow {
  alt_text: string;
  height: number;
  product_id: string;
  r2_key: string;
  width: number;
}

interface CollectionRow {
  description: string;
  id: string;
  name: string;
  slug: string;
  status: string;
}

const defaultPolicies: BuildCatalogInput["policies"] = [
  {
    description:
      "Delivery timing and available services are confirmed from your destination during checkout.",
    slug: "shipping",
    title: "Shipping policy",
  },
  {
    description:
      "Eligible unused items may be returned within 30 days of delivery. Contact support before sending an item back.",
    slug: "returns",
    title: "Returns policy",
  },
  {
    description:
      "We collect only the information needed to operate, secure, and improve your purchase experience.",
    slug: "privacy",
    title: "Privacy policy",
  },
  {
    description: "These terms govern use of the storefront and purchases made through it.",
    slug: "terms",
    title: "Terms of service",
  },
  {
    description: "Contact support through the secure channel shown in your order receipt.",
    slug: "contact",
    title: "Contact",
  },
  {
    description:
      "Essential storage supports cart and security features. Optional tracking remains disabled until consent.",
    slug: "cookies",
    title: "Cookie disclosure",
  },
];

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseSetting<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ApiError(
      500,
      "storefront_setting_invalid",
      "A storefront release setting contains invalid JSON.",
    );
  }
}

async function setting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value_json: string }>();
  return parseSetting(row?.value_json, fallback);
}

export async function buildCatalogReleaseManifest(
  db: D1Database,
  options: BuildManifestOptions,
): Promise<StaticRouteManifest> {
  const products = await db
    .prepare(
      `SELECT id, slug, name, description, status, seo_title, seo_description
         FROM products
        WHERE status = 'published' OR id = ?
        ORDER BY slug`,
    )
    .bind(options.candidateProductId)
    .all<ProductRow>();
  if (!products.results.some((product) => product.id === options.candidateProductId)) {
    throw new ApiError(404, "product_not_found", "The product was not found.");
  }
  const productIds = products.results.map((product) => product.id);
  const placeholders = productIds.map(() => "?").join(",");
  const [variants, prices, media, collections, memberships] = await Promise.all([
    db
      .prepare(
        `SELECT id, product_id, sku, title, option_values_json, weight_grams, status
           FROM product_variants
          WHERE product_id IN (${placeholders})
          ORDER BY product_id, created_at, id`,
      )
      .bind(...productIds)
      .all<VariantRow>(),
    db
      .prepare(
        `SELECT p.variant_id, p.amount, pl.currency
           FROM prices p
           JOIN price_lists pl ON pl.id = p.price_list_id
           JOIN product_variants v ON v.id = p.variant_id
          WHERE v.product_id IN (${placeholders}) AND pl.status = 'active'
          ORDER BY p.variant_id, pl.currency`,
      )
      .bind(...productIds)
      .all<PriceRow>(),
    db
      .prepare(
        `SELECT product_id, r2_key, alt_text, width, height
           FROM product_media
          WHERE product_id IN (${placeholders})
          ORDER BY product_id, position, id`,
      )
      .bind(...productIds)
      .all<MediaRow>(),
    db
      .prepare(
        `SELECT DISTINCT c.id, c.slug, c.name, c.description, c.status
           FROM collections c
           JOIN collection_products cp ON cp.collection_id = c.id
          WHERE c.status = 'published' OR cp.product_id = ?
          ORDER BY c.slug`,
      )
      .bind(options.candidateProductId)
      .all<CollectionRow>(),
    db
      .prepare(
        `SELECT cp.collection_id, cp.product_id
           FROM collection_products cp
          WHERE cp.product_id IN (${placeholders})
          ORDER BY cp.collection_id, cp.position`,
      )
      .bind(...productIds)
      .all<{ collection_id: string; product_id: string }>(),
  ]);
  const productSlugs = new Map(products.results.map((product) => [product.id, product.slug]));
  const collectionSlugs = new Map(
    collections.results.map((collection) => [collection.id, collection.slug]),
  );
  const candidateCollections = new Set(
    memberships.results
      .filter((membership) => membership.product_id === options.candidateProductId)
      .map((membership) => membership.collection_id),
  );
  const manifestProducts: BuildCatalogInput["products"] = products.results.map((product) => ({
    collectionSlugs: memberships.results
      .filter((membership) => membership.product_id === product.id)
      .map((membership) => collectionSlugs.get(membership.collection_id))
      .filter((slug): slug is string => Boolean(slug)),
    description: product.description,
    media: media.results
      .filter((item) => item.product_id === product.id)
      .map((item) => ({
        alt: item.alt_text,
        height: item.height,
        src: `${trimSlash(options.mediaOrigin)}/${item.r2_key}`,
        width: item.width,
      })),
    name: product.name,
    seoDescription: product.seo_description,
    seoTitle: product.seo_title,
    slug: product.slug,
    status: product.id === options.candidateProductId ? "published" : product.status,
    variants: variants.results
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        optionValues: parseSetting<Record<string, string>>(variant.option_values_json, {}),
        prices: prices.results
          .filter((price) => price.variant_id === variant.id)
          .map((price) => ({ amount: price.amount, currency: price.currency })),
        sku: variant.sku,
        status: variant.status,
        title: variant.title,
        weightGrams: variant.weight_grams,
      })),
  }));
  const configuredSite = await setting<Partial<BuildCatalogInput["site"]>>(
    db,
    "storefront.site",
    {},
  );
  const policies = await setting(db, "storefront.policies", defaultPolicies);
  const redirects = await setting<BuildCatalogInput["redirects"]>(db, "storefront.redirects", []);
  return buildStaticRouteManifest({
    collections: collections.results.map((collection) => ({
      description: collection.description,
      name: collection.name,
      productSlugs: memberships.results
        .filter((membership) => membership.collection_id === collection.id)
        .map((membership) => productSlugs.get(membership.product_id))
        .filter((slug): slug is string => Boolean(slug)),
      seoDescription: collection.description,
      seoTitle: collection.name,
      slug: collection.slug,
      status: candidateCollections.has(collection.id) ? "published" : collection.status,
    })),
    policies,
    products: manifestProducts,
    redirects,
    releaseId: options.releaseId,
    site: {
      defaultCurrency: configuredSite.defaultCurrency ?? "USD",
      freshnessHours: configuredSite.freshnessHours ?? 24,
      name: configuredSite.name ?? "Shoppp",
      origin: trimSlash(configuredSite.origin ?? options.storefrontOrigin),
    },
  });
}

export function buildStaticRouteManifest(input: BuildCatalogInput): StaticRouteManifest {
  const publishedProducts = input.products.filter(
    (product) =>
      product.status === "published" &&
      product.variants.some((variant) => variant.status === "active"),
  );
  const publishedCollections = input.collections.filter(
    (collection) => collection.status === "published",
  );
  const routes = [
    "/",
    ...publishedCollections.map((collection) => `/collections/${collection.slug}`),
    ...input.policies.map((policy) => `/policies/${policy.slug}`),
    ...publishedProducts.map((product) => `/products/${product.slug}`),
  ];
  const uniqueRoutes = [...new Set(routes)].sort((left, right) => {
    if (left === "/") return -1;
    if (right === "/") return 1;
    return left.localeCompare(right);
  });
  if (uniqueRoutes.length !== routes.length) {
    throw new ApiError(
      422,
      "storefront_route_conflict",
      "Published storefront routes must be unique.",
    );
  }
  return {
    ...input,
    collections: publishedCollections,
    generatedAt: new Date().toISOString(),
    products: publishedProducts,
    redirects: input.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    routes: uniqueRoutes,
    schemaVersion: 1,
  };
}
