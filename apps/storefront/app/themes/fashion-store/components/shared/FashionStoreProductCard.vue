<script setup lang="ts">
import FashionStoreTooltip from "./FashionStoreTooltip.vue";
import FashionStoreIcon from "./FashionStoreIcon.vue";
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
import type {
  FashionStoreLegacyProductCard,
  FashionStoreProductCardPresentation,
} from "../../contracts/product-card";
import { useFashionStorePreviewCart } from "../../composables/useFashionStorePreviewCart";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";

const properties = withDefaults(
  defineProps<{
    context?: "catalog" | "wishlist";
    surface?: "catalog" | "home-merchandising";
    product:
      FashionStoreLegacyProductCard | FashionStoreProductCardPresentation | PresentationProductCard;
    resolveAsset: ThemeAssetResolver;
  }>(),
  { context: "catalog", surface: "catalog" },
);

const emit = defineEmits<{
  intent: [kind: "cart" | "quickView" | "wishlist"];
}>();

const actionAdapter = inject(storefrontActionAdapterKey);
const cartState = inject(storefrontCartStateKey);
const runtimeCommerce = inject(runtimeCommercePortKey);
const normalizedCard = computed(() =>
  "destination" in properties.product
    ? (properties.product as FashionStoreProductCardPresentation)
    : undefined,
);
const localActions = computed(() =>
  normalizedCard.value
    ? normalizedCard.value.controls.includes("add-to-cart")
    : !("staticPurchase" in properties.product),
);
const localWishlist = computed(
  () => normalizedCard.value?.controls.includes("wishlist") ?? localActions.value,
);
const localQuickView = computed(
  () => normalizedCard.value?.controls.includes("quick-view") ?? localActions.value,
);
const previewCart = useFashionStorePreviewCart(localActions.value ? undefined : []);
const liveCard = computed(() =>
  "staticPurchase" in properties.product
    ? (properties.product as PresentationProductCard)
    : undefined,
);
const actionState = ref<PresentationProductCard["actionState"]["kind"]>(
  liveCard.value?.actionState.kind ?? "available",
);
const statusMessage = ref(liveCard.value?.actionState.message ?? "");
const runtimePriceLabel = ref<string>();
const runtimeCompareAtPriceLabel = ref<string>();
const hydrated = ref(false);
const renderedActionState = computed(() =>
  !localActions.value && !hydrated.value ? "loading" : actionState.value,
);

const card = computed(() => {
  if (normalizedCard.value) {
    const product = normalizedCard.value;
    return {
      alt: product.media?.alt ?? product.name,
      badge: product.badge,
      href:
        product.destination.kind === "available"
          ? product.destination.href
          : fashionStoreRoutePaths.product,
      id: product.productId,
      image:
        product.media?.kind === "url"
          ? product.media.src
          : product.media
            ? properties.resolveAsset(fashionStoreAssetId(product.media.path))
            : undefined,
      name: product.name,
      originalPrice: product.compareAtPriceLabel ?? "",
      price: product.priceLabel,
    };
  }
  if (liveCard.value) {
    return {
      alt: liveCard.value.media?.alt ?? liveCard.value.name,
      badge: undefined,
      href: liveCard.value.href,
      id: liveCard.value.productId,
      image: liveCard.value.media?.src,
      name: liveCard.value.name,
      originalPrice: runtimeCompareAtPriceLabel.value ?? liveCard.value.compareAtPriceLabel ?? "",
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
  switch (renderedActionState.value) {
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

onMounted(() => {
  hydrated.value = true;
});

async function addToCart(): Promise<void> {
  const product = liveCard.value;
  const purchase = directPurchase.value;
  if (!product || !purchase) {
    const fixtureProduct = properties.product as FashionStoreLegacyProductCard;
    previewCart.add({
      color: "",
      name: fixtureProduct.name,
      price: fixtureProduct.price,
      quantity: 1,
      sourceImage: fixtureProduct.sourceImage,
      total: fixtureProduct.price,
      variantId: fixtureProduct.id,
    });
    emit("intent", "cart");
    return;
  }
  if (!runtimeCommerce || !actionAdapter) {
    actionState.value = "retry";
    statusMessage.value = "The item could not be added. Try again.";
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
    const verifiedVariant = verified.product.variants.find(({ id }) => id === verified.variantId);
    runtimeCompareAtPriceLabel.value = verifiedVariant?.money.compareAtAmount
      ? formatCommerceMoney(verifiedVariant.money.compareAtAmount, verifiedVariant.money.currency)
      : undefined;
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
    :data-product-surface="properties.surface"
    :data-action-state="localActions ? undefined : renderedActionState"
    :data-card-variant="cardVariant"
    :data-product-id="card.id"
  >
    <div class="shop-box mb-10px">
      <div class="shop-image mb-20px">
        <NuxtLink :to="card.href" data-fashion-store-route>
          <img v-if="card.image" :src="card.image" :alt="card.alt" width="600" height="765" />
          <span v-else class="fashion-store-product-placeholder" aria-hidden="true"></span>
          <span v-if="card.badge" class="lable" :class="card.badge.toLowerCase()">{{
            card.badge
          }}</span>
          <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
        </NuxtLink>
        <div class="shop-buttons-wrap">
          <button
            v-if="localActions"
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            :class="{ 'fashion-wishlist-add': wishlistContext }"
            aria-label="Add to cart"
            data-card-action="cart"
            @click="addToCart"
          >
            <FashionStoreIcon name="shopping-bag" /><span class="quick-view-text button-text"
              >Add to cart</span
            >
          </button>
          <button
            v-else-if="directPurchase"
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            :aria-label="directActionLabel"
            data-card-action="cart"
            :disabled="
              renderedActionState === 'loading' ||
              renderedActionState === 'pending' ||
              renderedActionState === 'unavailable' ||
              renderedActionState === 'succeeded'
            "
            @click="addToCart"
          >
            <FashionStoreIcon name="shopping-bag" /><span class="quick-view-text button-text">{{
              directActionLabel
            }}</span>
          </button>
          <NuxtLink
            v-else
            :to="card.href"
            data-fashion-store-route
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
          >
            <span class="quick-view-text button-text">{{
              liveCard?.staticPurchase.kind === "choose-options"
                ? liveCard.staticPurchase.label
                : "Choose options"
            }}</span>
          </NuxtLink>
        </div>
        <div
          v-if="
            properties.surface === 'home-merchandising' ||
            localWishlist ||
            localQuickView ||
            fashionStoreLiveCapabilities.wishlist ||
            fashionStoreLiveCapabilities.productQuickView
          "
          class="shop-hover d-flex justify-content-center"
        >
          <ul>
            <li
              v-if="
                properties.surface === 'home-merchandising' ||
                localWishlist ||
                fashionStoreLiveCapabilities.wishlist
              "
            >
              <FashionStoreTooltip
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                :class="{ 'fashion-wishlist-remove': wishlistContext }"
                :aria-label="
                  !localWishlist && !fashionStoreLiveCapabilities.wishlist
                    ? 'Wishlist unavailable'
                    : wishlistContext
                      ? `Remove ${card.name} from wishlist`
                      : 'Add to wishlist'
                "
                :content="
                  !localWishlist && !fashionStoreLiveCapabilities.wishlist
                    ? 'Wishlist unavailable'
                    : wishlistContext
                      ? 'Remove from wishlist'
                      : 'Add to wishlist'
                "
                :disabled="!localWishlist && !fashionStoreLiveCapabilities.wishlist"
                :aria-disabled="!localWishlist && !fashionStoreLiveCapabilities.wishlist"
                data-card-action="wishlist"
                @click="$emit('intent', 'wishlist')"
              >
                <FashionStoreIcon name="heart" class="fs-16" />
              </FashionStoreTooltip>
            </li>
            <li
              v-if="
                properties.surface === 'home-merchandising' ||
                localQuickView ||
                fashionStoreLiveCapabilities.productQuickView
              "
            >
              <FashionStoreTooltip
                as="a"
                v-if="!localQuickView || wishlistContext"
                :href="card.href"
                data-fashion-store-route
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                :aria-label="wishlistContext ? `View ${card.name}` : 'View product details'"
                :content="wishlistContext ? 'View product' : 'View product details'"
              >
                <FashionStoreIcon name="eye" class="fs-16" />
              </FashionStoreTooltip>
              <FashionStoreTooltip
                v-else
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                aria-label="Quick shop"
                content="Quick shop"
                data-card-action="quick-view"
                @click="$emit('intent', 'quickView')"
              >
                <FashionStoreIcon name="eye" class="fs-16" />
              </FashionStoreTooltip>
            </li>
          </ul>
        </div>
      </div>
      <div class="shop-footer text-center">
        <NuxtLink
          v-if="properties.surface !== 'home-merchandising'"
          :to="card.href"
          data-fashion-store-route
          class="fashion-store-product-title alt-font text-dark-gray fs-19 fw-500"
          >{{ card.name }}</NuxtLink
        >
        <span v-else class="fashion-store-product-title alt-font text-dark-gray fs-19 fw-500">{{
          card.name
        }}</span>
        <div class="price lh-22 fs-16 text-dark-gray">
          <del>{{ card.originalPrice }}</del
          >{{ card.price }}
        </div>
        <p
          v-if="liveCard"
          class="visually-hidden"
          :role="actionState === 'retry' ? 'alert' : 'status'"
          aria-live="polite"
        >
          {{ statusMessage }}
        </p>
      </div>
    </div>
  </li>
</template>

<style scoped>
.shop-hover :deep(button) {
  appearance: none;
  border: 0;
  padding: 0;
}
</style>
