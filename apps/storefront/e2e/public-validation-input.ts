import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { experienceBuildInputSchema } from "../scripts/experience-build-input";

export function readPublicValidationInput(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.STOREFRONT_BUILD_MODE !== "public") return undefined;
  const path = environment.STOREFRONT_EXPERIENCE_FILE;
  if (!path) throw new Error("Public artifact validation requires STOREFRONT_EXPERIENCE_FILE.");
  const input = experienceBuildInputSchema.parse(JSON.parse(readFileSync(resolve(path), "utf8")));
  if (input.environment !== "public") {
    throw new Error("Public artifact validation requires the approved public build input.");
  }
  const products = input.catalogRelease.products.filter(
    (product) =>
      product.status === "published" &&
      product.variants.some((variant) => variant.status === "active"),
  );
  const product = products[0];
  if (!product) throw new Error("Public artifact validation requires a published product.");
  const productPath = `/products/${product.slug}`;
  return {
    input,
    product,
    productPath,
    canonicalUrl: new URL(productPath, input.catalogRelease.site.origin).href,
    criticalRoutes: ["/", "/shop", productPath, "/cart", "/checkout", "/magazine"],
  };
}
