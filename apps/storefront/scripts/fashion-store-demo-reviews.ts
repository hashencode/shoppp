import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { productReviewDisplaySchema, type ProductReviewDisplay } from "@shoppp/contracts";

interface DemoCatalogProduct {
  id: string;
  name: string;
  slug: string;
}

const demoRatings = [5, 4, 3, 2] as const;

export async function fashionStoreDemoReviewDisplays(): Promise<Map<string, ProductReviewDisplay>> {
  const manifestName =
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG === "1"
      ? "fashion-store-product-content-catalog.json"
      : "fashion-store-live-catalog.json";
  const manifest = JSON.parse(
    await readFile(resolve(import.meta.dir, `../../../tools/${manifestName}`), "utf8"),
  ) as { products: DemoCatalogProduct[] };
  if (
    manifest.products.length !== 13 ||
    new Set(manifest.products.map(({ slug }) => slug)).size !== 13
  ) {
    throw new Error("Fashion demo review fixture requires 13 distinct sample Products.");
  }
  return new Map(
    manifest.products.map((product, productIndex) => {
      const ratingBands: [number, number, number, number, number] = [0, 0, 0, 0, 0];
      const entries = demoRatings.map((seed, reviewIndex) => {
        const rating = ((seed + productIndex) % 5) + 1;
        ratingBands[rating - 1]! += 1;
        return {
          author: `Demo reviewer ${reviewIndex + 1}`,
          date: "2026-09-17",
          id: `demo_${String(productIndex * demoRatings.length + reviewIndex + 1).padStart(24, "0")}`,
          rating,
          text: `Demonstration review ${reviewIndex + 1} for ${product.name}. This is sample content, not a customer submission.`,
        };
      });
      return [
        product.slug,
        productReviewDisplaySchema.parse({
          averageRating:
            Math.round(
              (entries.reduce((sum, entry) => sum + entry.rating, 0) * 10) / entries.length,
            ) / 10,
          count: entries.length,
          entries,
          provenance: "local-demonstration-only",
          ratingBands,
          updatedAt: "2026-09-17T00:00:00.000Z",
        }),
      ];
    }),
  );
}
