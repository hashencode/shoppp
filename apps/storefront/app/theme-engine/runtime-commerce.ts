import {
  MAX_CART_LINE_QUANTITY,
  type PresentationAvailability,
  type Product,
} from "@shoppp/contracts";
import type { InjectionKey } from "vue";

export type RuntimeAvailability = Exclude<PresentationAvailability, "unknown">;
type ProductPrice = Product["variants"][number]["price"];

export interface RuntimeProductVariant {
  availability: Exclude<RuntimeAvailability, "unavailable">;
  id: string;
  label: string;
  money: ProductPrice;
}

export interface RuntimeProductState {
  availability: RuntimeAvailability;
  id: string;
  slug: string;
  variants: RuntimeProductVariant[];
}

export interface RuntimeProductRequest {
  currency: string;
  productId: string;
  slug: string;
}

export interface RuntimeCommercePort {
  revalidateProduct(input: RuntimeProductRequest): Promise<RuntimeProductState>;
}

export interface VerifiedCartAdd {
  input: {
    expectedUnitPrice: ProductPrice;
    quantity: number;
    variantId: string;
  };
  product: RuntimeProductState;
  variantId: string;
}

export class CommerceCurrencyUnavailableError extends Error {
  constructor(currency: string) {
    super(`Commerce did not return product pricing in ${currency}.`);
    this.name = "CommerceCurrencyUnavailableError";
  }
}

function variantLabel(options: Readonly<Record<string, string>>): string {
  return Object.entries(options)
    .map(([name, value]) => `${name}: ${value}`)
    .join(" · ");
}

export function formatCommerceMoney(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(amount / 100);
}

export function toRuntimeProductState(product: Product, currency: string): RuntimeProductState {
  const variants = product.variants.map((variant) => {
    if (variant.price.currency !== currency) throw new CommerceCurrencyUnavailableError(currency);
    return {
      availability: variant.available ? "in-stock" : "out-of-stock",
      id: variant.id,
      label: variantLabel(variant.options) || variant.sku,
      money: variant.price,
    } satisfies RuntimeProductVariant;
  });
  const productPublished = product.status === "published";
  return {
    availability: !productPublished
      ? "unavailable"
      : variants.some(({ availability }) => availability === "in-stock")
        ? "in-stock"
        : "out-of-stock",
    id: product.id,
    slug: product.slug,
    variants,
  };
}

export async function verifyProductCartAdd(
  port: RuntimeCommercePort,
  request: RuntimeProductRequest,
  preferredVariantId: string,
  quantity: number,
): Promise<VerifiedCartAdd | null> {
  const product = await port.revalidateProduct(request);
  if (product.availability !== "in-stock") return null;
  const variant =
    product.variants.find(({ id }) => id === preferredVariantId) ?? product.variants[0];
  if (!variant || variant.availability !== "in-stock") return null;
  return {
    input: {
      expectedUnitPrice: variant.money,
      quantity: Math.min(MAX_CART_LINE_QUANTITY, Math.max(1, Math.floor(quantity || 1))),
      variantId: variant.id,
    },
    product,
    variantId: variant.id,
  };
}

export const runtimeCommercePortKey = Symbol(
  "runtime-commerce-port",
) as InjectionKey<RuntimeCommercePort>;
export const liveCommerceModeKey = Symbol("live-commerce-mode") as InjectionKey<boolean>;
