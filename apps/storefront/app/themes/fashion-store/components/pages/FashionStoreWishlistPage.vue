<script setup lang="ts">
import { previewActionAdapterKey, recordPreviewIntent } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { buildFashionStoreProductCartRequest } from "../../fixtures/pages/product";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
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
const actionAdapter = inject(previewActionAdapterKey);
const cartAddCount = ref(0);
const removeCount = ref(0);
const busyProductId = ref("");

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

async function addToCart(productId: string): Promise<void> {
  if (!actionAdapter || busyProductId.value) return;
  busyProductId.value = productId;
  recordPreviewIntent(data.value.actions.cart, "fashion-store.wishlist.cart");
  try {
    await actionAdapter({
      action: data.value.actions.cart,
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
      :data-remove-count="removeCount"
    >
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
                <li v-for="product in products" :key="product.id" class="grid-item">
                  <div class="shop-box mb-10px">
                    <div class="shop-image mb-20px">
                      <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                        <img
                          :src="sourceAsset(product.sourceImage)"
                          alt=""
                          width="600"
                          height="765"
                        />
                        <span
                          v-if="product.badge"
                          class="lable"
                          :class="product.badge.toLowerCase()"
                          >{{ product.badge }}</span
                        >
                        <span class="shop-overlay bg-gradient-gray-light-dark-transparent"></span>
                      </a>
                      <div class="shop-buttons-wrap">
                        <button
                          type="button"
                          class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart fashion-wishlist-add"
                          :disabled="busyProductId === product.id"
                          @click="addToCart(product.id)"
                        >
                          <i class="feather icon-feather-shopping-bag"></i
                          ><span class="quick-view-text button-text">Add to cart</span>
                        </button>
                      </div>
                      <div class="shop-hover d-flex justify-content-center">
                        <ul>
                          <li>
                            <button
                              type="button"
                              class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px fashion-wishlist-remove"
                              :aria-label="`Remove ${product.name} from wishlist`"
                              @click="removeProduct(product.id)"
                            >
                              <i class="feather icon-feather-heart-on fs-16"></i>
                            </button>
                          </li>
                          <li>
                            <a
                              :href="fashionStoreRoutePaths.product"
                              class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                              aria-label="Quick shop"
                              data-fashion-store-route
                              ><i class="feather icon-feather-eye fs-16"></i
                            ></a>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div class="shop-footer text-center">
                      <a
                        :href="fashionStoreRoutePaths.product"
                        class="alt-font text-dark-gray fs-19 fw-500"
                        data-fashion-store-route
                        >{{ product.name }}</a
                      >
                      <div class="price lh-22 fs-16">
                        <del>{{ product.originalPrice }}</del
                        >{{ product.price }}
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
