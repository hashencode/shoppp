<script setup lang="ts">
import { Autoplay, EffectFade, Keyboard } from "swiper/modules";
import type { Swiper as SwiperInstance, SwiperOptions } from "swiper/types";
import { Swiper, SwiperSlide } from "swiper/vue";

import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { fashionStoreAssetId } from "../../resources";
import {
  fashionStoreDecorProductsMessage,
  type FashionStoreDecorHomeModel,
} from "../../contracts/decor-home";
import type { FashionStoreProductCardPresentation } from "../../contracts/product-card";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { useFashionStoreMotionViewport } from "../../composables/useFashionStoreMotionViewport";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";

const properties = defineProps<{
  model: FashionStoreDecorHomeModel;
  resolveAsset: ThemeAssetResolver;
}>();

const selectedGroup = ref<"best-sellers" | "new-arrivals">("best-sellers");

function asset(path: string): string {
  return properties.resolveAsset(fashionStoreAssetId(path));
}

const currentProducts = computed<readonly FashionStoreProductCardPresentation[]>(() => {
  if (properties.model.merchandising.state !== "populated") return [];
  const group = properties.model.merchandising.data.groups.find(
    ({ id }) => id === selectedGroup.value,
  );
  return group?.products ?? [];
});

const productsMessage = computed(() =>
  fashionStoreDecorProductsMessage(properties.model.merchandising, currentProducts.value.length),
);

const collectionProducts = computed(() => {
  const merchandising = properties.model.merchandising;
  if (merchandising.state !== "populated") return [];
  const products =
    merchandising.data.groups.find(({ id }) => id === "best-sellers")?.products ?? [];
  return products.slice(0, 3).map((product) => ({
    actionState: product.actionState.kind,
    alt: product.media?.alt ?? product.name,
    href:
      product.destination.kind === "available"
        ? product.destination.href
        : fashionStoreRoutePaths.product,
    id: product.productId,
    image:
      product.media?.kind === "url"
        ? product.media.src
        : product.media
          ? asset(product.media.path)
          : undefined,
    name: product.name,
    originalPrice: product.compareAtPriceLabel ?? "",
    price: product.priceLabel,
  }));
});

const collectionIndex = ref(0);
type MotionPauseReason = "document-hidden" | "focus" | "reduced-motion" | "viewport-hidden";
const promotionalMarqueeRoot = ref<HTMLElement>();
const collectionRoot = ref<HTMLElement>();
const clientMarqueeRoot = ref<HTMLElement>();
const promotionalMarqueeVisible = useFashionStoreMotionViewport(promotionalMarqueeRoot);
const collectionVisible = useFashionStoreMotionViewport(collectionRoot);
const clientMarqueeVisible = useFashionStoreMotionViewport(clientMarqueeRoot);
const motionPauseReasons = reactive(new Set<MotionPauseReason>(["viewport-hidden"]));
const motionPauseReason = computed(() => [...motionPauseReasons].join(","));
const globalMotionPauseReason = computed(() =>
  [...motionPauseReasons]
    .filter((reason) => reason === "document-hidden" || reason === "reduced-motion")
    .join(","),
);
const promotionalMarqueePauseReason = computed(() =>
  [globalMotionPauseReason.value, promotionalMarqueeVisible.value ? "" : "viewport-hidden"]
    .filter(Boolean)
    .join(","),
);
const clientMarqueePauseReason = computed(() =>
  [globalMotionPauseReason.value, clientMarqueeVisible.value ? "" : "viewport-hidden"]
    .filter(Boolean)
    .join(","),
);
const motionReady = ref(false);
const collectionMotionPhase = ref<"idle" | "transition">("idle");
const collectionSwiper = shallowRef<SwiperInstance>();
const collectionSpeed = computed(() => (motionPauseReasons.has("reduced-motion") ? 0 : 600));
const collectionAutoplay = computed<SwiperOptions["autoplay"]>(() =>
  collectionProducts.value.length > 1
    ? { delay: 3_000, disableOnInteraction: false, pauseOnMouseEnter: false }
    : false,
);
let reducedMotionQuery: MediaQueryList | undefined;

function syncCollectionAutoplay(): void {
  const instance = collectionSwiper.value;
  if (!instance) return;
  instance.params.speed = collectionSpeed.value;
  if (!instance.autoplay) return;
  if (motionPauseReasons.size > 0 || collectionProducts.value.length < 2) {
    instance.autoplay.stop();
    if (motionPauseReasons.has("viewport-hidden") && collectionMotionPhase.value === "transition") {
      instance.slideToLoop(collectionIndex.value, 0, false);
      collectionMotionPhase.value = "idle";
    }
  } else {
    instance.autoplay.start();
  }
}

function handleCollectionSwiper(instance: SwiperInstance): void {
  collectionSwiper.value = instance;
  collectionIndex.value = instance.realIndex;
  motionReady.value = true;
  syncCollectionAutoplay();
}

function handleCollectionIndex(instance: SwiperInstance): void {
  collectionIndex.value = instance.realIndex;
}

function handleCollectionTransitionEnd(): void {
  collectionMotionPhase.value = "idle";
  syncCollectionAutoplay();
}

function updateDocumentMotion(): void {
  updatePauseReason("document-hidden", document.hidden);
  updatePauseReason("reduced-motion", reducedMotionQuery?.matches === true);
  syncCollectionAutoplay();
}

function updatePauseReason(reason: MotionPauseReason, enabled: boolean): boolean {
  if (motionPauseReasons.has(reason) === enabled) return false;
  if (enabled) motionPauseReasons.add(reason);
  else motionPauseReasons.delete(reason);
  return true;
}

function setCollectionFocus(paused: boolean): void {
  if (paused) collectionSwiper.value?.keyboard?.enable();
  else collectionSwiper.value?.keyboard?.disable();
  if (!updatePauseReason("focus", paused)) return;
  syncCollectionAutoplay();
}

function handleCollectionFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget))
    return;
  setCollectionFocus(false);
}

watch(
  () => collectionProducts.value.length,
  async (count) => {
    await nextTick();
    collectionSwiper.value?.update();
    if (count < 2) collectionSwiper.value?.slideTo(0, 0);
    syncCollectionAutoplay();
  },
);

watch(collectionVisible, (visible) => {
  updatePauseReason("viewport-hidden", !visible);
  syncCollectionAutoplay();
});

onMounted(() => {
  reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionQuery.addEventListener("change", updateDocumentMotion);
  updateDocumentMotion();
  document.addEventListener("visibilitychange", updateDocumentMotion);
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener("change", updateDocumentMotion);
  reducedMotionQuery = undefined;
  document.removeEventListener("visibilitychange", updateDocumentMotion);
});
</script>

<template>
  <div class="fashion-store-decor-home" data-decor-home-body>
    <section data-decor-region="featured-categories" class="position-relative pt-0 overflow-hidden">
      <div class="container container position-relative z-index-9">
        <div class="row align-items-center mb-6 mt-7 xs-mb-30px xs-mt-35px">
          <div
            class="col-xl-2 col-lg-3 md-mb-40px"
            data-anime='{ "translateX": [50, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
          >
            <div class="feature-box feature-box-left-icon-middle mb-5px">
              <div class="feature-box-icon me-5px">
                <span class="text-red fs-13" aria-hidden="true">♥</span>
              </div>
              <div class="feature-box-content">
                <span class="d-inline-block fs-16 fw-500 alt-font text-dark-gray">On demand</span>
              </div>
            </div>
            <h6 class="mb-0 fw-700 alt-font text-dark-gray">Featured categories</h6>
          </div>
          <div class="col-xl-10 col-lg-9">
            <div
              class="row row-cols-2 row-cols-md-6 row-cols-sm-3 justify-content-center align-items-center"
              data-anime='{ "el": "childs", "translateX": [50, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
            >
              <div class="col categories-style-01 text-center sm-mb-30px">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Lamp category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-01.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      02
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Lamp</a
                  >
                </div>
              </div>
              <div class="col categories-style-01 text-center sm-mb-30px">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Stool category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-03.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      03
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Stool</a
                  >
                </div>
              </div>
              <div class="col categories-style-01 text-center sm-mb-30px">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Chair category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-02.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      05
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Chair</a
                  >
                </div>
              </div>
              <div class="col categories-style-01 text-center xs-mb-30px">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Cabinet category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-10.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      03
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Cabinet</a
                  >
                </div>
              </div>
              <div class="col categories-style-01 text-center">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Light category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-04.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      08
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Light</a
                  >
                </div>
              </div>
              <div class="col categories-style-01 text-center">
                <div class="categories-box">
                  <div class="icon-box position-relative mb-10px">
                    <a
                      :href="model.collectionHref"
                      aria-label="Browse Sofa category"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-icon-05.png')" alt=""
                    /></a>
                    <div
                      class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
                    >
                      04
                    </div>
                  </div>
                  <a
                    :href="model.collectionHref"
                    data-fashion-store-route
                    class="alt-font fw-600 fs-17 text-dark-gray text-dark-gray-hover"
                    >Sofa</a
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="row g-0">
          <div class="col-12 filter-content">
            <ul
              class="shop-wrapper shop-grid grid-loading grid grid-2col xxl-grid-2col xl-grid-2col lg-grid-2col md-grid-1col sm-grid-1col xs-grid-1col gutter-large text-center"
              data-anime='{ "el": "childs", "translate": [50, 0], "opacity": [0,1], "duration": 600, "delay":150, "staggervalue": 150, "easing": "easeOutQuad" }'
            >
              <li class="grid-sizer"></li>
              <!-- start shop item -->
              <li class="grid-item">
                <div class="shop-box position-relative overflow-hidden">
                  <div class="shop-image">
                    <img :src="asset('images/demo-decor-store-main-banner-01.jpg')" alt="" />
                  </div>
                  <div
                    class="position-absolute top-0 left-0 w-100 h-100 d-flex align-items-end justify-content-start text-start"
                  >
                    <div class="p-14 sm-p-10 w-80 lg-w-90 md-w-65 xs-w-300px">
                      <h3 class="alt-font text-dark-gray ls-minus-1px mb-30px xs-mb-25px">
                        Wooden <span class="fw-700">classic table</span>
                      </h3>
                      <a
                        :href="model.collectionHref"
                        data-fashion-store-route
                        class="btn btn-dark-gray btn-large btn-switch-text btn-round-edge btn-box-shadow"
                      >
                        <span>
                          <span class="btn-double-text" data-text="Explore category"
                            >Explore category</span
                          >
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </li>
              <!-- end shop item -->
              <!-- start shop item -->
              <li class="grid-item">
                <div class="shop-box position-relative overflow-hidden">
                  <div class="shop-image">
                    <img :src="asset('images/demo-decor-store-main-banner-02.jpg')" alt="" />
                  </div>
                  <div
                    class="position-absolute top-0 left-0 w-100 h-100 d-flex align-items-center justify-content-start text-start"
                  >
                    <div class="p-11 xs-p-8 w-60 md-w-50 xs-w-230px">
                      <h5 class="alt-font text-dark-gray ls-minus-1px mb-25px xs-mb-20px">
                        Pottery <span class="fw-700">products</span>
                      </h5>
                      <a
                        :href="model.collectionHref"
                        data-fashion-store-route
                        class="btn btn-dark-gray btn-small btn-switch-text btn-round-edge btn-box-shadow"
                      >
                        <span>
                          <span class="btn-double-text" data-text="Explore category"
                            >Explore category</span
                          >
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </li>
              <!-- end shop item -->
              <!-- start shop item -->
              <li class="grid-item">
                <div class="shop-box position-relative overflow-hidden">
                  <div class="shop-image">
                    <img :src="asset('images/demo-decor-store-main-banner-03.jpg')" alt="" />
                  </div>
                  <div
                    class="position-absolute top-0 left-0 w-100 h-100 d-flex align-items-center justify-content-end text-start"
                  >
                    <div class="p-11 xs-p-5 w-55 md-w-50 xs-w-200px">
                      <h5 class="alt-font text-dark-gray ls-minus-1px mb-25px xs-mb-20px">
                        Florence <span class="fw-700">compact</span>
                      </h5>
                      <a
                        :href="model.collectionHref"
                        data-fashion-store-route
                        class="btn btn-dark-gray btn-small btn-switch-text btn-round-edge btn-box-shadow"
                      >
                        <span>
                          <span class="btn-double-text" data-text="Explore category"
                            >Explore category</span
                          >
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </li>
              <!-- end shop item -->
            </ul>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section data-decor-region="products" class="pt-0 pb-0">
      <div class="container">
        <div class="row mb-4">
          <div class="col-12 tab-style-04">
            <ul
              class="fashion-store-merchandising-selector nav nav-tabs border-0 justify-content-center text-uppercase fw-600 mb-50px sm-mb-20px alt-font fs-32 ls-minus-05px text-transform-none"
              data-decor-product-tabs
            >
              <li class="nav-item">
                <button
                  type="button"
                  class="nav-link"
                  :class="{ active: selectedGroup === 'best-sellers' }"
                  :aria-pressed="selectedGroup === 'best-sellers'"
                  @click="selectedGroup = 'best-sellers'"
                >
                  Best sellers<span class="tab-border bg-dark-gray h-2px"></span>
                </button>
              </li>
              <li class="nav-item">
                <button
                  type="button"
                  class="nav-link"
                  :class="{ active: selectedGroup === 'new-arrivals' }"
                  :aria-pressed="selectedGroup === 'new-arrivals'"
                  @click="selectedGroup = 'new-arrivals'"
                >
                  New arrivals<span class="tab-border bg-dark-gray h-2px"></span>
                </button>
              </li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade in active show" :data-merchandising-panel="selectedGroup">
                <div class="row">
                  <div class="col-12 filter-content">
                    <ul
                      v-if="currentProducts.length"
                      class="shop-boxed shop-wrapper grid grid-4col xxl-grid-5col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-large text-center"
                    >
                      <li class="grid-sizer"></li>
                      <FashionStoreProductCard
                        v-for="product in currentProducts.slice(0, 8)"
                        :key="product.productId"
                        :product="product"
                        :resolve-asset="resolveAsset"
                        :surface="'home-merchandising'"
                      />
                    </ul>
                    <p
                      v-else
                      class="fashion-store-decor-home__products-state text-center"
                      data-decor-products-state
                    >
                      {{ productsMessage }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section
      ref="promotionalMarqueeRoot"
      data-decor-region="promotional-marquee"
      class="pt-0"
      data-anime='{ "translateX": [0, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
    >
      <div class="container-fluid ps-8 pe-8">
        <div class="row position-relative">
          <div
            class="col swiper text-cente feather-shadow"
            data-slider-options='{ "slidesPerView": "auto", "spaceBetween":0, "centeredSlides": true, "speed": 8000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":1, "disableOnInteraction": false }, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "effect": "slide" }'
          >
            <div
              class="swiper-wrapper pb-20px swiper-width-auto marquee-slide"
              data-decor-promotion-track
              :data-motion-paused="promotionalMarqueePauseReason"
            >
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Pay with multiple credit cards
                </div>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Get offer up to 50% on modern furniture
                </div>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Free shipping for orders over $130
                </div>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Pay with multiple credit cards
                </div>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Get offer up to 50% on modern furniture
                </div>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <div class="fs-50 text-dark-gray alt-font fw-700 ls-minus-1px">
                  <span
                    class="w-15px h-15px border border-2 border-radius-100 border-color-medium-gray d-inline-block align-middle ms-50px me-50px"
                  ></span>
                  Free shipping for orders over $130
                </div>
              </div>
              <!-- end client item -->
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section
      ref="collectionRoot"
      data-decor-region="collection-carousel"
      class="py-0 overflow-hidden"
    >
      <div class="container-fluid p-0">
        <div class="row g-0">
          <div
            class="col-md-8 cover-background"
            :style="{ backgroundImage: `url(${asset('images/demo-decor-store-banner-04.jpg')})` }"
            data-anime='{ "translateX": [-50, 0], "opacity": [0,1], "duration": 600, "delay":150, "staggervalue": 150, "easing": "easeOutQuad" }'
          >
            <div class="pt-13 pb-13 pe-5 w-40 xl-w-45 lg-w-55 md-w-65 sm-w-50 xs-w-270px float-end">
              <span
                class="fs-15 fw-700 text-dark-gray text-uppercase mb-20px xs-mb-15px d-inline-block text-decoration-line-bottom-medium"
                >Save up to 50% off</span
              >
              <h1 class="alt-font fw-400 text-dark-gray mb-40px lg-mb-35px xs-mb-25px ls-minus-1px">
                Lounge <span class="fw-700">collection</span>
              </h1>
              <a
                :href="model.collectionHref"
                data-fashion-store-route
                class="btn btn-dark-gray btn-extra-large btn-switch-text btn-round-edge btn-box-shadow"
              >
                <span>
                  <span class="btn-double-text" data-text="Explore category">Explore category</span>
                </span>
              </a>
            </div>
          </div>
          <div
            class="col-md-4"
            data-anime='{ "translateX": [50, 0], "opacity": [0,1], "duration": 600, "delay":150, "staggervalue": 150, "easing": "easeOutQuad" }'
          >
            <Swiper
              class="swiper position-relative h-100"
              tabindex="0"
              data-decor-collection-carousel
              :modules="[Autoplay, EffectFade, Keyboard]"
              :slides-per-view="1"
              :speed="collectionSpeed"
              :autoplay="collectionAutoplay"
              :loop="collectionProducts.length > 1"
              :allow-touch-move="true"
              :keyboard="{ enabled: false, onlyInViewport: true }"
              effect="fade"
              :fade-effect="{ crossFade: true }"
              :watch-overflow="true"
              :data-motion-ready="motionReady"
              :data-motion-active-index="collectionIndex"
              :data-motion-paused="motionPauseReason"
              :data-motion-phase="collectionMotionPhase"
              @swiper="handleCollectionSwiper"
              @real-index-change="handleCollectionIndex"
              @transition-start="collectionMotionPhase = 'transition'"
              @transition-end="handleCollectionTransitionEnd"
              @focusin="setCollectionFocus(true)"
              @focusout="handleCollectionFocusOut"
            >
              <SwiperSlide
                v-for="product in collectionProducts"
                :key="product.id"
                data-decor-collection-slide
                :data-action-state="product.actionState"
                :data-product-id="product.id"
                class="cover-background h-100 text-center"
                :style="{
                  backgroundImage: `url(${asset('images/demo-decor-store-product-slider-bg-img.jpg')})`,
                }"
              >
                <a :href="product.href" data-fashion-store-route>
                  <img v-if="product.image" :src="product.image" :alt="product.alt" />
                  <span v-else class="fashion-store-product-placeholder" aria-hidden="true"></span>
                </a>
                <div
                  class="position-absolute bottom-70px xs-bottom-25px w-100 left-0 text-center ls-minus-05px"
                >
                  <a
                    :href="product.href"
                    data-fashion-store-route
                    class="text-dark-gray alt-font d-inline-block fs-20 fw-600"
                    >{{ product.name }}</a
                  >
                  <div class="d-block">
                    <div class="d-inline-block align-middle fs-18 fw-600 text-dark-gray">
                      <del
                        v-if="product.originalPrice"
                        class="me-10px fashion-store-compare-at-price"
                        >{{ product.originalPrice }}</del
                      >{{ product.price }}
                    </div>
                  </div>
                </div>
              </SwiperSlide>
              <!-- end text slider item -->
              <p
                v-if="collectionProducts.length === 0"
                class="position-absolute top-50 start-50 translate-middle text-center text-dark-gray"
                data-decor-collection-state
              >
                {{ productsMessage }}
              </p>
              <!-- start slider navigation -->
              <button
                v-if="motionReady && collectionProducts.length > 1"
                type="button"
                aria-label="Show previous collection item"
                class="slider-one-slide-prev-1 swiper-button-prev slider-navigation-style-06"
                @click="collectionSwiper?.slidePrev()"
              >
                <FashionStoreIcon name="arrow-left" />
              </button>
              <button
                v-if="motionReady && collectionProducts.length > 1"
                type="button"
                aria-label="Show next collection item"
                class="slider-one-slide-next-1 swiper-button-next slider-navigation-style-06"
                @click="collectionSwiper?.slideNext()"
              >
                <FashionStoreIcon name="arrow-right" />
              </button>
              <!-- end slider navigation -->
            </Swiper>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section
      ref="clientMarqueeRoot"
      data-decor-region="client-marquee"
      class="half-section"
      data-anime='{ "translate": [0, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
    >
      <div class="container">
        <div class="row position-relative clients-style-08">
          <div
            class="col swiper text-center feather-shadow"
            data-slider-options='{ "slidesPerView": 1, "spaceBetween":0, "speed": 3000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":0, "disableOnInteraction": false, "pauseOnMouseEnter": false}, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "breakpoints": { "1200": { "slidesPerView": 4 }, "992": { "slidesPerView": 3 }, "768": { "slidesPerView": 3 }, "576": { "slidesPerView": 2 } }, "effect": "slide" }'
          >
            <div
              class="swiper-wrapper marquee-slide"
              data-decor-client-track
              :data-motion-paused="clientMarqueePauseReason"
            >
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Forbes" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-01.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Medium" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-02.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Pepperfry" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-03.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Article" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-04.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Instagram" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-05.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Forbes" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-01.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Medium" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-02.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Pepperfry" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-03.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Article" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-04.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
              <!-- start client item -->
              <div class="swiper-slide">
                <a :href="model.collectionHref" aria-label="Instagram" data-fashion-store-route
                  ><img :src="asset('images/demo-decor-store-client-05.png')" alt=""
                /></a>
              </div>
              <!-- end client item -->
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section
      data-decor-region="journal"
      class="pb-3 bg-gradient-very-light-gray lg-pb-40px md-pb-20px"
    >
      <div class="container">
        <div class="row justify-content-center mb-25px">
          <div
            class="col-lg-5 text-center"
            data-anime='{ "el": "childs", "translateY": [50, 0], "opacity": [0,1], "duration": 600, "delay": 0, "staggervalue": 150, "easing": "easeOutQuad" }'
          >
            <span class="text-uppercase fs-14 ls-2px fw-600">Designers ideas</span>
            <h4 class="alt-font text-dark-gray fw-700 mb-20px">The decor article</h4>
          </div>
        </div>
        <div class="row">
          <div class="col-12">
            <ul
              class="blog-classic blog-wrapper grid-loading grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large"
              data-anime='{ "el": "childs", "translateY": [50, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
            >
              <li class="grid-sizer"></li>
              <!-- start blog item -->
              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden border-radius-4px">
                    <a
                      :href="model.articleHref"
                      aria-label="The best influencers to follow for sartorial inspiration"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-blog-07.jpg')" alt=""
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px xs-pb-15px">
                    <span class="fs-13 text-uppercase d-block mb-5px fw-500"
                      ><a
                        :href="model.articleHref"
                        data-fashion-store-route
                        class="text-dark-gray fw-700 categories-text"
                        >Decor</a
                      ><a :href="model.collectionHref" data-fashion-store-route class="blog-date"
                        >08 August 2023</a
                      ></span
                    >
                    <a
                      :href="model.articleHref"
                      data-fashion-store-route
                      class="card-title alt-font fw-600 fs-17 lh-30 text-dark-gray d-inline-block w-95 sm-w-100"
                      >The best influencers to follow for sartorial inspiration</a
                    >
                  </div>
                </div>
              </li>
              <!-- end blog item -->
              <!-- start blog item -->
              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden border-radius-4px">
                    <a
                      :href="model.articleHref"
                      aria-label="Everything you need to know about decor's big night out"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-blog-08.jpg')" alt=""
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px xs-pb-15px">
                    <span class="fs-13 text-uppercase d-block mb-5px fw-500"
                      ><a
                        :href="model.articleHref"
                        data-fashion-store-route
                        class="text-dark-gray fw-700 categories-text"
                        >Design</a
                      ><a :href="model.collectionHref" data-fashion-store-route class="blog-date"
                        >12 August 2023</a
                      ></span
                    >
                    <a
                      :href="model.articleHref"
                      data-fashion-store-route
                      class="card-title alt-font fw-600 fs-17 lh-30 text-dark-gray d-inline-block w-95 sm-w-100"
                      >Everything you need to know about decor's big night out</a
                    >
                  </div>
                </div>
              </li>
              <!-- end blog item -->
              <!-- start blog item -->
              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden border-radius-4px">
                    <a
                      :href="model.articleHref"
                      aria-label="All the best looks & moments from the met gala 2023"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-blog-04.jpg')" alt=""
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px xs-pb-15px">
                    <span class="fs-13 text-uppercase d-block mb-5px fw-500"
                      ><a
                        :href="model.articleHref"
                        data-fashion-store-route
                        class="text-dark-gray fw-700 categories-text"
                        >Decor</a
                      ><a :href="model.collectionHref" data-fashion-store-route class="blog-date"
                        >20 August 2023</a
                      ></span
                    >
                    <a
                      :href="model.articleHref"
                      data-fashion-store-route
                      class="card-title alt-font fw-600 fs-17 lh-30 text-dark-gray d-inline-block w-95 sm-w-100"
                      >All the best looks & moments from the met gala 2023</a
                    >
                  </div>
                </div>
              </li>
              <!-- end blog item -->
              <!-- start blog item -->
              <li class="grid-item">
                <div class="card bg-transparent border-0 h-100">
                  <div class="blog-image position-relative overflow-hidden border-radius-4px">
                    <a
                      :href="model.articleHref"
                      aria-label="Find a colour palettes that reflects your passion"
                      data-fashion-store-route
                      ><img :src="asset('images/demo-decor-store-blog-03.jpg')" alt=""
                    /></a>
                  </div>
                  <div class="card-body px-0 pt-30px pb-30px xs-pb-15px">
                    <span class="fs-13 text-uppercase d-block mb-5px fw-500"
                      ><a
                        :href="model.articleHref"
                        data-fashion-store-route
                        class="text-dark-gray fw-700 categories-text"
                        >Decor</a
                      ><a :href="model.collectionHref" data-fashion-store-route class="blog-date"
                        >26 August 2023</a
                      ></span
                    >
                    <a
                      :href="model.articleHref"
                      data-fashion-store-route
                      class="card-title alt-font fw-600 fs-17 lh-30 text-dark-gray d-inline-block w-95 sm-w-100"
                      >Find a colour palettes that reflects your passion</a
                    >
                  </div>
                </div>
              </li>
              <!-- end blog item -->
            </ul>
          </div>
        </div>
      </div>
    </section>
    <!-- end section -->
    <!-- start section -->
    <section
      data-decor-region="services"
      class="border-top border-color-extra-medium-gray py-0 overflow-hidden"
    >
      <div class="container-fluid">
        <div
          class="row row-cols-1 row-cols-lg-4 row-cols-sm-2 justify-content-center"
          data-anime='{ "el": "childs", "translateX": [50, 0], "opacity": [0,1], "duration": 600, "delay":100, "staggervalue": 150, "easing": "easeOutQuad" }'
        >
          <!-- start features box item -->
          <div
            class="col d-flex justify-content-center icon-with-text-style-08 text-center border-end md-border-bottom xs-border-end-0 border-color-extra-medium-gray pt-45px pb-45px"
          >
            <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
              <div class="feature-box-icon me-15px">
                <FashionStoreIcon
                  name="package"
                  class="icon-large text-dark-gray"
                  :stroke-width="1.5"
                />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fw-600 text-dark-gray d-block lh-24 fs-17"
                  >Free shipping</span
                >
                <span>Free return & exchange</span>
              </div>
            </div>
          </div>
          <!-- end features box item -->
          <!-- start features box item -->
          <div
            class="col d-flex justify-content-center icon-with-text-style-08 text-center border-end md-border-bottom md-border-end-0 border-color-extra-medium-gray pt-45px pb-45px"
          >
            <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
              <div class="feature-box-icon me-15px">
                <FashionStoreIcon
                  name="map-pin"
                  class="icon-large text-dark-gray"
                  :stroke-width="1.5"
                />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fw-600 text-dark-gray d-block lh-24 fs-17"
                  >Store locator</span
                >
                <span>Find nearest store</span>
              </div>
            </div>
          </div>
          <!-- end features box item -->
          <!-- start features box item -->
          <div
            class="col d-flex justify-content-center icon-with-text-style-08 text-center border-end xs-border-bottom xs-border-end-0 border-color-extra-medium-gray pt-45px pb-45px"
          >
            <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
              <div class="feature-box-icon me-15px">
                <FashionStoreIcon
                  name="credit-card"
                  class="icon-large text-dark-gray"
                  :stroke-width="1.5"
                />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fw-600 text-dark-gray d-block lh-24 fs-17"
                  >Secure payment</span
                >
                <span>100% secure method</span>
              </div>
            </div>
          </div>
          <!-- end features box item -->
          <!-- start features box item -->
          <div
            class="col d-flex justify-content-center icon-with-text-style-08 text-center pt-45px pb-45px"
          >
            <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
              <div class="feature-box-icon me-15px">
                <FashionStoreIcon
                  name="headphones"
                  class="icon-large text-dark-gray"
                  :stroke-width="1.5"
                />
              </div>
              <div class="feature-box-content">
                <span class="alt-font fw-600 text-dark-gray d-block lh-24 fs-17"
                  >Online support</span
                >
                <span>24/7 support center</span>
              </div>
            </div>
          </div>
          <!-- end features box item -->
        </div>
      </div>
    </section>
    <!-- end section -->
  </div>
</template>
