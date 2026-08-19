<script setup lang="ts">
import { recordPreviewIntent, storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { buildFashionStoreProductCartRequest } from "../../fixtures/pages/product";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Wishlist requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).wishlist;
});
const products = ref([...data.value.products]);
const actionAdapter = inject(storefrontActionAdapterKey);
const cartAddCount = ref(0);
const previewCartIntentCount = ref(0);
const cartNotice = ref("");
const removeCount = ref(0);
const busyProductId = ref("");

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

async function addToCart(productId: string): Promise<void> {
  if (busyProductId.value) return;
  busyProductId.value = productId;
  recordPreviewIntent(data.value.actions.cart, "fashion-store.wishlist.cart");
  if (!actionAdapter) {
    previewCartIntentCount.value += 1;
    cartNotice.value = "Preview cart intent recorded. No Commerce cart was changed.";
    busyProductId.value = "";
    return;
  }
  try {
    await actionAdapter({
      context: "fashion-store.wishlist.cart",
      currency: "USD",
      input: buildFashionStoreProductCartRequest(1),
      kind: "cart.add",
    });
    cartAddCount.value += 1;
  } catch {
    // The host guest-cart owner retains its existing error state.
  } finally {
    busyProductId.value = "";
  }
}

async function removeProduct(productId: string): Promise<void> {
  const index = products.value.findIndex(({ id }) => id === productId);
  if (index < 0) return;
  recordPreviewIntent(data.value.actions.remove, "fashion-store.wishlist.remove");
  products.value.splice(index, 1);
  removeCount.value += 1;
  await nextTick();
  const controls = document.querySelectorAll<HTMLButtonElement>(".fashion-wishlist-remove");
  controls[Math.min(index, controls.length - 1)]?.focus();
}

function handleProductIntent(productId: string, kind: "cart" | "quickView" | "wishlist"): void {
  if (kind === "cart") void addToCart(productId);
  else if (kind === "wishlist") void removeProduct(productId);
}
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :preload-image="sourceAsset(data.products[0]!.sourceImage)"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-wishlist
      data-runtime-status="ready"
      :data-cart-add-count="cartAddCount"
      :data-preview-cart-intent-count="previewCartIntentCount"
      :data-remove-count="removeCount"
    >
      <p v-if="cartNotice" class="sr-only" role="status" aria-live="polite">
        {{ cartNotice }}
      </p>
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container">
          <div class="row align-items-center justify-content-center">
            <div
              class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large"
            >
              <h1 class="alt-font fw-600 text-dark-gray mb-10px">Wishlist</h1>
            </div>
            <nav
              class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center"
              aria-label="Breadcrumb"
            >
              <ul>
                <li><a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a></li>
                {{
                  " "
                }}
                <li>Wishlist</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-wishlist-body">
        <div class="container">
          <div class="row">
            <div class="col-12">
              <ul
                class="shop-modern shop-wrapper grid grid-4col xl-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center fashion-wishlist-grid"
              >
                <li class="grid-sizer" aria-hidden="true"></li>
                <FashionStoreProductCard
                  v-for="product in products"
                  :key="product.id"
                  context="wishlist"
                  :product="product"
                  :resolve-asset="resolveAsset"
                  @intent="handleProductIntent(product.id, $event)"
                />
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
