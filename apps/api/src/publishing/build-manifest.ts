import {
  canonicalCatalogReleaseSchema,
  productOptionDefinitionsSchema,
  productPresentationSchema,
  type CanonicalCatalogRelease,
  type ProductOptionDefinition,
  type ProductPresentation,
} from "@shoppp/contracts";
import { publishedProductRevisionContentSchema } from "../catalog/schemas";
import type { PublishedProductRevisionContent } from "../catalog/schemas";

import { ApiError } from "../http/errors";

export interface StorefrontMedia {
  alt: string;
  height: number;
  id: string;
  src: string;
  width: number;
}

export interface StorefrontPrice {
  amount: number;
  compareAtAmount?: number;
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
    optionDefinitions: ProductOptionDefinition[];
    presentation?: ProductPresentation;
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
  aggregatePublishedCatalog?: boolean;
  candidateProductId: string;
  candidateRevisionId?: string;
  environment: "development" | "staging" | "production";
  mediaOrigin: string;
  policies?: BuildCatalogInput["policies"];
  releaseId: string;
  storefrontOrigin: string;
}

interface ProductRow {
  description: string;
  id: string;
  name: string;
  option_definitions_json: string;
  presentation_json: string | null;
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
  compare_at_amount: number | null;
  currency: string;
  variant_id: string;
}

interface MediaRow {
  alt_text: string;
  height: number;
  id: string;
  product_id: string;
  r2_key: string;
  width: number;
}

interface ApprovedReviewRow {
  body: string;
  display_name: string;
  id: string;
  moderated_at: string;
  product_id: string;
  rating: number;
  submitted_at: string;
}

interface CollectionRow {
  description: string;
  id: string;
  name: string;
  slug: string;
  status: string;
}

function assertPolicyCompleteness(policies: BuildCatalogInput["policies"]): void {
  const slugs = policies.map(({ slug }) => slug);
  if (
    policies.length !== 4 ||
    new Set(slugs).size !== slugs.length ||
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

function releaseOptionDefinitions(
  rawDefinitions: string,
  variants: readonly StorefrontVariant[],
): ProductOptionDefinition[] {
  const stored = productOptionDefinitionsSchema.parse(parseSetting(rawDefinitions, []));
  if (stored.length > 0) return stored;
  const valuesByName = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.optionValues)) {
      const values = valuesByName.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      valuesByName.set(name, values);
    }
  }
  return [...valuesByName].map(([name, values]) => ({
    name,
    presentation: "text",
    values: values.map((label) => ({ label })),
  }));
}

function releasePresentation(rawPresentation: string | null): ProductPresentation | undefined {
  if (!rawPresentation) return undefined;
  return productPresentationSchema.parse(parseSetting(rawPresentation, {}));
}

async function setting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare("SELECT value_json FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value_json: string }>();
  return parseSetting(row?.value_json, fallback);
}

async function publishedPolicies(db: D1Database): Promise<BuildCatalogInput["policies"]> {
  const rows = await db
    .prepare(
      `SELECT slug, title, effective_date, sections_json FROM policy_versions
        WHERE status = 'published' ORDER BY kind, policy_id`,
    )
    .all<{ effective_date: string; sections_json: string; slug: string; title: string }>();
  return rows.results.map((row) => {
    const sections = JSON.parse(row.sections_json) as Array<{
      alt?: string;
      caption?: string;
      items?: string[];
      kind: string;
      text?: string;
    }>;
    return {
      description:
        sections
          .flatMap((section) => section.text ?? section.items ?? section.caption ?? [])
          .join(" ")
          .slice(0, 2_000) || row.title,
      effectiveDate: row.effective_date,
      sections: sections.map((section) => ({
        body:
          section.text ?? section.items?.join("\n") ?? section.caption ?? section.alt ?? row.title,
        heading: section.kind === "heading" && section.text ? section.text : row.title,
      })),
      slug: row.slug,
      title: row.title,
    };
  });
}

export async function buildCatalogReleaseManifest(
  db: D1Database,
  options: BuildManifestOptions,
): Promise<StaticRouteManifest> {
  const products = await db
    .prepare(
      `SELECT id, slug, name, description, option_definitions_json, presentation_json, status, seo_title, seo_description
         FROM products
        WHERE status = 'published' OR (? = 0 AND id = ?)
        ORDER BY slug`,
    )
    .bind(options.aggregatePublishedCatalog ? 1 : 0, options.candidateProductId)
    .all<ProductRow>();
  if (!products.results.some((product) => product.id === options.candidateProductId)) {
    throw new ApiError(404, "product_not_found", "The product was not found.");
  }
  const productIds = products.results.map((product) => product.id);
  const productIdsJson = JSON.stringify(productIds);
  const approvedReviews = await db
    .prepare(
      `SELECT id, product_id, rating, display_name, body, submitted_at, moderated_at
         FROM product_reviews
        WHERE status = 'approved' AND product_id IN (SELECT value FROM json_each(?))
        ORDER BY submitted_at DESC, id DESC LIMIT 10001`,
    )
    .bind(productIdsJson)
    .all<ApprovedReviewRow>();
  if (approvedReviews.results.length > 10_000) {
    throw new ApiError(422, "catalog_review_limit", "Too many reviews for one Catalog Release.");
  }
  const revisionRows = await db
    .prepare(
      `SELECT id, product_id, status, content_json FROM product_revisions
        WHERE product_id IN (SELECT value FROM json_each(?))
          AND (status = 'published' OR (? = 0 AND id = ?))
        ORDER BY product_id, published_at DESC, id DESC`,
    )
    .bind(
      productIdsJson,
      options.aggregatePublishedCatalog ? 1 : 0,
      options.candidateRevisionId ?? "",
    )
    .all<{ content_json: string; id: string; product_id: string; status: string }>();
  const revisions = new Map<string, PublishedProductRevisionContent>();
  for (const row of revisionRows.results) {
    if (row.status === "published" && !revisions.has(row.product_id)) {
      revisions.set(
        row.product_id,
        publishedProductRevisionContentSchema.parse(JSON.parse(row.content_json)),
      );
    }
  }
  if (options.candidateRevisionId) {
    const candidate = revisionRows.results.find(({ id }) => id === options.candidateRevisionId);
    if (!candidate || candidate.product_id !== options.candidateProductId) {
      throw new ApiError(409, "product_revision_not_found", "The Product revision is unavailable.");
    }
    revisions.set(
      candidate.product_id,
      publishedProductRevisionContentSchema.parse(JSON.parse(candidate.content_json)),
    );
  }
  const [variants, prices, media, collections, memberships] = await Promise.all([
    db
      .prepare(
        `SELECT id, product_id, sku, title, option_values_json, weight_grams, status
           FROM product_variants
          WHERE product_id IN (SELECT value FROM json_each(?))
          ORDER BY product_id, created_at, id`,
      )
      .bind(productIdsJson)
      .all<VariantRow>(),
    db
      .prepare(
        `SELECT p.variant_id, p.amount, p.compare_at_amount, pl.currency
           FROM prices p
           JOIN price_lists pl ON pl.id = p.price_list_id
           JOIN product_variants v ON v.id = p.variant_id
          WHERE v.product_id IN (SELECT value FROM json_each(?)) AND pl.status = 'active'
          ORDER BY p.variant_id, pl.currency`,
      )
      .bind(productIdsJson)
      .all<PriceRow>(),
    db
      .prepare(
        `SELECT id, product_id, r2_key, alt_text, width, height
           FROM product_media
          WHERE product_id IN (SELECT value FROM json_each(?))
          ORDER BY product_id, position, id`,
      )
      .bind(productIdsJson)
      .all<MediaRow>(),
    db
      .prepare(
        `SELECT DISTINCT cv.collection_id AS id, cv.slug, cv.name, cv.description, cv.status
           FROM collection_versions cv
           JOIN collection_memberships cm
             ON cm.collection_id = cv.collection_id AND cm.collection_version = cv.version
          WHERE ((? = 1 AND cv.status = 'published') OR
                 (? = 0 AND cv.version = (
                  SELECT MAX(current.version) FROM collection_versions current
                   WHERE current.collection_id = cv.collection_id
                ) AND (cv.status = 'published' OR cm.product_id = ?)))
            AND cm.product_id IN (SELECT value FROM json_each(?))
          ORDER BY cv.slug`,
      )
      .bind(
        options.aggregatePublishedCatalog ? 1 : 0,
        options.aggregatePublishedCatalog ? 1 : 0,
        options.candidateProductId,
        productIdsJson,
      )
      .all<CollectionRow>(),
    db
      .prepare(
        `SELECT cm.collection_id, cm.product_id
           FROM collection_memberships cm
          JOIN collection_versions cv
            ON cv.collection_id = cm.collection_id AND cv.version = cm.collection_version
          WHERE cm.product_id IN (SELECT value FROM json_each(?))
            AND ((? = 1 AND cv.status = 'published') OR (? = 0 AND cm.collection_version = (
              SELECT MAX(cv.version) FROM collection_versions cv
               WHERE cv.collection_id = cm.collection_id
            )))
          ORDER BY cm.collection_id, cm.position`,
      )
      .bind(
        productIdsJson,
        options.aggregatePublishedCatalog ? 1 : 0,
        options.aggregatePublishedCatalog ? 1 : 0,
      )
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
    const revision = revisions.get(product.id);
    const collectionReferences = memberships.results
      .filter((membership) => membership.product_id === product.id)
      .flatMap((membership) => {
        const slug = collectionSlugs.get(membership.collection_id);
        return slug ? [{ id: membership.collection_id, slug }] : [];
      });
    const productVariants = variants.results
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        optionValues:
          revision?.variantOptions?.find(({ id }) => id === variant.id)?.optionValues ??
          parseSetting<Record<string, string>>(variant.option_values_json, {}),
        id: variant.id,
        prices: prices.results
          .filter((price) => price.variant_id === variant.id)
          .map((price) => ({
            amount: price.amount,
            ...(price.compare_at_amount === null
              ? {}
              : { compareAtAmount: price.compare_at_amount }),
            currency: price.currency,
          })),
        sku: variant.sku,
        status: variant.status,
        title:
          revision?.variantOptions?.find(({ id }) => id === variant.id)?.title ?? variant.title,
        weightGrams: variant.weight_grams,
      }));
    const sourcePresentation = revision
      ? (revision.presentation ?? undefined)
      : releasePresentation(product.presentation_json);
    const productReviews = approvedReviews.results.filter(
      (review) => review.product_id === product.id,
    );
    const ratingBands: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const review of productReviews) ratingBands[review.rating - 1]! += 1;
    const presentation: ProductPresentation = {
      ...(sourcePresentation ?? { specifications: [] }),
      reviewDisplay: {
        averageRating: productReviews.length
          ? Math.round(
              (productReviews.reduce((total, review) => total + review.rating, 0) * 10) /
                productReviews.length,
            ) / 10
          : 0,
        count: productReviews.length,
        entries: productReviews.map((review) => ({
          author: review.display_name,
          date: review.submitted_at.slice(0, 10),
          id: review.id,
          rating: review.rating,
          text: review.body,
        })),
        provenance: "approved-customer-reviews",
        ratingBands,
        updatedAt: productReviews.reduce(
          (latest, review) => (review.moderated_at > latest ? review.moderated_at : latest),
          "1970-01-01T00:00:00.000Z",
        ),
      },
    };
    return {
      collectionIds: collectionReferences.map(({ id }) => id),
      collectionSlugs: collectionReferences.map(({ slug }) => slug),
      description: revision?.description ?? product.description,
      id: product.id,
      media: revision
        ? revision.media.map((item) => ({
            alt: item.altText,
            height: item.height,
            id: item.id,
            src: `${trimSlash(options.mediaOrigin)}/${item.r2Key}`,
            width: item.width,
          }))
        : media.results
            .filter((item) => item.product_id === product.id)
            .map((item) => ({
              alt: item.alt_text,
              height: item.height,
              id: item.id,
              src: `${trimSlash(options.mediaOrigin)}/${item.r2_key}`,
              width: item.width,
            })),
      name: revision?.name ?? product.name,
      optionDefinitions:
        revision?.optionDefinitions ??
        releaseOptionDefinitions(product.option_definitions_json, productVariants),
      presentation,
      seoDescription: revision?.seoDescription ?? product.seo_description,
      seoTitle: revision?.seoTitle ?? product.seo_title,
      slug: product.slug,
      status: product.id === options.candidateProductId ? "published" : product.status,
      variants: productVariants,
    };
  });
  const configuredSite = await setting<Partial<BuildCatalogInput["site"]>>(
    db,
    "storefront.site",
    {},
  );
  const policies = options.policies ?? (await publishedPolicies(db));
  const legacyRedirects = await setting<BuildCatalogInput["redirects"]>(
    db,
    "storefront.redirects",
    [],
  );
  const collectionRedirects = await db
    .prepare(
      `SELECT from_path AS "from", to_path AS "to"
         FROM collection_route_redirects
        WHERE environment = ?
        ORDER BY from_path`,
    )
    .bind(options.environment)
    .all<{ from: string; to: string }>();
  const redirectsBySource = new Map(legacyRedirects.map((redirect) => [redirect.from, redirect]));
  for (const redirect of collectionRedirects.results) {
    const existing = redirectsBySource.get(redirect.from);
    if (existing && existing.to !== redirect.to) {
      throw new ApiError(
        409,
        "storefront_redirect_conflict",
        `Redirect ${redirect.from} has conflicting destinations.`,
      );
    }
    redirectsBySource.set(redirect.from, redirect);
  }
  const redirects = [...redirectsBySource.values()];
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
