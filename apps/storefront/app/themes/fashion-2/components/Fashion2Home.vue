<script setup lang="ts">
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import type { Fashion2HomeData } from "../fixtures/home";
import { useFashion2Runtime } from "../composables/useFashion2Runtime";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as Fashion2HomeData)
    : null,
);
if (!data.value) throw new Error("Fashion 2 home requires a theme-section fixture.");

const menuOpen = ref(false);
const actionFeedback = ref("");
const actionIntentCount = ref(0);
const runtime = useFashion2Runtime({
  autoplayMs: data.value.slider.options.autoplayMs,
  breakpointPx: data.value.slider.options.breakpointPx,
  count: data.value.slider.slides.length,
  speedMs: data.value.slider.options.speedMs,
});
const activeIndex = computed(() =>
  runtime.motion.value.phase === "transitioning"
    ? runtime.motion.value.targetIndex
    : runtime.motion.value.currentIndex,
);

function headingParts(heading: string): [string, string] {
  const split = heading.lastIndexOf(" ");
  return split < 0 ? [heading, ""] : [heading.slice(0, split), heading.slice(split + 1)];
}

function addToCart(): void {
  recordPreviewIntent(data.value!.cartAction, "fashion-2.home.product");
  actionIntentCount.value += 1;
  actionFeedback.value = "Textured sweater added to preview cart.";
}

useHead({
  bodyAttrs: { "data-mobile-nav-style": "classic" },
  link: [
    {
      as: "image",
      fetchpriority: "high",
      href: properties.resolveAsset("fashion-2.slider-01"),
      rel: "preload",
    },
  ],
});
</script>

<template>
  <main
    v-if="data"
    class="fashion-2-home"
    data-fashion-2-source-parity="true"
    :data-preview-intent-count="actionIntentCount"
    :data-runtime-instance-count="runtime.liveInstances.value"
  >
    <a class="skip-link" href="#fashion-2-main">Skip to content</a>
    <h1 class="sr-only">Fashion store</h1>
    <button
      v-for="(_, index) in data.slider.slides"
      :key="`slide-control-${index}`"
      type="button"
      class="sr-only"
      :data-fashion-2-slide="index"
      :aria-label="`Show slide ${index + 1}`"
      @click="runtime.select(index)"
    />
    <header class="header-with-topbar">
      <div
        class="header-top-bar top-bar-light bg-base-color disable-fixed md-border-bottom border-color-transparent-dark-very-light"
      >
        <div class="container-fluid">
          <div class="row h-40px align-items-center m-0">
            <div class="col-12 justify-content-center alt-font fs-13 fw-500 text-uppercase">
              <div class="text-dark-gray">{{ data.announcement }}</div>
              <a
                href="#fashion-2-product"
                class="text-dark-gray fw-600 ms-5px text-dark-gray-hover"
              >
                <span class="text-decoration-line-bottom">{{ data.announcementAction }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <nav class="navbar navbar-expand-lg header-light bg-white disable-fixed center-logo">
        <div class="container-fluid">
          <div class="col-auto col-xxl-3 col-lg-2 menu-logo">
            <div class="header-icon d-none d-lg-flex">
              <div class="widget-text icon alt-font">
                <a href="#fashion-2-product">
                  <i class="feather icon-feather-map-pin d-inline-block me-5px" />
                  <span class="d-none d-xxl-inline-block">Find stores</span>
                </a>
              </div>
              <div class="widget-text icon alt-font">
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                  <i class="feather icon-feather-instagram d-inline-block me-5px" />
                  <span class="d-none d-xxl-inline-block">100k Followers</span>
                </a>
              </div>
            </div>
            <a class="navbar-brand" href="#fashion-2-main" aria-label="Fashion store home">
              <img
                :src="properties.resolveAsset('fashion-2.logo')"
                :data-at2x="properties.resolveAsset('fashion-2.logo-2x')"
                alt=""
                class="default-logo"
              />
              <img
                :src="properties.resolveAsset('fashion-2.logo')"
                :data-at2x="properties.resolveAsset('fashion-2.logo-2x')"
                alt=""
                class="alt-logo"
              />
              <img
                :src="properties.resolveAsset('fashion-2.logo')"
                :data-at2x="properties.resolveAsset('fashion-2.logo-2x')"
                alt=""
                class="mobile-logo"
              />
            </a>
          </div>
          <div class="col-auto col-xxl-6 col-lg-8 menu-order">
            <button
              class="navbar-toggler float-end"
              type="button"
              :aria-expanded="menuOpen"
              aria-controls="navbarNav"
              aria-label="Toggle navigation"
              @click="menuOpen = !menuOpen"
            >
              <span v-for="index in 4" :key="index" class="navbar-toggler-line" />
            </button>
            <div
              id="navbarNav"
              class="collapse navbar-collapse justify-content-between"
              :class="{ show: menuOpen }"
            >
              <ul class="navbar-nav alt-font navbar-left justify-content-end">
                <li v-for="label in data.navigation.slice(0, 3)" :key="label" class="nav-item">
                  <a href="#fashion-2-product" class="nav-link">{{ label }}</a>
                </li>
              </ul>
              <ul class="navbar-nav alt-font navbar-right justify-content-start">
                <li v-for="label in data.navigation.slice(3)" :key="label" class="nav-item">
                  <a href="#fashion-2-product" class="nav-link">{{ label }}</a>
                </li>
              </ul>
            </div>
          </div>
          <div class="col-auto col-xxl-3 col-lg-2 text-end">
            <div class="header-icon">
              <div class="header-search-icon icon alt-font">
                <a href="#fashion-2-product">
                  <i class="feather icon-feather-search" />
                  <span class="d-none d-xxl-inline-block">Search</span>
                </a>
              </div>
              <div class="header-search-icon icon alt-font d-none d-sm-flex">
                <a href="#fashion-2-product">
                  <i class="feather icon-feather-user" />
                  <span class="d-none d-xxl-inline-block">Account</span>
                </a>
              </div>
              <div class="header-cart-icon icon">
                <a href="#fashion-2-product">
                  <i class="feather icon-feather-shopping-bag" />
                  <span class="cart-count alt-font text-white bg-dark-gray">2</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <section id="fashion-2-main" class="p-0">
      <div
        class="swiper full-screen top-space-margin md-h-600px sm-h-500px magic-cursor magic-cursor-vertical swiper-number-pagination-progress swiper-number-pagination-progress-vertical"
        aria-label="Seasonal collections"
        aria-roledescription="carousel"
        :data-motion-active-index="activeIndex"
        :data-motion-autoplay-ms="data.slider.options.autoplayMs"
        :data-motion-direction="runtime.direction.value"
        data-motion-easing="ease"
        :data-motion-duration-ms="data.slider.options.speedMs"
        :data-motion-paused="runtime.motion.value.pausedReasons.join(',')"
        :data-motion-ready="runtime.hydrated.value"
        :data-slider-options="JSON.stringify(data.slider.options)"
        data-swiper-number-pagination-progress="true"
        tabindex="0"
        @keydown="runtime.keydown"
      >
        <div class="swiper-wrapper">
          <div
            v-for="(slide, index) in data.slider.slides"
            :key="slide.assetId"
            class="swiper-slide overflow-hidden fashion-2-hero-slide"
            data-motion-layer="slide"
            :data-active="activeIndex === index"
            :aria-hidden="activeIndex === index ? undefined : 'true'"
          >
            <div
              class="cover-background position-absolute top-0 start-0 w-100 h-100"
              data-swiper-parallax="500"
              :style="{ backgroundImage: `url('${properties.resolveAsset(slide.assetId)}')` }"
            >
              <div class="container h-100">
                <div class="row align-items-center h-100 justify-content-start">
                  <div
                    class="col-md-10 position-relative text-white d-flex flex-column justify-content-center h-100"
                  >
                    <div class="alt-font text-dark-gray mb-25px fs-20 sm-mb-15px">
                      <span class="text-highlight">
                        {{ slide.eyebrow }}<span class="bg-base-color h-8px bottom-0px" />
                      </span>
                    </div>
                    <div
                      class="alt-font fs-120 xs-fs-95 lh-100 mb-40px text-dark-gray fw-600 transform-origin-right ls-minus-5px sm-mb-25px"
                    >
                      <span class="d-block">{{ headingParts(slide.heading)[0] }}</span>
                      <span class="d-block fw-300">{{ headingParts(slide.heading)[1] }}</span>
                    </div>
                    <div>
                      <a
                        href="#fashion-2-product"
                        class="btn btn-dark-gray btn-box-shadow btn-large"
                      >
                        View collection
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="swiper-pagination-wrapper">
          <div
            class="pagination-progress-vertical d-flex align-items-center justify-content-center"
          >
            <div class="number-prev text-dark-gray fs-16 fw-500">0{{ activeIndex + 1 }}</div>
            <div class="swiper-pagination-progress"><span class="swiper-progress" /></div>
            <div class="number-next text-dark-gray fs-16 fw-500">03</div>
          </div>
        </div>
      </div>
    </section>

    <section
      id="fashion-2-product"
      class="fashion-2-product-slice ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 sm-pb-6 xs-px-0"
    >
      <div class="container">
        <div class="row mb-5 xs-mb-8">
          <div class="col-12 text-center">
            <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
              Best seller
              <span class="text-highlight fw-600">
                products<span class="bg-base-color h-5px bottom-2px" />
              </span>
            </h2>
          </div>
        </div>
      </div>
      <div class="container-fluid">
        <ul class="shop-modern shop-wrapper grid grid-5col text-center">
          <li class="grid-item">
            <div class="shop-box mb-10px">
              <div class="shop-image mb-20px">
                <a href="#fashion-2-product">
                  <img :src="properties.resolveAsset(data.product.assetId)" alt="" />
                  <span class="lable new">{{ data.product.badge }}</span>
                  <span class="shop-overlay bg-gradient-gray-light-dark-transparent" />
                </a>
                <div class="shop-buttons-wrap">
                  <button
                    type="button"
                    class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                    @click="addToCart"
                  >
                    <i class="feather icon-feather-shopping-bag" />
                    <span class="quick-view-text button-text">Add to cart</span>
                  </button>
                </div>
                <div class="shop-hover d-flex justify-content-center">
                  <ul>
                    <li>
                      <button
                        type="button"
                        class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                        aria-label="Add to wishlist"
                      >
                        <i class="feather icon-feather-heart fs-16" />
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                        aria-label="Quick shop"
                      >
                        <i class="feather icon-feather-eye fs-16" />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <div class="shop-footer text-center">
                <a href="#fashion-2-product" class="alt-font text-dark-gray fs-19 fw-500">
                  {{ data.product.name }}
                </a>
                <div class="price lh-22 fs-16">
                  <del>{{ data.product.originalPrice }}</del
                  >{{ data.product.price }}
                </div>
                <p v-if="actionFeedback" class="fashion-2-action-feedback" role="status">
                  {{ actionFeedback }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
