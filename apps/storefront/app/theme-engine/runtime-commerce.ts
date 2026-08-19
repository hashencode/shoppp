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
  options: Readonly<Record<string, string>>;
}

export interface RuntimeProductState {
  availability: RuntimeAvailability;
  id: string;
  media: Product["media"];
  optionGroups: Product["options"];
  slug: string;
  variants: RuntimeProductVariant[];
}

export type RuntimeProductSelection =
  | { missingGroups: string[]; status: "incomplete" }
  | { status: "selected"; variant: RuntimeProductVariant }
  | { status: "unavailable"; variant?: RuntimeProductVariant };

export interface RuntimeProductRequest {
  currency: string;
  productId: string;
  slug: string;
}

export interface RuntimeCommercePort {
  revalidateProduct(input: RuntimeProductRequest): Promise<RuntimeProductState>;
}

export function coalesceRuntimeCommerceRevalidations(
  port: RuntimeCommercePort,
): RuntimeCommercePort {
  const flights = new Map<string, Promise<RuntimeProductState>>();
  return {
    async revalidateProduct(input) {
      const key = `${input.productId}\u0000${input.slug}\u0000${input.currency}`;
      const existing = flights.get(key);
      if (existing) return existing;
      const request = port.revalidateProduct(input);
      flights.set(key, request);
      try {
        return await request;
      } finally {
        if (flights.get(key) === request) flights.delete(key);
      }
    },
  };
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
      options: variant.options,
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
    media: product.media,
    optionGroups: product.options,
    slug: product.slug,
    variants,
  };
}

function variantMatchesSelection(
  variant: RuntimeProductVariant,
  selection: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(selection).every(([name, value]) => variant.options[name] === value);
}

export function resolveRuntimeProductSelection(
  product: RuntimeProductState,
  selection: Readonly<Record<string, string>>,
): RuntimeProductSelection {
  const missingGroups = product.optionGroups
    .map(({ name }) => name)
    .filter((name) => !selection[name]);
  if (missingGroups.length > 0) return { missingGroups, status: "incomplete" };
  const variant = product.variants.find((candidate) =>
    variantMatchesSelection(candidate, selection),
  );
  if (!variant || variant.availability !== "in-stock") {
    return { status: "unavailable", ...(variant ? { variant } : {}) };
  }
  return { status: "selected", variant };
}

export function isRuntimeOptionValueAvailable(
  product: RuntimeProductState,
  selection: Readonly<Record<string, string>>,
  groupName: string,
  value: string,
): boolean {
  const groupIndex = product.optionGroups.findIndex(({ name }) => name === groupName);
  if (groupIndex < 0) {
    const candidateSelection = { ...selection, [groupName]: value };
    return product.variants.some(
      (variant) =>
        variant.availability === "in-stock" && variantMatchesSelection(variant, candidateSelection),
    );
  }
  return product.variants.some(
    (variant) =>
      variant.availability === "in-stock" &&
      variant.options[groupName] === value &&
      product.optionGroups.every(({ name }, index) => {
        const selectedValue = selection[name];
        return index >= groupIndex || !selectedValue || variant.options[name] === selectedValue;
      }),
  );
}

export function selectRuntimeProductOption(
  product: RuntimeProductState,
  selection: Readonly<Record<string, string>>,
  groupName: string,
  value: string,
): Record<string, string> {
  const groupIndex = product.optionGroups.findIndex(({ name }) => name === groupName);
  if (groupIndex < 0) return { ...selection, [groupName]: value };
  return Object.fromEntries([
    ...product.optionGroups
      .slice(0, groupIndex)
      .flatMap(({ name }) => (selection[name] ? [[name, selection[name]!] as const] : [])),
    [groupName, value],
  ]);
}

export async function verifyProductCartAdd(
  port: RuntimeCommercePort,
  request: RuntimeProductRequest,
  preferredVariantId: string,
  quantity: number,
): Promise<VerifiedCartAdd | null> {
  const product = await port.revalidateProduct(request);
  if (product.availability !== "in-stock") return null;
  const variant = product.variants.find(({ id }) => id === preferredVariantId);
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
