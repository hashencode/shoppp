<script setup lang="ts">
import FashionStoreTooltip from "./shared/FashionStoreTooltip.vue";
import FashionStoreIcon from "./shared/FashionStoreIcon.vue";
import { recordPreviewIntent, type PreviewAction } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import type { FashionStoreHomeData } from "../fixtures/home";
import { fashionStoreAssetId } from "../resources";
import { fashionStoreRoutePaths } from "../page-contracts";
import FashionStoreCarousel from "./shared/FashionStoreCarousel.vue";
import FashionStoreShell from "./shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed<FashionStoreHomeData>(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store home requires a theme-section fixture.");
  }
  return properties.viewModel.data as unknown as FashionStoreHomeData;
});

const actionIntentCount = ref(0);
const heroCarousel = ref<{ select(index: number): void }>();
const activeIndex = ref(0);
const heroCurrent = computed(() => String(activeIndex.value + 1).padStart(2, "0"));
const heroTotal = computed(() => String(data.value.slider.slides.length).padStart(2, "0"));
const marqueeMessages = computed(() => data.value.marquee);
const collectionIndex = ref(0);
const collectionSlides = computed(() =>
  data.value.collection.length > 1
    ? [...data.value.collection, ...data.value.collection]
    : data.value.collection,
);
function recordProductAction(action: PreviewAction): void {
  recordPreviewIntent(action, "fashion-store.home.product");
  actionIntentCount.value += 1;
}

function addToCart(): void {
  recordProductAction(data.value.cartAction);
}

function addToWishlist(): void {
  recordProductAction(data.value.wishlistAction);
}

function openQuickView(): void {
  recordProductAction(data.value.quickViewAction);
}

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function heroHeading(index: number): [string, string] {
  const words = heroSlide(index).heading.split(" ");
  return [words[0] ?? "", words.slice(1).join(" ")];
}

function heroSlide(index: number): FashionStoreHomeData["slider"]["slides"][number] {
  return data.value.slider.slides[index] ?? data.value.slider.slides[0];
}

function collectionSlide(index: number): FashionStoreHomeData["collection"][number] {
  return collectionSlides.value[index] ?? data.value.collection[0];
}
</script>

<template>
  <FashionStoreShell
    variant="home"
    :announcement="data.announcement"
    :preload-image="properties.resolveAsset('fashion-store.slider-01')"
    :preview-intent-count="actionIntentCount"
    :resolve-asset="properties.resolveAsset"
  >
    <template #prelude>
      <h1 class="visually-hidden">Fashion store</h1>
    </template>
    <section class="p-0" id="fashion-store-main" role="main">
      <FashionStoreCarousel
        ref="heroCarousel"
        class="full-screen top-space-margin md-h-600px sm-h-500px swiper-number-pagination-progress swiper-number-pagination-progress-vertical"
        :slide-count="data.slider.slides.length"
        :semantic-slide-count="data.slider.slides.length"
        :autoplay-ms="data.slider.options.autoplayMs"
        :speed-ms="data.slider.options.speedMs"
        :loop="data.slider.options.loop"
        :parallax="true"
        :keyboard="data.slider.options.keyboard"
        :breakpoints="{
          [data.slider.options.breakpointPx]: { direction: data.slider.options.desktopDirection },
        }"
        slide-class="overflow-hidden fashion-store-hero-slide"
        :slide-motion-layers="true"
        data-swiper-number-pagination-progress="true"
        tabindex="0"
        @active-index-change="activeIndex = $event"
      >
        <template #default="{ index }">
          <div
            class="cover-background position-absolute top-0 start-0 w-100 h-100"
            :data-swiper-parallax="data.slider.options.parallaxPx"
            :style="{
              backgroundImage: `url('${properties.resolveAsset(heroSlide(index).assetId)}')`,
            }"
          >
            <div class="container h-100">
              <div class="row align-items-center h-100 justify-content-start">
                <div
                  class="col-md-10 position-relative text-white d-flex flex-column justify-content-center h-100"
                >
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [50, 0], "easing": "easeOutQuad", "duration": 500, "delay": 300 }'
                    class="alt-font text-dark-gray mb-25px fs-20 sm-mb-15px"
                  >
                    <span class="text-highlight"
                      >{{ heroSlide(index).eyebrow
                      }}<span class="bg-base-color h-8px bottom-0px"></span
                    ></span>
                  </div>
                  <div
                    class="alt-font fs-120 xs-fs-95 lh-100 mb-40px text-dark-gray fw-600 transform-origin-right ls-minus-5px sm-mb-25px"
                    data-anime='{ "el": "childs", "rotateX": [90, 0], "opacity": [0,1], "staggervalue": 150, "easing": "easeOutQuad" }'
                  >
                    <span class="d-block">{{ heroHeading(index)[0] }}</span>
                    <span class="d-block fw-300">{{ heroHeading(index)[1] }}</span>
                  </div>
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [100, 0], "easing": "easeOutQuad", "duration": 800, "delay": 400 }'
                  >
                    <a
                      :href="fashionStoreRoutePaths.collection"
                      data-fashion-store-route
                      class="btn btn-dark-gray btn-box-shadow btn-large"
                      >View collection</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #container-end>
          <div class="swiper-pagination-wrapper">
            <div
              class="pagination-progress-vertical d-flex align-items-center justify-content-center"
            >
              <div class="number-prev text-dark-gray fs-16 fw-500">{{ heroCurrent }}</div>
              <div class="swiper-pagination-progress">
                <span class="swiper-progress"></span>
              </div>
              <div class="number-next text-dark-gray fs-16 fw-500">{{ heroTotal }}</div>
            </div>
            <div class="fashion-store-hero-controls" aria-label="Hero slides">
              <button
                v-for="(_, index) in data.slider.slides"
                :key="`hero-control-${index}`"
                type="button"
                :data-fashion-store-slide="index"
                :aria-label="`Show slide ${index + 1}`"
                :aria-current="activeIndex === index ? 'true' : undefined"
                @click="heroCarousel?.select(index)"
              >
                <span class="visually-hidden">{{ String(index + 1).padStart(2, "0") }}</span>
              </button>
            </div>
          </div>
        </template>
      </FashionStoreCarousel>
    </section>
    <section class="half-section">
      <div class="container">
        <div
          class="row row-cols-1 row-cols-xl-4 row-cols-lg-4 row-cols-md-2 row-cols-sm-2"
          data-anime='{ "el": "childs", "translateX": [30, 0], "opacity": [0,1], "duration": 800, "delay": 200, "staggervalue": 300, "easing": "easeOutQuad" }'
        >
          <div class="col icon-with-text-style-01 md-mb-35px">
            <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
              <div class="feature-box-icon me-20px">
                <FashionStoreIcon name="package" class="icon-large text-dark-gray" />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                  data.services[0].title
                }}</span>
                <p class="fs-16 lh-24">{{ data.services[0].description }}</p>
              </div>
            </div>
          </div>

          <div class="col icon-with-text-style-01 md-mb-35px">
            <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
              <div class="feature-box-icon me-20px">
                <FashionStoreIcon name="refresh-cw" class="icon-large text-dark-gray" />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                  data.services[1].title
                }}</span>
                <p class="fs-16 lh-24">{{ data.services[1].description }}</p>
              </div>
            </div>
          </div>

          <div class="col icon-with-text-style-01 xs-mb-35px">
            <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
              <div class="feature-box-icon me-20px">
                <FashionStoreIcon name="credit-card" class="icon-large text-dark-gray" />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                  data.services[2].title
                }}</span>
                <p class="fs-16 lh-24">{{ data.services[2].description }}</p>
              </div>
            </div>
          </div>

          <div class="col icon-with-text-style-01">
            <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
              <div class="feature-box-icon me-20px">
                <FashionStoreIcon name="phone" class="icon-large text-dark-gray" />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                  data.services[3].title
                }}</span>
                <p class="fs-16 lh-24">{{ data.services[3].description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0">
      <div class="container-fluid">
        <div
          class="row row-cols-1 row-cols-xl-4 row-cols-lg-2 row-cols-md-2"
          data-anime='{ "el": "childs", "translateY": [-15, 0], "perspective": [1200,1200], "scale": [1.1, 1], "rotateX": [50, 0], "opacity": [0,1], "duration": 400, "delay": 100, "staggervalue": 200, "easing": "easeOutQuad" }'
        >
          <div class="col categories-style-02 lg-mb-30px">
            <div class="categories-box">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                v-bind:aria-label="'View ' + data.categories[0].name"
              >
                <img
                  class="sm-w-100"
                  alt=""
                  v-bind:src="sourceAsset(data.categories[0].sourceImage)"
                />
              </a>
              <div
                class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
              >
                {{ data.categories[0].itemCount }}
              </div>
              <div class="absolute-bottom-center bottom-40px md-bottom-25px">
                <a
                  :href="fashionStoreRoutePaths.collection"
                  data-fashion-store-route
                  class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
                >
                  <span>
                    <span
                      class="btn-double-text ls-0px"
                      v-bind:data-text="data.categories[0].name"
                      >{{ data.categories[0].name }}</span
                    >
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div class="col categories-style-02 lg-mb-30px">
            <div class="categories-box">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                v-bind:aria-label="'View ' + data.categories[1].name"
              >
                <img
                  class="sm-w-100"
                  alt=""
                  v-bind:src="sourceAsset(data.categories[1].sourceImage)"
                />
              </a>
              <div
                class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
              >
                {{ data.categories[1].itemCount }}
              </div>
              <div class="absolute-bottom-center bottom-40px md-bottom-25px">
                <a
                  :href="fashionStoreRoutePaths.collection"
                  data-fashion-store-route
                  class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
                >
                  <span>
                    <span
                      class="btn-double-text ls-0px"
                      v-bind:data-text="data.categories[1].name"
                      >{{ data.categories[1].name }}</span
                    >
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div class="col categories-style-02 sm-mb-30px">
            <div class="categories-box">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                v-bind:aria-label="'View ' + data.categories[2].name"
              >
                <img
                  class="sm-w-100"
                  alt=""
                  v-bind:src="sourceAsset(data.categories[2].sourceImage)"
                />
              </a>
              <div
                class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
              >
                {{ data.categories[2].itemCount }}
              </div>
              <div class="absolute-bottom-center bottom-40px md-bottom-25px">
                <a
                  :href="fashionStoreRoutePaths.collection"
                  data-fashion-store-route
                  class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
                >
                  <span>
                    <span
                      class="btn-double-text ls-0px"
                      v-bind:data-text="data.categories[2].name"
                      >{{ data.categories[2].name }}</span
                    >
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div class="col categories-style-02">
            <div class="categories-box">
              <a
                :href="fashionStoreRoutePaths.collection"
                data-fashion-store-route
                v-bind:aria-label="'View ' + data.categories[3].name"
              >
                <img
                  class="sm-w-100"
                  alt=""
                  v-bind:src="sourceAsset(data.categories[3].sourceImage)"
                />
              </a>
              <div
                class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
              >
                {{ data.categories[3].itemCount }}
              </div>
              <div class="absolute-bottom-center bottom-40px md-bottom-25px">
                <a
                  :href="fashionStoreRoutePaths.collection"
                  data-fashion-store-route
                  class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
                >
                  <span>
                    <span
                      class="btn-double-text ls-0px"
                      v-bind:data-text="data.categories[3].name"
                      >{{ data.categories[3].name }}</span
                    >
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 sm-pb-6 xs-px-0">
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
                        @click="addToCart"
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
    <section class="p-15px bg-dark-gray text-white">
      <div class="container">
        <div class="row">
          <div class="col-12 text-center">
            <span class="fs-15 text-uppercase fw-500"
              >Take an extra 25% discount our favorite dress style. Use code:<span
                class="fs-14 fw-700 lh-28 alt-font text-dark-gray text-uppercase bg-base-color d-inline-block border-radius-30px ps-15px pe-15px ms-5px align-middle"
                >fw205</span
              ></span
            >
          </div>
        </div>
      </div>
    </section>
    <section class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0">
      <div class="container-fluid">
        <div class="row align-items-center">
          <div class="col-lg-3 ps-5 pe-5 xl-pe-0 lg-ps-0 text-center text-lg-start md-mb-40px">
            <div class="mb-10px">
              <span class="text-dark-gray fw-500 text-highlight"
                >Lookbook 2023<span class="bg-base-color h-8px bottom-0px"></span
              ></span>
            </div>
            <h2 class="alt-font lh-50 text-dark-gray ls-minus-1px mb-15px">
              New arrival <span class="fw-600">collection</span>
            </h2>
            <p class="xs-pe-15px xs-ps-15px">
              Flash summer sale 70% off on selected collection for him.
            </p>
            <a
              :href="fashionStoreRoutePaths.collection"
              data-fashion-store-route
              class="btn btn-dark-gray btn-box-shadow btn-medium"
              >View collection</a
            >
          </div>
          <div class="col-12 col-lg-9 position-relative">
            <div
              class="outside-box-right-10 lg-outside-box-right-20 md-outside-box-right-25 xs-outside-box-right-0"
            >
              <FashionStoreCarousel
                class="slider-three-slide"
                data-fashion-store-collection-carousel
                :slide-count="collectionSlides.length"
                :semantic-slide-count="data.collection.length"
                :slides-per-view="1"
                :space-between="30"
                :speed-ms="650"
                :autoplay-ms="4_000"
                :loop="data.collection.length > 1"
                :breakpoints="{
                  576: { slidesPerView: 2 },
                  768: { slidesPerView: 3 },
                  1400: { slidesPerView: 4 },
                }"
                :data-collection-index="collectionIndex"
                tabindex="0"
                aria-label="New arrival collection carousel"
                @active-index-change="collectionIndex = $event"
              >
                <template #default="{ index }">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" :src="sourceAsset(collectionSlide(index).sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{
                          collectionSlide(index).name
                        }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ collectionSlide(index).subtitle }}</span
                        >
                        <a
                          :href="fashionStoreRoutePaths.collection"
                          data-fashion-store-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><FashionStoreIcon
                            name="arrow-right"
                            class="text-dark-gray icon-very-medium"
                        /></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        :href="fashionStoreRoutePaths.collection"
                        data-fashion-store-route
                        :aria-label="`Explore ${collectionSlide(index).name}`"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </template>
              </FashionStoreCarousel>
            </div>
          </div>
        </div>
      </div>
      <div
        class="fs-180 lg-fs-150 md-fs-130 fw-700 position-absolute bottom-minus-50px md-bottom-minus-40px ls-minus-5px left-0px right-0px text-center w-100 opacity-1 d-none d-md-block"
        aria-hidden="true"
        data-bottom-top="transform:scale(1, 1) translate3d(0px, 0px, 0px);"
        data-top-bottom="transform:scale(1, 1) translate3d(-100px, 0px, 0px);"
      >
        new collection
      </div>
    </section>
    <section class="half-section border-bottom border-color-extra-medium-gray">
      <div class="container">
        <div
          class="row row-cols-2 row-cols-md-5 row-cols-sm-3 position-relative justify-content-center"
          data-anime='{ "el": "childs", "translateY": [-15, 0], "scale": [0.8, 1], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
        >
          <div class="col text-center sm-mb-30px">
            <span
              ><img
                class="h-30px"
                v-bind:alt="data.brands[0].name"
                v-bind:src="sourceAsset(data.brands[0].sourceImage)"
            /></span>
          </div>

          <div class="col text-center sm-mb-30px">
            <span
              ><img
                class="h-30px"
                v-bind:alt="data.brands[1].name"
                v-bind:src="sourceAsset(data.brands[1].sourceImage)"
            /></span>
          </div>

          <div class="col text-center sm-mb-30px">
            <span
              ><img
                class="h-30px"
                v-bind:alt="data.brands[2].name"
                v-bind:src="sourceAsset(data.brands[2].sourceImage)"
            /></span>
          </div>

          <div class="col text-center xs-mb-30px">
            <span
              ><img
                class="h-30px"
                v-bind:alt="data.brands[3].name"
                v-bind:src="sourceAsset(data.brands[3].sourceImage)"
            /></span>
          </div>

          <div class="col text-center">
            <span
              ><img
                class="h-30px"
                v-bind:alt="data.brands[4].name"
                v-bind:src="sourceAsset(data.brands[4].sourceImage)"
            /></span>
          </div>
        </div>
      </div>
    </section>
    <section class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 md-pb-5 xs-px-0">
      <div class="container">
        <div class="row mb-5 xs-mb-8">
          <div class="col-12 text-center">
            <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
              Featured
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
              class="shop-modern shop-wrapper grid-loading grid grid-5col lg-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
              data-anime='{ "el": "childs", "translateY": [-15, 0], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
            >
              <li class="grid-sizer"></li>

              <li class="grid-item">
                <div class="shop-box mb-10px">
                  <div class="shop-image mb-20px">
                    <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                      <img
                        v-bind:alt="data.featuredProducts[0].name"
                        v-bind:src="sourceAsset(data.featuredProducts[0].sourceImage)"
                      />
                      <span class="lable new">New</span>
                      <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                    </a>
                    <div class="shop-buttons-wrap">
                      <button
                        type="button"
                        aria-label="Add to cart"
                        class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                        @click="addToCart"
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
                      >{{ data.featuredProducts[0].name }}</a
                    >
                    <div class="price lh-22 fs-16">
                      <del>{{ data.featuredProducts[0].originalPrice }}</del
                      >{{ data.featuredProducts[0].price }}
                    </div>
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="shop-box mb-10px">
                  <div class="shop-image mb-20px">
                    <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                      <img
                        v-bind:alt="data.featuredProducts[1].name"
                        v-bind:src="sourceAsset(data.featuredProducts[1].sourceImage)"
                      />
                      <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                    </a>
                    <div class="shop-buttons-wrap">
                      <button
                        type="button"
                        aria-label="Add to cart"
                        class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                        @click="addToCart"
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
                      >{{ data.featuredProducts[1].name }}</a
                    >
                    <div class="price lh-22 fs-16">
                      <del>{{ data.featuredProducts[1].originalPrice }}</del
                      >{{ data.featuredProducts[1].price }}
                    </div>
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="shop-box mb-10px">
                  <div class="shop-image mb-20px">
                    <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                      <img
                        v-bind:alt="data.featuredProducts[2].name"
                        v-bind:src="sourceAsset(data.featuredProducts[2].sourceImage)"
                      />
                      <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                    </a>
                    <div class="shop-buttons-wrap">
                      <button
                        type="button"
                        aria-label="Add to cart"
                        class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                        @click="addToCart"
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
                      >{{ data.featuredProducts[2].name }}</a
                    >
                    <div class="price lh-22 fs-16">
                      <del>{{ data.featuredProducts[2].originalPrice }}</del
                      >{{ data.featuredProducts[2].price }}
                    </div>
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="shop-box mb-10px">
                  <div class="shop-image mb-20px">
                    <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                      <img
                        v-bind:alt="data.featuredProducts[3].name"
                        v-bind:src="sourceAsset(data.featuredProducts[3].sourceImage)"
                      />
                      <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                    </a>
                    <div class="shop-buttons-wrap">
                      <button
                        type="button"
                        aria-label="Add to cart"
                        class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                        @click="addToCart"
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
                      >{{ data.featuredProducts[3].name }}</a
                    >
                    <div class="price lh-22 fs-16">
                      <del>{{ data.featuredProducts[3].originalPrice }}</del
                      >{{ data.featuredProducts[3].price }}
                    </div>
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="shop-box mb-10px">
                  <div class="shop-image mb-20px">
                    <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>
                      <img
                        v-bind:alt="data.featuredProducts[4].name"
                        v-bind:src="sourceAsset(data.featuredProducts[4].sourceImage)"
                      />
                      <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                    </a>
                    <div class="shop-buttons-wrap">
                      <button
                        type="button"
                        aria-label="Add to cart"
                        class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                        @click="addToCart"
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
                      >{{ data.featuredProducts[4].name }}</a
                    >
                    <div class="price lh-22 fs-16">
                      <del>{{ data.featuredProducts[4].originalPrice }}</del
                      >{{ data.featuredProducts[4].price }}
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
    <section class="p-0 border-top border-bottom border-color-extra-medium-gray">
      <div class="container-fluid">
        <div class="row position-relative">
          <div
            class="col swiper text-center swiper-width-auto"
            data-slider-options='{ "slidesPerView": "auto", "spaceBetween":0, "speed": 10000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":0, "disableOnInteraction": false }, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "effect": "slide" }'
          >
            <div class="swiper-wrapper marquee-slide" data-fashion-store-marquee>
              <div v-for="(message, index) in marqueeMessages" :key="index" class="swiper-slide">
                <div
                  class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
                >
                  {{ message }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0">
      <div class="container">
        <div class="row mb-4 xs-mb-7">
          <div class="col-12 text-center">
            <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
              Fashion
              <span class="text-highlight fw-600"
                >magazine<span class="bg-base-color h-5px bottom-2px"></span
              ></span>
            </h2>
          </div>
        </div>
      </div>
      <div class="container-fluid">
        <div class="row">
          <div class="col-12">
            <ul
              class="blog-classic blog-wrapper grid-loading grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large"
              data-anime='{ "el": "childs", "translateY": [15, 0], "translateX": [-15, 0], "opacity": [0,1], "duration": 500, "delay": 300, "staggervalue": 300, "easing": "easeOutQuad" }'
            >
              <li class="grid-sizer"></li>

              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden">
                    <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                      ><img
                        v-bind:alt="data.magazine[0].name"
                        v-bind:src="sourceAsset(data.magazine[0].sourceImage)"
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                    <span class="mb-5px d-block"
                      >By
                      <a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="text-dark-gray fw-500 categories-text"
                        >{{ data.magazine[0].author }}</a
                      ><a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="blog-date"
                        >{{ data.magazine[0].date }}</a
                      ></span
                    >
                    <a
                      :href="fashionStoreRoutePaths.article"
                      data-fashion-store-route
                      class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                      >{{ data.magazine[0].name }}</a
                    >
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden">
                    <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                      ><img
                        v-bind:alt="data.magazine[1].name"
                        v-bind:src="sourceAsset(data.magazine[1].sourceImage)"
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                    <span class="mb-5px d-block"
                      >By
                      <a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="text-dark-gray fw-500 categories-text"
                        >{{ data.magazine[1].author }}</a
                      ><a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="blog-date"
                        >{{ data.magazine[1].date }}</a
                      ></span
                    >
                    <a
                      :href="fashionStoreRoutePaths.article"
                      data-fashion-store-route
                      class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                      >{{ data.magazine[1].name }}</a
                    >
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden">
                    <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                      ><img
                        v-bind:alt="data.magazine[2].name"
                        v-bind:src="sourceAsset(data.magazine[2].sourceImage)"
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                    <span class="mb-5px d-block"
                      >By
                      <a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="text-dark-gray fw-500 categories-text"
                        >{{ data.magazine[2].author }}</a
                      ><a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="blog-date"
                        >{{ data.magazine[2].date }}</a
                      ></span
                    >
                    <a
                      :href="fashionStoreRoutePaths.article"
                      data-fashion-store-route
                      class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                      >{{ data.magazine[2].name }}</a
                    >
                  </div>
                </div>
              </li>

              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden">
                    <a :href="fashionStoreRoutePaths.article" data-fashion-store-route
                      ><img
                        v-bind:alt="data.magazine[3].name"
                        v-bind:src="sourceAsset(data.magazine[3].sourceImage)"
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                    <span class="mb-5px d-block"
                      >By
                      <a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="text-dark-gray fw-500 categories-text"
                        >{{ data.magazine[3].author }}</a
                      ><a
                        :href="fashionStoreRoutePaths.magazine"
                        data-fashion-store-route
                        class="blog-date"
                        >{{ data.magazine[3].date }}</a
                      ></span
                    >
                    <a
                      :href="fashionStoreRoutePaths.article"
                      data-fashion-store-route
                      class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                      >{{ data.magazine[3].name }}</a
                    >
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </FashionStoreShell>
</template>
