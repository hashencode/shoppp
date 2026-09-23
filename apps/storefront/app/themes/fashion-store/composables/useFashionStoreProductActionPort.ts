import { recordPreviewIntent, storefrontActionAdapterKey } from "../../../theme-engine/actions";
import type { ComputedRef } from "vue";
import { submitProductReviewSchema } from "@shoppp/contracts";
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
  type FashionStoreProductReviewInput,
} from "../contracts/product-card";
import { useFashionStorePreviewCart } from "./useFashionStorePreviewCart";

export function normalizeFashionStoreRuntimeProductState(
  product: RuntimeProductState,
  presentation: FashionStoreProductPresentation,
): FashionStoreProductRuntimeState {
  if (product.id !== presentation.productId || product.slug !== presentation.slug) {
    throw new Error("Commerce Product identity does not match the released Product.");
  }
  const commerceVariants = new Map(product.variants.map((variant) => [variant.id, variant]));
  const variants = presentation.variants.map((releasedVariant) => {
    const commerceVariant = commerceVariants.get(releasedVariant.id);
    if (!commerceVariant) return { ...releasedVariant, availability: "out-of-stock" as const };
    if (commerceVariant.money.currency !== presentation.currency) {
      throw new Error("Commerce Variant currency does not match the released Product currency.");
    }
    return {
      ...releasedVariant,
      availability: commerceVariant.availability,
      compareAtPriceLabel: commerceVariant.money.compareAtAmount
        ? formatCommerceMoney(commerceVariant.money.compareAtAmount, commerceVariant.money.currency)
        : undefined,
      priceLabel: formatCommerceMoney(commerceVariant.money.amount, commerceVariant.money.currency),
    };
  });
  return {
    availability:
      product.availability === "unavailable"
        ? "unavailable"
        : variants.some(({ availability }) => availability === "in-stock")
          ? "in-stock"
          : "out-of-stock",
    variants,
  };
}

export function validateFashionStoreProductReview(input: {
  body: string;
  consentAccepted: boolean;
  displayName: string;
  email: string;
  rating: number;
}): Partial<Record<"rating" | "name" | "email" | "body" | "consent", string>> {
  const errors: Partial<Record<"rating" | "name" | "email" | "body" | "consent", string>> = {};
  if (!submitProductReviewSchema.shape.rating.safeParse(input.rating).success)
    errors.rating = "Choose a rating from 1 to 5 stars.";
  if (!submitProductReviewSchema.shape.displayName.safeParse(input.displayName).success)
    errors.name = "Enter a name of 2 to 80 characters.";
  if (!submitProductReviewSchema.shape.email.safeParse(input.email).success)
    errors.email = "Enter a valid email address.";
  if (!submitProductReviewSchema.shape.body.safeParse(input.body).success)
    errors.body = "Write a review of 10 to 2,000 characters.";
  if (!submitProductReviewSchema.shape.consentAccepted.safeParse(input.consentAccepted).success)
    errors.consent = "Accept the terms and privacy policy before submitting.";
  return errors;
}

export function useFashionStoreProductActionPort(
  presentation: ComputedRef<FashionStoreProductPresentation>,
): FashionStoreProductActionPort {
  const provided = inject(fashionStoreProductActionPortKey, null);
  if (provided) return provided;

  const runtimeCommerce = inject(runtimeCommercePortKey, null);
  const actionAdapter = inject(storefrontActionAdapterKey, null);
  const previewCart = useFashionStorePreviewCart();
  const commerceApi = useCommerceApi();

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
        return normalizeFashionStoreRuntimeProductState(product, presentation.value);
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
      async submitReview(input, idempotencyKey) {
        await commerceApi.submitProductReview(presentation.value.slug, input, idempotencyKey);
        return {
          message: "Your review was saved and is awaiting moderation. It is not public yet.",
        };
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
    async submitReview(_input: FashionStoreProductReviewInput, _idempotencyKey: string) {
      return { message: "Preview review was not submitted." };
    },
  };
}
