<script setup lang="ts">
import { storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontCartStateKey } from "../../../../theme-engine/cart-state";
import {
  formatCommerceMoney,
  runtimeCommercePortKey,
  verifyProductCartAdd,
} from "../../../../theme-engine/runtime-commerce";
import type { PresentationProductCard } from "../../../../theme-engine/view-models";
import { fashionStoreLiveCapabilities } from "../../capability-matrix";
import type { FashionStoreLegacyProductCard } from "../../contracts/product-card";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";

const properties = withDefaults(
  defineProps<{
    context?: "catalog" | "wishlist";
    product: FashionStoreLegacyProductCard | PresentationProductCard;
    resolveAsset: ThemeAssetResolver;
  }>(),
  { context: "catalog" },
);

const emit = defineEmits<{
  intent: [kind: "cart" | "quickView" | "wishlist"];
}>();

const actionAdapter = inject(storefrontActionAdapterKey);
const cartState = inject(storefrontCartStateKey);
const runtimeCommerce = inject(runtimeCommercePortKey);
const liveProduct = computed(() => "staticPurchase" in properties.product);
const liveCard = computed(() =>
  liveProduct.value ? (properties.product as PresentationProductCard) : undefined,
);
const actionState = ref<PresentationProductCard["actionState"]["kind"]>(
  liveCard.value?.actionState.kind ?? "available",
);
const statusMessage = ref(
  liveCard.value?.actionState.message ?? "Fixture preview action is available.",
);
const runtimePriceLabel = ref<string>();

const card = computed(() => {
  if (liveCard.value) {
    return {
      alt: liveCard.value.media?.alt ?? liveCard.value.name,
      badge: undefined,
      href: liveCard.value.href,
      id: liveCard.value.productId,
      image: liveCard.value.media?.src,
      name: liveCard.value.name,
      originalPrice: "",
      price: runtimePriceLabel.value ?? liveCard.value.priceLabel,
    };
  }
  const product = properties.product as FashionStoreLegacyProductCard;
  return {
    alt: product.name,
    badge: product.badge,
    href: fashionStoreRoutePaths.product,
    id: product.id,
    image: properties.resolveAsset(fashionStoreAssetId(product.sourceImage)),
    name: product.name,
    originalPrice: product.originalPrice,
    price: product.price,
  };
});

const cardVariant = computed(() => liveCard.value?.visualVariant ?? "default");
const wishlistContext = computed(() => properties.context === "wishlist");
const directPurchase = computed(() => {
  const purchase = liveCard.value?.staticPurchase;
  return purchase?.kind === "direct-add" ? purchase : undefined;
});
const directActionLabel = computed(() => {
  switch (actionState.value) {
    case "loading":
      return "Checking availability…";
    case "pending":
      return "Adding…";
    case "retry":
      return "Retry add to cart";
    case "succeeded":
      return "Added";
    case "unavailable":
      return "Unavailable";
    default:
      return directPurchase.value?.label ?? "Add to cart";
  }
});

async function addToCart(): Promise<void> {
  const product = liveCard.value;
  const purchase = directPurchase.value;
  if (!product || !purchase) {
    emit("intent", "cart");
    return;
  }
  if (!runtimeCommerce || !actionAdapter) {
    actionState.value = "retry";
    statusMessage.value = "The item was not added. Try again when Commerce is available.";
    return;
  }
  actionState.value = "pending";
  statusMessage.value = "Checking current availability before adding…";
  try {
    const verified = await verifyProductCartAdd(
      runtimeCommerce,
      { currency: product.currency, productId: product.productId, slug: product.slug },
      purchase.variantId,
      1,
    );
    if (!verified) {
      actionState.value = "unavailable";
      statusMessage.value = "This product is currently unavailable and was not added.";
      return;
    }
    await actionAdapter({
      context: "fashion-store.product-card.cart",
      currency: verified.input.expectedUnitPrice.currency,
      input: verified.input,
      kind: "cart.add",
    });
    runtimePriceLabel.value = formatCommerceMoney(
      verified.input.expectedUnitPrice.amount,
      verified.input.expectedUnitPrice.currency,
    );
    actionState.value = "succeeded";
    statusMessage.value = `${product.name} was added to your cart.`;
  } catch {
    actionState.value = "retry";
    statusMessage.value = "The item was not added. Review any changes and try again.";
  }
}

watch(
  () => cartState?.value,
  (cart) => {
    if (!cart) return;
    const purchase = directPurchase.value;
    if (
      actionState.value === "succeeded" &&
      purchase &&
      !cart.lines.some(({ variantId }) => variantId === purchase.variantId)
    ) {
      actionState.value = "available";
      statusMessage.value = `${liveCard.value?.name ?? "Item"} was removed from your cart and can be added again.`;
    }
  },
);
</script>

<template>
  <li
    class="grid-item"
    data-fashion-store-product-card
    :data-action-state="liveProduct ? actionState : undefined"
    :data-card-variant="cardVariant"
    :data-product-id="card.id"
  >
    <div class="shop-box mb-10px">
      <div class="shop-image mb-20px">
        <a :href="card.href" data-fashion-store-route>
          <img v-if="card.image" :src="card.image" :alt="card.alt" width="600" height="765" />
          <span v-else class="fashion-store-product-placeholder" aria-hidden="true"></span>
          <span v-if="card.badge" class="lable" :class="card.badge.toLowerCase()">{{
            card.badge
          }}</span>
          <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
        </a>
        <div class="shop-buttons-wrap">
          <button
            v-if="!liveProduct"
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            :class="{ 'fashion-wishlist-add': wishlistContext }"
            aria-label="Add to cart"
            @click="addToCart"
          >
            <i class="feather icon-feather-shopping-bag"></i
            ><span class="quick-view-text button-text">Add to cart</span>
          </button>
          <button
            v-else-if="directPurchase"
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            :aria-label="directActionLabel"
            :disabled="
              actionState === 'loading' ||
              actionState === 'pending' ||
              actionState === 'unavailable' ||
              actionState === 'succeeded'
            "
            @click="addToCart"
          >
            <i class="feather icon-feather-shopping-bag"></i
            ><span class="quick-view-text button-text">{{ directActionLabel }}</span>
          </button>
          <a
            v-else
            :href="card.href"
            data-fashion-store-route
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
          >
            <span class="quick-view-text button-text">{{
              liveCard?.staticPurchase.kind === "choose-options"
                ? liveCard.staticPurchase.label
                : "Choose options"
            }}</span>
          </a>
        </div>
        <div
          v-if="
            !liveProduct ||
            fashionStoreLiveCapabilities.wishlist ||
            fashionStoreLiveCapabilities.productQuickView
          "
          class="shop-hover d-flex justify-content-center"
        >
          <ul>
            <li v-if="!liveProduct || fashionStoreLiveCapabilities.wishlist">
              <button
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                :class="{ 'fashion-wishlist-remove': wishlistContext }"
                :aria-label="
                  wishlistContext ? `Remove ${card.name} from wishlist` : 'Add to wishlist'
                "
                :title="wishlistContext ? 'Remove from wishlist' : 'Add to wishlist'"
                @click="$emit('intent', 'wishlist')"
              >
                <i class="feather icon-feather-heart fs-16"></i>
              </button>
            </li>
            <li v-if="!liveProduct || fashionStoreLiveCapabilities.productQuickView">
              <a
                v-if="liveProduct || wishlistContext"
                :href="card.href"
                data-fashion-store-route
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                :aria-label="wishlistContext ? `View ${card.name}` : 'View product details'"
                :title="wishlistContext ? 'View product' : 'View product details'"
              >
                <i class="feather icon-feather-eye fs-16"></i>
              </a>
              <button
                v-else
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                aria-label="Quick shop"
                title="Quick shop"
                @click="$emit('intent', 'quickView')"
              >
                <i class="feather icon-feather-eye fs-16"></i>
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div class="shop-footer text-center">
        <a
          :href="card.href"
          data-fashion-store-route
          class="alt-font text-dark-gray fs-19 fw-500"
          >{{ card.name }}</a
        >
        <div class="price lh-22 fs-16 text-dark-gray">
          <del>{{ card.originalPrice }}</del
          >{{ card.price }}
        </div>
        <p
          v-if="liveProduct"
          class="sr-only"
          :role="actionState === 'retry' ? 'alert' : 'status'"
          aria-live="polite"
        >
          {{ statusMessage }}
        </p>
      </div>
    </div>
  </li>
</template>
