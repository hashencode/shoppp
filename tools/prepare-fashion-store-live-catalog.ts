import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "../apps/storefront/node_modules/sharp";
import {
  canonicalCatalogReleaseSchema,
  type CanonicalCatalogRelease,
} from "../packages/contracts/src";
import releaseFixture from "../apps/storefront/fixtures/release.json";

const DEFAULT_MANIFEST_PATH = "tools/fashion-store-live-catalog.json";

export const FASHION_STORE_LIVE_CATALOG_RESET_TARGET = {
  cloudflareAccountId: "449e7f42fe4c4e55d5c674e2e7c57c8d",
  d1DatabaseId: "eb1ca4ef-3121-4d02-b20e-e619eac1cecc",
  d1DatabaseName: "shoppp-fashion-staging",
  mediaOrigin: "https://pub-4e1c398c57fa4b9f9781bc1abcb507a5.r2.dev",
  r2BucketName: "shoppp-fashion-staging-media",
  resourceNamespace: "shoppp-fashion-staging",
  workerName: "shoppp-api-fashion-staging",
} as const;

export interface FashionStoreLiveCatalogPrice {
  amount: number;
  compareAtAmount: number;
  currency: "USD";
}

export interface FashionStoreLiveCatalogVariant {
  id: string;
  inventory: { onHand: number; oversellLimit: number };
  optionValues: { color: string; size: string };
  price: FashionStoreLiveCatalogPrice;
  sku: string;
  status: "active";
  title: string;
  weightGrams: number | null;
}

export interface FashionStoreLiveCatalogMedia {
  alt: string;
  height: number;
  id: string;
  mimeType: "image/jpeg";
  order: number;
  r2Key: string;
  sha256: string;
  sourcePath: string;
  width: number;
}

export interface FashionStoreLiveCatalogProduct {
  badge: "Hot" | "New" | null;
  brand: string | null;
  description: string;
  id: string;
  media: FashionStoreLiveCatalogMedia[];
  name: string;
  shopCardOrder: number | null;
  slug: string;
  source: { fixtureId: string; kind: "product-detail" | "shop-card" };
  status: "published";
  taxonomy: {
    categories: string[];
    colors: string[];
    sizes: string[];
    tags: string[];
  };
  variants: FashionStoreLiveCatalogVariant[];
}

export interface FashionStoreLiveCatalog {
  catalogVersion: string;
  collection: { id: string; name: string; slug: string };
  currency: "USD";
  products: FashionStoreLiveCatalogProduct[];
  r2Prefix: string;
  schemaVersion: 1;
  warehouse: { code: string; id: string; name: string };
}

export interface FashionStoreLiveCatalogMigrationPlan {
  acceptanceRelease: CanonicalCatalogRelease;
  applyInput: {
    acceptanceProduct: {
      id: string;
      slug: string;
      variantId: string;
      sku: string;
    };
    acceptanceRelease: CanonicalCatalogRelease;
    catalog: FashionStoreLiveCatalog;
    environment: "fashion-staging";
    expectedIamFingerprint: string;
    manifestDigest: string;
    shopperRelease: CanonicalCatalogRelease;
    target: typeof FASHION_STORE_LIVE_CATALOG_RESET_TARGET;
  };
  mediaUploads: Array<{
    contentType: "image/jpeg";
    r2Key: string;
    sha256: string;
    sourcePath: string;
  }>;
  shopperRelease: CanonicalCatalogRelease;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Fashion Store live catalog: ${message}`);
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assert(value.length > 0, `${label} cannot be empty`);
    assert(!seen.has(value), `duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function combinations(colors: string[], sizes: string[]): string[] {
  return colors.flatMap((color) => sizes.map((size) => `${color}:${size}`)).sort();
}

export function validateFashionStoreLiveCatalog(
  input: FashionStoreLiveCatalog,
): FashionStoreLiveCatalog {
  assert(input && typeof input === "object", "manifest must be an object");
  assert(input.schemaVersion === 1, "schemaVersion must be 1");
  assert(input.currency === "USD", "currency must be USD");
  assert(input.catalogVersion.length > 0, "catalogVersion is required");
  assert(input.r2Prefix.length > 0 && !input.r2Prefix.endsWith("/"), "r2Prefix is invalid");
  assert(input.products.length === 13, "manifest must contain exactly 13 products");

  assertUnique(
    input.products.map(({ id }) => id),
    "product id",
  );
  assertUnique(
    input.products.map(({ slug }) => slug),
    "product slug",
  );

  const variants = input.products.flatMap((product) => product.variants);
  const media = input.products.flatMap((product) => product.media);
  assert(variants.length === 24, "manifest must contain exactly 24 SKUs");
  assert(media.length === 18, "manifest must contain exactly 18 product-owned media objects");
  assertUnique(
    variants.map(({ id }) => id),
    "variant id",
  );
  assertUnique(
    variants.map(({ sku }) => sku),
    "SKU",
  );
  assertUnique(
    media.map(({ id }) => id),
    "media id",
  );
  assertUnique(
    media.map(({ r2Key }) => r2Key),
    "R2 key",
  );

  const shopOrders = input.products
    .map(({ shopCardOrder }) => shopCardOrder)
    .filter((order): order is number => order !== null)
    .sort((left, right) => left - right);
  assert(
    JSON.stringify(shopOrders) ===
      JSON.stringify(Array.from({ length: 12 }, (_, index) => index + 1)),
    "shop card order must contain each position from 1 through 12",
  );

  for (const product of input.products) {
    assert(product.name.length > 0, `${product.id} requires a name`);
    assert(product.taxonomy.colors.length > 0, `${product.id} requires a color option`);
    assert(product.taxonomy.sizes.length > 0, `${product.id} requires a size option`);
    assert(product.media.length > 0, `${product.id} requires product media`);

    const expectedOptions = combinations(product.taxonomy.colors, product.taxonomy.sizes);
    const actualOptions = product.variants
      .map(({ optionValues }) => `${optionValues.color}:${optionValues.size}`)
      .sort();
    assert(
      JSON.stringify(actualOptions) === JSON.stringify(expectedOptions),
      `${product.id} option matrix is incomplete or contains duplicates`,
    );

    for (const variant of product.variants) {
      assert(
        Number.isInteger(variant.price.amount) && variant.price.amount > 0,
        `${variant.id} price must be positive integer cents`,
      );
      assert(
        Number.isInteger(variant.price.compareAtAmount) &&
          variant.price.compareAtAmount > variant.price.amount,
        `${variant.id} compare-at price must be greater than current price`,
      );
      assert(
        variant.price.currency === input.currency,
        `${variant.id} currency must match catalog`,
      );
      assert(
        Number.isInteger(variant.inventory.onHand) && variant.inventory.onHand > 0,
        `${variant.id} sellable SKU requires positive inventory`,
      );
      assert(variant.inventory.oversellLimit === 0, `${variant.id} oversell is not allowed`);
    }

    const orders = product.media.map(({ order }) => order).sort((left, right) => left - right);
    assert(
      JSON.stringify(orders) ===
        JSON.stringify(Array.from({ length: product.media.length }, (_, index) => index + 1)),
      `${product.id} media order must be contiguous from 1`,
    );
    for (const item of product.media) {
      assert(item.alt.trim().length > 0, `${item.id} requires alt text`);
      assert(item.mimeType === "image/jpeg", `${item.id} MIME type must be image/jpeg`);
      assert(item.width > 0 && item.height > 0, `${item.id} dimensions must be positive`);
      assert(/^[a-f0-9]{64}$/.test(item.sha256), `${item.id} checksum must be SHA-256`);
      assert(
        item.r2Key.startsWith(`${input.r2Prefix}/`),
        `${item.id} must use the versioned R2 prefix`,
      );
      assert(
        !item.sourcePath.includes("product-detail-07.jpg"),
        `${item.id} includes editorial-only imagery`,
      );
    }
  }

  return input;
}

export async function verifyFashionStoreLiveCatalogMedia(
  catalog: FashionStoreLiveCatalog,
  repositoryRoot: string,
): Promise<void> {
  for (const item of catalog.products.flatMap((product) => product.media)) {
    const path = resolve(repositoryRoot, item.sourcePath);
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      throw new Error(`Invalid Fashion Store live catalog: missing media ${item.sourcePath}`);
    }
    const checksum = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    assert(checksum === item.sha256, `${item.id} checksum differs from reviewed bytes`);
    const metadata = await sharp(bytes).metadata();
    assert(metadata.format === "jpeg", `${item.id} decoded format must be JPEG`);
    assert(
      metadata.width === item.width && metadata.height === item.height,
      `${item.id} decoded dimensions differ from the manifest`,
    );
  }
}

export async function loadFashionStoreLiveCatalog(options: {
  manifestPath?: string;
  repositoryRoot: string;
}): Promise<FashionStoreLiveCatalog> {
  const manifestPath = resolve(
    options.repositoryRoot,
    options.manifestPath ?? DEFAULT_MANIFEST_PATH,
  );
  const catalog = validateFashionStoreLiveCatalog(
    JSON.parse(await readFile(manifestPath, "utf8")) as FashionStoreLiveCatalog,
  );
  await verifyFashionStoreLiveCatalogMedia(catalog, options.repositoryRoot);
  return catalog;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function catalogManifestDigest(catalog: FashionStoreLiveCatalog): string {
  validateFashionStoreLiveCatalog(catalog);
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(canonicalize(catalog))).digest("hex");
}

export function createFashionStoreLiveCatalogMigrationPlan(
  catalog: FashionStoreLiveCatalog,
  options: {
    expectedIamFingerprint: string;
    mediaPublicOrigin: string;
    storefrontOrigin: string;
  },
): FashionStoreLiveCatalogMigrationPlan {
  validateFashionStoreLiveCatalog(catalog);
  assert(/^[a-f0-9]{64}$/.test(options.expectedIamFingerprint), "IAM fingerprint must be SHA-256");
  const generatedAt = "2026-09-13T00:00:00.000Z";
  const mediaOrigin = options.mediaPublicOrigin.replace(/\/$/, "");
  const shopperProducts = catalog.products.map((product) => ({
    collectionIds: [catalog.collection.id],
    collectionSlugs: [catalog.collection.slug],
    description: product.description,
    id: product.id,
    media: [...product.media]
      .sort((left, right) => left.order - right.order)
      .map((media) => ({
        alt: media.alt,
        height: media.height,
        src: `${mediaOrigin}/${media.r2Key}`,
        width: media.width,
      })),
    name: product.name,
    seoDescription: product.description,
    seoTitle: `${product.name} | Shoppp`,
    slug: product.slug,
    status: product.status,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      optionValues: variant.optionValues,
      prices: [variant.price],
      sku: variant.sku,
      status: variant.status,
      title: variant.title,
      weightGrams: variant.weightGrams ?? 0,
    })),
  }));
  const shopperRelease = canonicalCatalogReleaseSchema.parse({
    collections: [
      {
        description: "The complete Fashion Store live collection.",
        id: catalog.collection.id,
        name: catalog.collection.name,
        productIds: shopperProducts.map(({ id }) => id),
        productSlugs: shopperProducts.map(({ slug }) => slug),
        seoDescription: "Shop the complete Fashion Store collection.",
        seoTitle: "Fashion Store | Shoppp",
        slug: catalog.collection.slug,
        status: "published",
      },
    ],
    generatedAt,
    policies: releaseFixture.policies,
    products: shopperProducts,
    redirects: [],
    releaseId: `${catalog.catalogVersion}-shopper-release`,
    routes: [
      "/",
      `/collections/${catalog.collection.slug}`,
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
      ...shopperProducts.map(({ slug }) => `/products/${slug}`),
    ],
    schemaVersion: 2,
    site: {
      ...releaseFixture.site,
      origin: options.storefrontOrigin,
    },
  });
  const acceptanceProduct = {
    id: "prod_01JFS8UNAVAILABLE0000001",
    slug: "fashion-staging-unavailable-private",
    variantId: "var_01JFS8UNAVAILABLE00000001",
    sku: "FS-ACCEPTANCE-UNAVAILABLE",
  };
  const acceptanceRelease = canonicalCatalogReleaseSchema.parse({
    ...shopperRelease,
    collections: [],
    products: [
      {
        collectionIds: [],
        collectionSlugs: [],
        description: "Protected unavailable-product acceptance identity.",
        id: acceptanceProduct.id,
        media: [shopperProducts[0]!.media[0]!],
        name: "Unavailable acceptance product",
        seoDescription: "Protected Fashion staging acceptance identity.",
        seoTitle: "Unavailable acceptance product | Shoppp",
        slug: acceptanceProduct.slug,
        status: "published",
        variants: [
          {
            id: acceptanceProduct.variantId,
            optionValues: { state: "unavailable" },
            prices: [{ amount: 100, currency: "USD" }],
            sku: acceptanceProduct.sku,
            status: "active",
            title: "Unavailable",
            weightGrams: 0,
          },
        ],
      },
    ],
    releaseId: `${catalog.catalogVersion}-acceptance-release`,
    routes: [`/products/${acceptanceProduct.slug}`],
  });
  const manifestDigest = catalogManifestDigest(catalog);
  return {
    acceptanceRelease,
    applyInput: {
      acceptanceProduct,
      acceptanceRelease,
      catalog,
      environment: "fashion-staging",
      expectedIamFingerprint: options.expectedIamFingerprint,
      manifestDigest,
      shopperRelease,
      target: FASHION_STORE_LIVE_CATALOG_RESET_TARGET,
    },
    mediaUploads: catalog.products.flatMap((product) =>
      product.media.map(({ mimeType, r2Key, sha256, sourcePath }) => ({
        contentType: mimeType,
        r2Key,
        sha256,
        sourcePath,
      })),
    ),
    shopperRelease,
  };
}

if (import.meta.main) {
  const repositoryRoot = resolve(import.meta.dir, "..");
  const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
  const argument = (name: string) =>
    process.argv
      .slice(2)
      .find((value) => value.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const outputDirectory = argument("output-dir");
  if (outputDirectory) {
    const expectedIamFingerprint = argument("expected-iam-fingerprint");
    const mediaPublicOrigin = argument("media-public-origin");
    const storefrontOrigin = argument("storefront-origin");
    if (!expectedIamFingerprint || !mediaPublicOrigin || !storefrontOrigin) {
      throw new Error(
        "Migration output requires --expected-iam-fingerprint, --media-public-origin, and --storefront-origin",
      );
    }
    const plan = createFashionStoreLiveCatalogMigrationPlan(catalog, {
      expectedIamFingerprint,
      mediaPublicOrigin,
      storefrontOrigin,
    });
    const target = resolve(outputDirectory);
    await mkdir(target, { recursive: true });
    await Promise.all([
      writeFile(
        resolve(target, "apply-request.json"),
        `${JSON.stringify(plan.applyInput, null, 2)}\n`,
      ),
      writeFile(
        resolve(target, "media-upload-plan.json"),
        `${JSON.stringify(plan.mediaUploads, null, 2)}\n`,
      ),
      writeFile(
        resolve(target, "shopper-release.json"),
        `${JSON.stringify(plan.shopperRelease, null, 2)}\n`,
      ),
      writeFile(
        resolve(target, "acceptance-release.json"),
        `${JSON.stringify(plan.acceptanceRelease, null, 2)}\n`,
      ),
    ]);
  }
  console.log(
    JSON.stringify({
      catalogVersion: catalog.catalogVersion,
      digest: catalogManifestDigest(catalog),
      media: catalog.products.flatMap((product) => product.media).length,
      products: catalog.products.length,
      skus: catalog.products.flatMap((product) => product.variants).length,
    }),
  );
}
