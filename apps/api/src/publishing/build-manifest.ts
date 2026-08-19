import { canonicalCatalogReleaseSchema, type CanonicalCatalogRelease } from "@shoppp/contracts";

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
  id: string;
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
    id: string;
    name: string;
    productIds: string[];
    productSlugs: string[];
    seoDescription: string;
    seoTitle: string;
    slug: string;
    status: string;
  }>;
  policies: Array<{
    description: string;
    effectiveDate: string;
    sections: Array<{ body: string; heading: string }>;
    slug: string;
    title: string;
  }>;
  products: Array<{
    collectionIds: string[];
    collectionSlugs: string[];
    description: string;
    id: string;
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

export type StaticRouteManifest = CanonicalCatalogRelease;

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
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "We show eligible destinations, available services, charges, and estimated delivery timing before payment. An address outside the enabled country list cannot proceed to checkout.",
        heading: "Destinations and delivery estimates",
      },
      {
        body: "Cross-border duties, taxes, or carrier charges are shown when the configured service can calculate them. Any amount not collected by us is identified before you place the order.",
        heading: "Cross-border charges",
      },
      {
        body: "Shipment notifications include the carrier and tracking reference. Contact support through the secure channel in your order receipt for delivery exceptions.",
        heading: "Tracking and exceptions",
      },
    ],
    slug: "shipping",
    title: "Shipping policy",
  },
  {
    description:
      "Eligible unused items may be returned within 30 days of delivery. Contact support before sending an item back.",
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "Contact support within 30 days of delivery before returning an unused item. We will confirm eligibility, the return destination, and any required authorization.",
        heading: "Return eligibility",
      },
      {
        body: "Items that are used, damaged after delivery, personalized, or restricted by law may be ineligible. Product-specific exclusions are disclosed before purchase.",
        heading: "Exclusions",
      },
      {
        body: "Approved refunds are sent to the original payment method. Bank and payment-network processing time can vary after the refund is issued.",
        heading: "Refund timing",
      },
    ],
    slug: "returns",
    title: "Returns policy",
  },
  {
    description:
      "We collect only the information needed to operate, secure, and improve your purchase experience.",
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "We process contact, delivery, order, payment-status, device-security, and support information needed to provide and protect the service. Hosted payment details are handled by the payment provider and are not stored by this storefront.",
        heading: "Information and purposes",
      },
      {
        body: "Commerce records are retained for operational, fraud-prevention, accounting, and legal obligations. Access, correction, and deletion requests are handled through an audited process; legally required financial records remain immutable.",
        heading: "Retention and your requests",
      },
      {
        body: "Service providers receive only the data needed for payment, delivery, communications, hosting, or security. We count anonymous page classes and purchase stages without cookies, URLs, device identifiers, or personal data. Optional analytics remain disabled until the applicable consent requirement is met.",
        heading: "Providers and international processing",
      },
    ],
    slug: "privacy",
    title: "Privacy policy",
  },
  {
    description: "These terms govern use of the storefront and purchases made through it.",
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "An order is accepted only after payment confirmation and inventory convergence. A redirect or confirmation page alone is not proof that payment succeeded.",
        heading: "Orders and payment",
      },
      {
        body: "Prices, currency, shipping, tax treatment, and the final total are shown before hosted checkout. We may reject abusive, unlawful, or technically invalid transactions.",
        heading: "Pricing and acceptable use",
      },
      {
        body: "Product warranties, liability limits, and mandatory consumer rights depend on the enabled market. Nothing in these terms removes rights that cannot lawfully be excluded.",
        heading: "Consumer rights",
      },
    ],
    slug: "terms",
    title: "Terms of service",
  },
  {
    description: "Contact support through the secure channel shown in your order receipt.",
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "For an existing order, use the secure support channel in the order receipt and include the public order reference. Never send card numbers, passwords, or guest access links.",
        heading: "Order support",
      },
      {
        body: "For privacy requests, use the privacy contact approved in the launch configuration. We verify the request before exporting data or recording a correction or deletion decision.",
        heading: "Privacy requests",
      },
      {
        body: "The merchant's approved legal name, address, and market-specific contact details must be published before production commerce is enabled.",
        heading: "Merchant details",
      },
    ],
    slug: "contact",
    title: "Contact",
  },
  {
    description:
      "Essential storage supports cart and security features. Optional tracking remains disabled until consent.",
    effectiveDate: "2026-07-30",
    sections: [
      {
        body: "Essential browser storage keeps the guest cart, checkout return state, security challenge, and accessibility preferences working. It is not used to build an advertising profile.",
        heading: "Essential storage",
      },
      {
        body: "The launch service counts aggregate page classes and purchase stages without cookies or persistent identifiers. Optional analytics and marketing tracking remain off until the required consent is recorded for an enabled market.",
        heading: "Optional tracking",
      },
      {
        body: "Clearing essential storage may empty the local cart reference or interrupt checkout. Server-side order and financial records are governed by the privacy and retention process.",
        heading: "Your controls",
      },
    ],
    slug: "cookies",
    title: "Cookie disclosure",
  },
];

const REQUIRED_POLICY_SLUGS = ["contact", "cookies", "privacy", "returns", "shipping", "terms"];

function assertPolicyCompleteness(policies: BuildCatalogInput["policies"]): void {
  const slugs = policies.map(({ slug }) => slug).sort();
  if (
    slugs.length !== REQUIRED_POLICY_SLUGS.length ||
    slugs.some((slug, index) => slug !== REQUIRED_POLICY_SLUGS[index]) ||
    policies.some(
      (policy) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(policy.effectiveDate) ||
        policy.sections.length === 0 ||
        policy.sections.some((section) => !section.heading.trim() || !section.body.trim()),
    )
  ) {
    throw new ApiError(
      422,
      "storefront_policy_incomplete",
      "All required storefront policy disclosures must be complete.",
    );
  }
}

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
  const manifestProducts: BuildCatalogInput["products"] = products.results.map((product) => {
    const collectionReferences = memberships.results
      .filter((membership) => membership.product_id === product.id)
      .flatMap((membership) => {
        const slug = collectionSlugs.get(membership.collection_id);
        return slug ? [{ id: membership.collection_id, slug }] : [];
      });
    return {
      collectionIds: collectionReferences.map(({ id }) => id),
      collectionSlugs: collectionReferences.map(({ slug }) => slug),
      description: product.description,
      id: product.id,
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
          id: variant.id,
          prices: prices.results
            .filter((price) => price.variant_id === variant.id)
            .map((price) => ({ amount: price.amount, currency: price.currency })),
          sku: variant.sku,
          status: variant.status,
          title: variant.title,
          weightGrams: variant.weight_grams,
        })),
    };
  });
  const configuredSite = await setting<Partial<BuildCatalogInput["site"]>>(
    db,
    "storefront.site",
    {},
  );
  const policies = await setting(db, "storefront.policies", defaultPolicies);
  const redirects = await setting<BuildCatalogInput["redirects"]>(db, "storefront.redirects", []);
  return buildStaticRouteManifest({
    collections: collections.results.map((collection) => {
      const productReferences = memberships.results
        .filter((membership) => membership.collection_id === collection.id)
        .flatMap((membership) => {
          const slug = productSlugs.get(membership.product_id);
          return slug ? [{ id: membership.product_id, slug }] : [];
        });
      return {
        description: collection.description,
        id: collection.id,
        name: collection.name,
        productIds: productReferences.map(({ id }) => id),
        productSlugs: productReferences.map(({ slug }) => slug),
        seoDescription: collection.description,
        seoTitle: collection.name,
        slug: collection.slug,
        status: candidateCollections.has(collection.id) ? "published" : collection.status,
      };
    }),
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
  assertPolicyCompleteness(input.policies);
  const publishedProducts = input.products.filter(
    (product) =>
      product.status === "published" &&
      product.variants.some((variant) => variant.status === "active"),
  );
  const publishedCollections = input.collections.filter(
    (collection) => collection.status === "published",
  );
  const publishedProductsById = new Map(publishedProducts.map((product) => [product.id, product]));
  const publishedCollectionsById = new Map(
    publishedCollections.map((collection) => [collection.id, collection]),
  );
  const releaseProducts = publishedProducts.map((product) => {
    const memberships = product.collectionIds
      .map((id) => publishedCollectionsById.get(id))
      .filter((collection): collection is BuildCatalogInput["collections"][number] =>
        Boolean(collection),
      );
    return {
      ...product,
      collectionIds: memberships.map(({ id }) => id),
      collectionSlugs: memberships.map(({ slug }) => slug),
      variants: product.variants.filter((variant) => variant.status === "active"),
    };
  });
  const releaseCollections = publishedCollections.map((collection) => {
    const memberships = collection.productIds
      .map((id) => publishedProductsById.get(id))
      .filter((product): product is BuildCatalogInput["products"][number] => Boolean(product));
    return {
      ...collection,
      productIds: memberships.map(({ id }) => id),
      productSlugs: memberships.map(({ slug }) => slug),
    };
  });
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
  return canonicalCatalogReleaseSchema.parse({
    ...input,
    collections: releaseCollections,
    generatedAt: new Date().toISOString(),
    products: releaseProducts,
    redirects: input.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    routes: uniqueRoutes,
    schemaVersion: 2,
  });
}
