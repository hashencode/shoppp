<script setup lang="ts">
import FashionStoreTooltip from "../shared/FashionStoreTooltip.vue";
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import { recordPreviewIntent, type PreviewAction } from "../../../../theme-engine/actions";
import { storefrontPreviewIntentCountKey } from "../../../../theme-engine/presentation-context";
import type { FashionStoreHomeData } from "../../fixtures/home";
import { useFashionStorePreviewCart } from "../../composables/useFashionStorePreviewCart";
import { fashionStoreRoutePaths } from "../../page-contracts";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData, resolveHomeAsset } from "./fixture-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
const actionIntentCount = inject(storefrontPreviewIntentCountKey, ref(0));
const previewCart = useFashionStorePreviewCart();

function recordProductAction(action: PreviewAction): void {
  recordPreviewIntent(action, "fashion-store.home.product");
  actionIntentCount.value += 1;
}

function addToCart(product: FashionStoreHomeData["bestSellers"][number]): void {
  recordProductAction(data.value.cartAction);
  previewCart.add({
    color: "",
    name: product.name,
    price: product.price,
    quantity: 1,
    sourceImage: product.sourceImage,
    total: product.price,
    variantId: product.sourceImage,
  });
}

function addToWishlist(): void {
  recordProductAction(data.value.wishlistAction);
}

function openQuickView(): void {
  recordProductAction(data.value.quickViewAction);
}

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 sm-pb-6 xs-px-0" data-home-section="best-sellers">
    <div class="container">
      <div class="row mb-5 xs-mb-8">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            Best seller
            <span class="text-highlight fw-600"
              >products<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ul
            class="shop-modern shop-wrapper grid-loading grid grid-5col lg-grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
            data-anime='{ "el": "childs", "translateY": [-15, 0], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer"></li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[0].name"
                      v-bind:src="sourceAsset(data.bestSellers[0].sourceImage)"
                    />
                    <span class="lable new">New</span>
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[0])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[0].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[0].originalPrice }}</del
                    >{{ data.bestSellers[0].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[1].name"
                      v-bind:src="sourceAsset(data.bestSellers[1].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[1])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[1].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[1].originalPrice }}</del
                    >{{ data.bestSellers[1].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[2].name"
                      v-bind:src="sourceAsset(data.bestSellers[2].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[2])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[2].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[2].originalPrice }}</del
                    >{{ data.bestSellers[2].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[3].name"
                      v-bind:src="sourceAsset(data.bestSellers[3].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[3])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[3].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[3].originalPrice }}</del
                    >{{ data.bestSellers[3].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[4].name"
                      v-bind:src="sourceAsset(data.bestSellers[4].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[4])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[4].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[4].originalPrice }}</del
                    >{{ data.bestSellers[4].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[5].name"
                      v-bind:src="sourceAsset(data.bestSellers[5].sourceImage)"
                    />
                    <span class="lable hot">Hot</span>
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[5])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[5].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[5].originalPrice }}</del
                    >{{ data.bestSellers[5].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[6].name"
                      v-bind:src="sourceAsset(data.bestSellers[6].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[6])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[6].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[6].originalPrice }}</del
                    >{{ data.bestSellers[6].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[7].name"
                      v-bind:src="sourceAsset(data.bestSellers[7].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[7])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[7].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[7].originalPrice }}</del
                    >{{ data.bestSellers[7].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[8].name"
                      v-bind:src="sourceAsset(data.bestSellers[8].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[8])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[8].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[8].originalPrice }}</del
                    >{{ data.bestSellers[8].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                    <img
                      v-bind:alt="data.bestSellers[9].name"
                      v-bind:src="sourceAsset(data.bestSellers[9].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart(data.bestSellers[9])"
                    >
                      <FashionStoreIcon name="shopping-bag" /><span
                        class="quick-view-text button-text"
                        >Add to cart</span
                      >
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <FashionStoreIcon name="heart" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                      <li>
                        <FashionStoreTooltip
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          content="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <FashionStoreIcon name="eye" class="fs-16" />
                        </FashionStoreTooltip>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a
                    :href="fashionStoreRoutePaths.product"
                    data-fashion-store-route
                    class="alt-font text-dark-gray fs-19 fw-500"
                    >{{ data.bestSellers[9].name }}</a
                  >
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[9].originalPrice }}</del
                    >{{ data.bestSellers[9].price }}
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
