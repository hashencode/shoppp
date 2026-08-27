import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import baseRelease from "../apps/storefront/fixtures/release.json";

const ROOT = resolve(import.meta.dir, "..");
const STOREFRONT = resolve(ROOT, "apps/storefront");
const PRODUCT_COUNT = 1_000;
const VARIANT_COUNT = 5_000;
const TARGET_DURATION_MS = 10 * 60 * 1_000;
const FAILURE_DURATION_MS = 15 * 60 * 1_000;

function padded(value: number): string {
  return String(value).padStart(4, "0");
}

export function representativeCatalog() {
  const collectionCount = 20;
  const collections = Array.from({ length: collectionCount }, (_, index) => {
    const number = padded(index + 1);
    return {
      ...baseRelease.collections[0],
      description: `Representative collection ${number} for static release capacity verification.`,
      id: `col_${number.padStart(23, "0")}`,
      name: `Representative collection ${number}`,
      productIds: [] as string[],
      productSlugs: [] as string[],
      seoDescription: `Representative collection ${number} static generation fixture.`,
      seoTitle: `Representative collection ${number} | Shoppp`,
      slug: `collection-${number}`,
    };
  });
  const products = Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const productNumber = padded(index + 1);
    const collection = collections[index % collectionCount]!;
    const slug = `product-${productNumber}`;
    const id = `prod_${String(index + 1).padStart(23, "0")}`;
    collection.productIds.push(id);
    collection.productSlugs.push(slug);
    return {
      ...baseRelease.products[0],
      collectionIds: [collection.id],
      collectionSlugs: [collection.slug],
      description: `Representative product ${productNumber} used to verify full static catalog generation.`,
      id,
      name: `Representative product ${productNumber}`,
      seoDescription: `Representative product ${productNumber} static catalog capacity fixture.`,
      seoTitle: `Representative product ${productNumber} | Shoppp`,
      slug,
      variants: Array.from({ length: 5 }, (_, variantIndex) => ({
        ...baseRelease.products[0]!.variants[0]!,
        id: `var_${String(index * 5 + variantIndex + 1).padStart(23, "0")}`,
        optionValues: { color: `Color ${variantIndex + 1}` },
        sku: `SKU-${productNumber}-${variantIndex + 1}`,
        title: `Color ${variantIndex + 1}`,
      })),
    };
  });
  return {
    ...baseRelease,
    collections,
    products,
    redirects: [{ from: "/products/legacy-product", status: 301, to: "/products/product-0001" }],
    releaseId: "representative-scale-1000x5000",
    routes: [
      "/",
      ...collections.map(({ slug }) => `/collections/${slug}`),
      ...baseRelease.policies.map(({ slug }) => `/policies/${slug}`),
      ...products.map(({ slug }) => `/products/${slug}`),
    ].sort((left, right) => (left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right))),
  };
}

interface RunOptions {
  environment?: Record<string, string>;
  quiet?: boolean;
}

export function catalogFixtureEnvironment(fixturePath: string): Record<string, string> {
  return {
    NUXT_CATALOG_RELEASE_FILE: fixturePath,
    NUXT_CATALOG_RELEASE_TOKEN: "",
    NUXT_CATALOG_RELEASE_URL: "",
  };
}

async function run(command: string[], options: RunOptions = {}): Promise<void> {
  const child = Bun.spawn(command, {
    cwd: ROOT,
    env: { ...process.env, ...options.environment },
    stderr: "inherit",
    stdin: "inherit",
    stdout: options.quiet ? "ignore" : "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed with exit code ${exitCode}.`);
}

export async function restoreCatalogScaleSelection(
  runner: (command: string[], options?: RunOptions) => Promise<void> = run,
): Promise<void> {
  await runner(["bun", "run", "--cwd", "apps/storefront", "prepare:release"]);
  await runner(["bun", "run", "--cwd", "apps/storefront", "prepare:experience"]);
}

async function verifyOutput(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(STOREFRONT, "app/generated/route-manifest.json"), "utf8"),
  ) as { routes: string[] };
  const productRoutes = manifest.routes.filter((route) => route.startsWith("/products/"));
  const collectionRoutes = manifest.routes.filter((route) => route.startsWith("/collections/"));
  if (productRoutes.length !== PRODUCT_COUNT || collectionRoutes.length !== 20) {
    throw new Error(
      `Representative manifest contains ${productRoutes.length} products and ${collectionRoutes.length} collections.`,
    );
  }
  await Promise.all(
    [productRoutes[0], productRoutes.at(-1), collectionRoutes[0], collectionRoutes.at(-1)].map(
      async (route) => {
        if (!route) throw new Error("Representative route sample is missing.");
        await readFile(resolve(STOREFRONT, ".output/public", route.slice(1), "index.html"), "utf8");
      },
    ),
  );
}

if (import.meta.main) {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-catalog-scale-"));
  const fixturePath = resolve(temporaryRoot, "release.json");
  const fixture = representativeCatalog();
  const variantCount = fixture.products.reduce(
    (count, product) => count + product.variants.length,
    0,
  );
  if (fixture.products.length !== PRODUCT_COUNT || variantCount !== VARIANT_COUNT) {
    throw new Error("Representative fixture does not satisfy the 1,000/5,000 contract.");
  }
  await writeFile(fixturePath, `${JSON.stringify(fixture)}\n`);
  const startedAt = performance.now();
  try {
    await run(["bun", "run", "--cwd", "apps/storefront", "build"], {
      environment: catalogFixtureEnvironment(fixturePath),
      quiet: true,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs > FAILURE_DURATION_MS) {
      throw new Error(`Representative catalog generation took ${durationMs}ms; limit is 900000ms.`);
    }
    if (durationMs > TARGET_DURATION_MS) {
      console.warn(
        `Representative catalog generation missed the ten-minute target: ${durationMs}ms.`,
      );
    }
    await verifyOutput();
    await run(["bun", "run", "--cwd", "apps/storefront", "verify:static"], {
      environment: catalogFixtureEnvironment(fixturePath),
    });
    await run(["bun", "run", "--cwd", "apps/storefront", "test:perf"], {
      environment: catalogFixtureEnvironment(fixturePath),
    });
    console.log(
      `Representative catalog passed: ${PRODUCT_COUNT} products, ${VARIANT_COUNT} variants, ${durationMs}ms.`,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
    await restoreCatalogScaleSelection();
  }
}
