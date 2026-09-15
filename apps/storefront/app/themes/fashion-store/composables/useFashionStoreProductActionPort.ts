import { recordPreviewIntent, storefrontActionAdapterKey } from "../../../theme-engine/actions";
import type { ComputedRef } from "vue";
import {
  formatCommerceMoney,
  runtimeCommercePortKey,
  verifyProductCartAdd,
  type RuntimeProductState,
} from "../../../theme-engine/runtime-commerce";
import {
  fashionStoreProductActionPortKey,
  type FashionStoreProductActionInput,
  type FashionStoreProductActionPort,
  type FashionStoreProductPresentation,
  type FashionStoreProductRuntimeState,
} from "../contracts/product-card";
import { useFashionStorePreviewCart } from "./useFashionStorePreviewCart";

export function normalizeFashionStoreRuntimeProductState(
  product: RuntimeProductState,
): FashionStoreProductRuntimeState {
  return {
    availability: product.availability,
    gallery: product.media.map((item) => ({ ...item, kind: "url" as const })),
    optionGroups: product.optionGroups,
    variants: product.variants.map((variant) => ({
      availability: variant.availability,
      compareAtPriceLabel: variant.money.compareAtAmount
        ? formatCommerceMoney(variant.money.compareAtAmount, variant.money.currency)
        : undefined,
      id: variant.id,
      label: variant.label,
      optionValues: { ...variant.options },
      priceLabel: formatCommerceMoney(variant.money.amount, variant.money.currency),
      selected: false,
      sku: variant.sku,
    })),
  };
}

export function useFashionStoreProductActionPort(
  presentation: ComputedRef<FashionStoreProductPresentation>,
): FashionStoreProductActionPort {
  const provided = inject(fashionStoreProductActionPortKey, null);
  if (provided) return provided;

  const runtimeCommerce = inject(runtimeCommercePortKey, null);
  const actionAdapter = inject(storefrontActionAdapterKey, null);
  const previewCart = useFashionStorePreviewCart();

  if (runtimeCommerce && actionAdapter) {
    return {
      authoritative: true,
      perform() {},
      async revalidate() {
        const product = await runtimeCommerce.revalidateProduct({
          currency: presentation.value.currency,
          productId: presentation.value.productId,
          slug: presentation.value.slug,
        });
        return normalizeFashionStoreRuntimeProductState(product);
      },
      async addToCart(input) {
        const verified = await verifyProductCartAdd(
          runtimeCommerce,
          { currency: input.currency, productId: input.productId, slug: input.slug },
          input.variantId,
          input.quantity,
        );
        if (!verified) {
          return {
            kind: "unavailable",
            message: "This product or variant is currently unavailable.",
          };
        }
        try {
          await actionAdapter({
            context: "fashion-store.product.cart",
            currency: verified.input.expectedUnitPrice.currency,
            input: verified.input,
            kind: "cart.add",
          });
          return {
            kind: "succeeded",
            message: `${input.productName} was added to your cart.`,
            priceLabel: formatCommerceMoney(
              verified.input.expectedUnitPrice.amount,
              verified.input.expectedUnitPrice.currency,
            ),
          };
        } catch {
          return {
            kind: "failed",
            message: "The item was not added. Review any changes and try again.",
          };
        }
      },
    };
  }

  return {
    authoritative: false,
    perform(input) {
      recordPreviewIntent(
        {
          id: `product-${input.role}`,
          intent: input.role === "wishlist" ? "wishlist.toggle-preview" : "navigation",
          label: input.label,
          ...(input.role === "wishlist"
            ? {}
            : { target: input.role === "question" ? "/contact" : "/shop" }),
        },
        `fashion-store.product.${input.role}`,
      );
    },
    async revalidate() {
      return null;
    },
    async addToCart(input: FashionStoreProductActionInput) {
      recordPreviewIntent(
        { id: "product-add-cart", intent: "cart.add-preview", label: "Add to cart" },
        "fashion-store.product.cart",
      );
      previewCart.add({
        color: Object.values(input.optionValues).join(" / "),
        name: input.productName,
        price: input.priceLabel,
        quantity: input.quantity,
        sourceImage: input.media?.kind === "theme-asset" ? input.media.path : "",
        total: input.priceLabel,
        variantId: input.variantId,
      });
      return { kind: "succeeded", message: `${input.productName} was added to your preview cart.` };
    },
  };
}
