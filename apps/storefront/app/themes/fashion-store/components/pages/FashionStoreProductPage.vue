<script setup lang="ts">
import { recordPreviewIntent, storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import {
  buildFashionStoreProductCartRequest,
  clampFashionStoreProductQuantity,
  type FashionStoreProductData,
} from "../../fixtures/pages/product";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreProductLightbox from "../shared/FashionStoreProductLightbox.vue";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed<FashionStoreProductData>(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Product requires a theme-section fixture.");
  }
  return properties.viewModel.data as unknown as FashionStoreProductData;
});
const galleryIndex = ref(0);
const galleryPaused = ref(false);
const gallery = computed(() => data.value.gallery);
// The source document marks every radio as checked, so the browser resolves the
// group to its final option during parsing.
const selectedColor = ref(data.value.options.colors.at(-1)?.id ?? "");
const selectedSize = ref(data.value.options.sizes.at(-1)?.id ?? "");
const quantity = ref(1);
const activeTab = ref<"description" | "information" | "reviews" | "shipping">("description");
const tabIds = ["description", "information", "shipping", "reviews"] as const;
const cartAddCount = ref(0);
const cartBusy = ref(false);
const optionUpdateCount = ref(0);
const reviewAttemptCount = ref(0);
const previewIntentCount = ref(0);
const lightbox = ref<InstanceType<typeof FashionStoreProductLightbox>>();
const thumbnailTrack = ref<HTMLElement | null>(null);
const thumbnailStep = ref(0);
const thumbnailHorizontal = ref(false);
const actionAdapter = inject(storefrontActionAdapterKey);
let galleryTimer: ReturnType<typeof setInterval> | undefined;
let touchStartX = 0;

const thumbnailTrackStyle = computed(() => {
  const visibleThumbnails = thumbnailHorizontal.value ? 4 : 3;
  const maximumStart = Math.max(0, gallery.value.length - visibleThumbnails);
  const startIndex = Math.min(
    Math.max(0, galleryIndex.value - visibleThumbnails + 1),
    maximumStart,
  );
  const offset = startIndex * thumbnailStep.value;
  return {
    transform: thumbnailHorizontal.value
      ? `translate3d(${-offset}px, 0, 0)`
      : `translate3d(0, ${-offset}px, 0)`,
  };
});

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function showGallery(index: number): void {
  galleryIndex.value = (index + gallery.value.length) % gallery.value.length;
}

function stopGalleryAutoplay(): void {
  if (galleryTimer) clearInterval(galleryTimer);
  galleryTimer = undefined;
}

function startGalleryAutoplay(): void {
  stopGalleryAutoplay();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  galleryTimer = setInterval(() => {
    if (!galleryPaused.value) showGallery(galleryIndex.value + 1);
  }, 2_000);
}

function updateThumbnailTrack(): void {
  const track = thumbnailTrack.value;
  const slide = track?.querySelector<HTMLElement>(".swiper-slide");
  if (!track || !slide) return;
  thumbnailHorizontal.value = matchMedia("(max-width: 991px)").matches;
  const slideStyle = getComputedStyle(slide);
  const trackStyle = getComputedStyle(track);
  thumbnailStep.value = thumbnailHorizontal.value
    ? slide.getBoundingClientRect().width + Number.parseFloat(slideStyle.marginRight || "0")
    : slide.getBoundingClientRect().height + Number.parseFloat(trackStyle.rowGap || "0");
}

function handleGalleryKey(event: KeyboardEvent): void {
  if (event.key === "ArrowLeft") showGallery(galleryIndex.value - 1);
  else if (event.key === "ArrowRight") showGallery(galleryIndex.value + 1);
  else if (event.key === "Enter" || event.key === " ") lightbox.value?.open();
  else return;
  event.preventDefault();
}

function handleTouchEnd(event: TouchEvent): void {
  const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  if (Math.abs(delta) < 40) return;
  showGallery(galleryIndex.value + (delta < 0 ? 1 : -1));
}

function selectOption(group: "color" | "size", value: string): void {
  const selected = group === "color" ? selectedColor : selectedSize;
  if (selected.value === value) return;
  selected.value = value;
  optionUpdateCount.value += 1;
  recordPreviewIntent(
    {
      id: `product-select-${group}`,
      intent: "variant.select",
      label: `Select product ${group}`,
      value,
    },
    "fashion-store.product.option",
  );
}

function updateQuantity(next: number): void {
  const value = clampFashionStoreProductQuantity(next);
  if (quantity.value === value) return;
  quantity.value = value;
  optionUpdateCount.value += 1;
  recordPreviewIntent(
    {
      id: "product-update-quantity",
      intent: "cart.quantity-preview",
      label: "Update product quantity",
      value: String(value),
    },
    "fashion-store.product.quantity",
  );
}

async function addToCart(): Promise<void> {
  if (cartBusy.value) return;
  recordPreviewIntent(data.value.actions.cart, "fashion-store.product.cart");
  previewIntentCount.value += 1;
  cartBusy.value = true;
  try {
    if (!actionAdapter) throw new Error("Preview action adapter unavailable");
    await actionAdapter({
      context: "fashion-store.product.cart",
      currency: "USD",
      input: buildFashionStoreProductCartRequest(
        quantity.value,
        selectedColor.value,
        selectedSize.value,
      ),
      kind: "cart.add",
    });
    cartAddCount.value += 1;
  } catch {
    // The typed guest-cart owner retains its existing error state; source-visible feedback is absent.
  } finally {
    cartBusy.value = false;
  }
}

function recordAction(kind: "compare" | "question" | "share" | "wishlist"): void {
  recordPreviewIntent(data.value.actions[kind], `fashion-store.product.${kind}`);
  previewIntentCount.value += 1;
}

function activateTab(index: number): void {
  activeTab.value = tabIds[(index + tabIds.length) % tabIds.length]!;
}

function handleTabKey(event: KeyboardEvent, index: number): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const nextIndex = index + (event.key === "ArrowRight" ? 1 : -1);
  activateTab(nextIndex);
  void nextTick(() => {
    document.querySelector<HTMLButtonElement>(`#product-tab-${activeTab.value}`)?.focus();
  });
}

function submitReview(): void {
  reviewAttemptCount.value += 1;
}

function recordRelatedIntent(kind: "cart" | "quickView" | "wishlist"): void {
  const action =
    kind === "cart"
      ? data.value.actions.cart
      : kind === "wishlist"
        ? data.value.actions.wishlist
        : {
            id: "product-related-quick-view",
            intent: "product.quick-view-preview" as const,
            label: "Quick shop related product",
          };
  recordPreviewIntent(action, "fashion-store.product.related");
  previewIntentCount.value += 1;
}

onMounted(() => {
  startGalleryAutoplay();
  void nextTick(updateThumbnailTrack);
  window.addEventListener("resize", updateThumbnailTrack);
});
onBeforeUnmount(() => {
  stopGalleryAutoplay();
  window.removeEventListener("resize", updateThumbnailTrack);
});
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :preload-image="sourceAsset(data.gallery[0]!)"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-product
      data-runtime-status="ready"
      :data-cart-add-count="cartAddCount"
      :data-option-update-count="optionUpdateCount"
      :data-preview-intent-count="previewIntentCount"
      :data-review-attempt-count="reviewAttemptCount"
    >
      <section
        class="top-space-margin bg-gradient-very-light-gray pt-20px pb-20px ps-45px pe-45px sm-ps-15px sm-pe-15px"
      >
        <div class="container-fluid">
          <div class="row align-items-center">
            <nav class="col-12 breadcrumb breadcrumb-style-01 fs-14" aria-label="Breadcrumb">
              <ul>
                <li><a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a></li>
                <li>
                  <a :href="fashionStoreRoutePaths['shop-left']" data-fashion-store-route>Shop</a>
                </li>
                <li>Relaxed corduroy shirt</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-60px pb-0 md-pt-30px fashion-product-detail">
        <div class="container">
          <div class="row">
            <div class="col-lg-7 pe-50px md-pe-15px md-mb-40px fashion-product-gallery">
              <div class="row overflow-hidden position-relative">
                <div
                  class="col-12 col-lg-10 position-relative order-lg-2 product-image ps-30px md-ps-15px"
                >
                  <div
                    class="swiper product-image-slider"
                    tabindex="0"
                    role="group"
                    aria-label="Product gallery"
                    :data-gallery-index="galleryIndex"
                    @mouseenter="galleryPaused = true"
                    @mouseleave="galleryPaused = false"
                    @focusin="galleryPaused = true"
                    @focusout="galleryPaused = false"
                    @keydown="handleGalleryKey"
                    @touchstart="touchStartX = $event.touches[0]?.clientX ?? 0"
                    @touchend="handleTouchEnd"
                  >
                    <div
                      class="swiper-wrapper"
                      :style="{
                        transform: `translate3d(calc(-${galleryIndex * 100}% - ${galleryIndex * 10}px), 0, 0)`,
                      }"
                    >
                      <div
                        v-for="(image, index) in gallery"
                        :key="image"
                        class="swiper-slide gallery-box"
                        :class="{ 'swiper-slide-active': index === galleryIndex }"
                        :aria-hidden="index === galleryIndex ? undefined : 'true'"
                        :inert="index === galleryIndex ? undefined : true"
                      >
                        <button
                          type="button"
                          aria-label="Open product image preview"
                          @click="lightbox?.open()"
                        >
                          <img
                            class="w-100"
                            :src="sourceAsset(image)"
                            alt=""
                            width="600"
                            height="765"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-lg-2 order-lg-1 position-relative single-product-thumb">
                  <div class="swiper-container product-image-thumb slider-vertical">
                    <div ref="thumbnailTrack" class="swiper-wrapper" :style="thumbnailTrackStyle">
                      <div
                        v-for="(image, index) in gallery"
                        :key="image"
                        class="swiper-slide"
                        :class="{ 'swiper-slide-thumb-active': index === galleryIndex }"
                      >
                        <img
                          class="w-100"
                          :src="sourceAsset(image)"
                          alt=""
                          width="600"
                          height="765"
                        />
                        <button
                          type="button"
                          class="fashion-product-thumb-control"
                          :aria-label="`View product image ${index + 1}`"
                          :aria-current="index === galleryIndex ? 'true' : undefined"
                          @click="showGallery(index)"
                        ></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-12 col-lg-5 product-info">
              <h1 class="sr-only">{{ data.product.name }}</h1>
              <span class="fw-500 text-dark-gray d-block">{{ data.product.brand }}</span>
              <h4 class="alt-font text-dark-gray fw-500 mb-5px" role="heading" aria-level="2">
                {{ data.product.name }}
              </h4>
              <div class="d-block d-sm-flex align-items-center mb-15px">
                <div class="me-10px xs-me-0">
                  <a
                    href="#tab"
                    class="section-link ls-minus-1px icon-small"
                    aria-label="5 out of 5 stars"
                  >
                    <i v-for="star in 5" :key="star" class="bi bi-star-fill text-golden-yellow"></i>
                  </a>
                </div>
                <a href="#tab" class="me-25px text-dark-gray fw-500 section-link xs-me-0"
                  >165 Reviews</a
                >
                <div><span class="text-dark-gray fw-500">SKU: </span>{{ data.product.sku }}</div>
              </div>
              <div class="product-price mb-10px">
                <span class="text-dark-gray fs-28 xs-fs-24 fw-700 ls-minus-1px"
                  ><del class="text-medium-gray me-10px fw-400">{{
                    data.product.originalPrice
                  }}</del
                  >{{ data.product.price }}</span
                >
              </div>
              <p>{{ data.product.description }}</p>

              <fieldset class="fashion-product-options border-0 p-0 m-0">
                <legend class="visually-hidden">Product options</legend>
                <div class="d-flex align-items-center mb-20px">
                  <span class="text-dark-gray alt-font me-15px fw-500">Color</span>
                  <ul class="shop-color mb-0">
                    <li v-for="option in data.options.colors" :key="option.id">
                      <input
                        :id="`product-color-${option.id}`"
                        class="fashion-product-option-input"
                        type="radio"
                        name="product-color"
                        :checked="selectedColor === option.id"
                        :disabled="option.disabled"
                        @change="selectOption('color', option.id)"
                      />
                      <label :for="`product-color-${option.id}`"
                        ><span :style="{ backgroundColor: option.color }"></span
                        ><span class="visually-hidden">{{ option.label }}</span></label
                      >
                    </li>
                  </ul>
                </div>
                <div class="d-flex align-items-center mb-35px">
                  <span class="text-dark-gray me-15px fw-500">Size</span>
                  <ul class="shop-size mb-0">
                    <li v-for="option in data.options.sizes" :key="option.id">
                      <input
                        :id="`product-size-${option.id}`"
                        class="fashion-product-option-input"
                        type="radio"
                        name="product-size"
                        :checked="selectedSize === option.id"
                        :disabled="option.disabled"
                        @change="selectOption('size', option.id)"
                      />
                      <label :for="`product-size-${option.id}`"
                        ><span>{{ option.label }}</span></label
                      >
                    </li>
                  </ul>
                </div>
              </fieldset>

              <div
                class="d-flex align-items-center flex-column flex-sm-row mb-20px position-relative"
              >
                <div class="quantity me-15px xs-mb-15px order-1">
                  <button
                    type="button"
                    class="qty-minus"
                    aria-label="Decrease quantity"
                    @click="updateQuantity(quantity - 1)"
                  >
                    -
                  </button>
                  <input
                    class="qty-text"
                    type="text"
                    inputmode="numeric"
                    :value="quantity"
                    role="spinbutton"
                    aria-label="Quantity"
                    aria-valuemin="1"
                    aria-valuemax="20"
                    :aria-valuenow="quantity"
                    @change="updateQuantity(Number(($event.target as HTMLInputElement).value))"
                  />
                  <button
                    type="button"
                    class="qty-plus"
                    aria-label="Increase quantity"
                    @click="updateQuantity(quantity + 1)"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-cart btn-extra-large btn-switch-text btn-box-shadow btn-none-transform btn-dark-gray left-icon btn-round-edge border-0 me-15px xs-me-0 order-3 order-sm-2"
                  :disabled="cartBusy"
                  @click="addToCart"
                >
                  <span>
                    <span><i class="feather icon-feather-shopping-bag"></i></span>
                    <span class="btn-double-text ls-0px" data-text="Add to cart">Add to cart</span>
                  </span>
                </button>
                <button
                  type="button"
                  class="wishlist d-flex align-items-center justify-content-center border border-radius-5px border-color-extra-medium-gray order-2 order-sm-3"
                  aria-label="Add to wishlist"
                  @click="recordAction('wishlist')"
                >
                  <i class="feather icon-feather-heart icon-small text-dark-gray"></i>
                </button>
              </div>

              <div class="row mb-20px fashion-product-secondary-actions">
                <div
                  v-for="(action, index) in ['compare', 'question', 'share'] as const"
                  :key="action"
                  class="col-auto icon-with-text-style-08"
                >
                  <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
                    <div class="feature-box-icon me-10px">
                      <i
                        class="feather align-middle text-dark-gray"
                        :class="
                          ['icon-feather-repeat', 'icon-feather-mail', 'icon-feather-share-2'][
                            index
                          ]
                        "
                      ></i>
                    </div>
                    <div class="feature-box-content">
                      <button
                        type="button"
                        class="alt-font fw-500 text-dark-gray d-block"
                        @click="recordAction(action)"
                      >
                        {{ data.actions[action].label }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mb-20px h-1px w-100 bg-extra-medium-gray d-block"></div>
              <div class="row mb-15px">
                <div class="col-12 icon-with-text-style-08">
                  <div class="feature-box feature-box-left-icon d-inline-flex align-middle">
                    <div class="feature-box-icon me-10px">
                      <i
                        class="feather icon-feather-truck top-8px position-relative align-middle text-dark-gray"
                      ></i>
                    </div>
                    <div class="feature-box-content">
                      <span
                        ><span class="alt-font text-dark-gray fw-500">Estimated delivery:</span>
                        March 03 - March 07</span
                      >
                    </div>
                  </div>
                </div>
                <div class="col-12 icon-with-text-style-08 mb-10px">
                  <div class="feature-box feature-box-left-icon d-inline-flex align-middle">
                    <div class="feature-box-icon me-10px">
                      <i
                        class="feather icon-feather-archive top-8px position-relative align-middle text-dark-gray"
                      ></i>
                    </div>
                    <div class="feature-box-content">
                      <span
                        ><span class="alt-font text-dark-gray fw-500"
                          >Free shipping &amp; returns:</span
                        >
                        On all orders over $50</span
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="bg-very-light-gray ps-30px pe-30px pt-25px pb-25px mb-20px xs-p-25px border-radius-4px"
              >
                <span class="alt-font fs-17 fw-500 text-dark-gray mb-15px d-block lh-initial"
                  >Guarantee safe and secure checkout</span
                >
                <div class="fashion-product-payments">
                  <a
                    v-for="(payment, index) in data.payments"
                    :key="payment"
                    href="#"
                    :aria-label="`Payment method ${index + 1}`"
                    @click.prevent
                    ><img
                      :src="sourceAsset(payment)"
                      class="h-30px"
                      :class="{ 'me-5px mb-5px': payment !== data.payments.at(-1) }"
                      alt=""
                  /></a>
                </div>
              </div>
              <div>
                <div class="w-100 d-block">
                  <span class="text-dark-gray alt-font fw-500">Category:</span>
                  <a href="#" @click.prevent>Fashion,</a>
                  <a href="#" @click.prevent>Woman</a>
                </div>
                <div>
                  <span class="text-dark-gray alt-font fw-500">Tags: </span
                  ><a href="#" @click.prevent>Shirts,</a>
                  <a href="#" @click.prevent>Cotton,</a>
                  <a href="#" @click.prevent>Printed</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tab" class="pt-4 sm-pt-40px fashion-product-tabs">
        <div class="container">
          <div class="row">
            <div class="col-12 tab-style-04">
              <ul
                class="nav nav-tabs border-0 justify-content-center alt-font fs-19"
                role="tablist"
                aria-label="Product information"
              >
                <li v-for="(tab, index) in tabIds" :key="tab" class="nav-item" role="presentation">
                  <a
                    :id="`product-tab-${tab}`"
                    :href="`#product-panel-${tab}`"
                    class="nav-link"
                    :class="{ active: activeTab === tab }"
                    role="tab"
                    :aria-selected="activeTab === tab"
                    :aria-controls="`product-panel-${tab}`"
                    :tabindex="activeTab === tab ? 0 : -1"
                    @click.prevent="activeTab = tab"
                    @keydown="handleTabKey($event, index)"
                    >{{
                      tab === "description"
                        ? "Description"
                        : tab === "information"
                          ? "Additional information"
                          : tab === "shipping"
                            ? "Shipping and return"
                            : "Reviews (3)"
                    }}<span class="tab-border bg-dark-gray"></span
                  ></a>
                </li>
              </ul>
              <div class="mb-5 h-1px w-100 bg-extra-medium-gray sm-mt-10px xs-mb-8"></div>
              <div class="tab-content">
                <div
                  id="product-panel-description"
                  class="tab-pane fade in fashion-product-tab-panel"
                  :class="{
                    active: activeTab === 'description',
                    show: activeTab === 'description',
                  }"
                  role="tabpanel"
                  aria-labelledby="product-tab-description"
                  :hidden="activeTab !== 'description'"
                >
                  <div class="row align-items-center justify-content-center">
                    <div class="col-lg-6 md-mb-40px">
                      <div class="d-flex align-items-center mb-5px">
                        <div class="col-auto pe-5px">
                          <i class="bi bi-heart-fill text-red fs-16"></i>
                        </div>
                        <div class="col alt-font fw-500 text-dark-gray">
                          {{ data.description.eyebrow }}
                        </div>
                      </div>
                      <h4 class="alt-font text-dark-gray fw-500 mb-20px w-90 lg-w-100">
                        {{ data.description.heading }}
                      </h4>
                      <p class="w-90">{{ data.description.text }}</p>
                      <div>
                        <div
                          v-for="(bullet, index) in data.description.bullets"
                          :key="bullet"
                          class="feature-box feature-box-left-icon-middle"
                          :class="{ 'mb-10px': index < data.description.bullets.length - 1 }"
                        >
                          <div
                            class="feature-box-icon feature-box-icon-rounded w-30px h-30px rounded-circle bg-very-light-gray me-10px"
                          >
                            <i class="fa-solid fa-check fs-12 text-dark-gray"></i>
                          </div>
                          <div class="feature-box-content">
                            <span class="d-block text-dark-gray fw-500">{{ bullet }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="col-lg-6 col-md-8">
                      <img :src="sourceAsset(data.description.sourceImage)" alt="" class="w-100" />
                    </div>
                  </div>
                </div>
                <div
                  id="product-panel-information"
                  class="tab-pane fade in fashion-product-tab-panel"
                  :class="{
                    active: activeTab === 'information',
                    show: activeTab === 'information',
                  }"
                  role="tabpanel"
                  aria-labelledby="product-tab-information"
                  :hidden="activeTab !== 'information'"
                >
                  <div
                    v-for="(specification, index) in data.specifications"
                    :key="specification.label"
                    class="row"
                    :class="{ 'bg-very-light-gray': index % 2 === 1 }"
                  >
                    <div
                      class="col-lg-2 col-md-3 col-sm-4 pt-10px pb-10px text-dark-gray alt-font fw-500"
                    >
                      {{ specification.label }}
                    </div>
                    <div class="col-lg-10 col-md-9 col-sm-8 pt-10px pb-10px">
                      {{ specification.value }}
                    </div>
                  </div>
                </div>
                <div
                  id="product-panel-shipping"
                  class="tab-pane fade in fashion-product-tab-panel"
                  :class="{ active: activeTab === 'shipping', show: activeTab === 'shipping' }"
                  role="tabpanel"
                  aria-labelledby="product-tab-shipping"
                  :hidden="activeTab !== 'shipping'"
                >
                  <div class="row">
                    <div class="col-12 col-md-6">
                      <h2 class="alt-font fs-22">Shipping information</h2>
                      <p><strong>Standard:</strong> {{ data.shipping.standard }}</p>
                      <p><strong>Express:</strong> {{ data.shipping.express }}</p>
                    </div>
                    <div class="col-12 col-md-6">
                      <h2 class="alt-font fs-22">Return information</h2>
                      <p>{{ data.shipping.returnBody }}</p>
                    </div>
                  </div>
                </div>
                <div
                  id="product-panel-reviews"
                  class="tab-pane fade in fashion-product-tab-panel"
                  :class="{ active: activeTab === 'reviews', show: activeTab === 'reviews' }"
                  role="tabpanel"
                  aria-labelledby="product-tab-reviews"
                  :hidden="activeTab !== 'reviews'"
                >
                  <div class="row align-items-center mb-6 sm-mb-10">
                    <div class="col-lg-4 col-md-12 col-sm-7 md-mb-30px text-center text-lg-start">
                      <h5 class="alt-font text-dark-gray fw-500 mb-0 w-85 lg-w-100">
                        <span class="fw-600">25,000+</span> people are like our product and say good
                        story.
                      </h5>
                    </div>
                    <div
                      class="col-lg-2 col-md-4 col-sm-5 text-center sm-mb-20px p-0 md-ps-15px md-pe-15px"
                    >
                      <div class="border-radius-4px bg-very-light-gray p-30px xl-p-20px">
                        <h2 class="mb-5px alt-font text-dark-gray fw-600">4.9</h2>
                        <span
                          class="text-golden-yellow icon-small d-block ls-minus-1px mb-5px fashion-product-rating-stars"
                        >
                          <template v-for="index in 5" :key="index">
                            <i class="bi bi-star-fill"></i>{{ index < 5 ? " " : "" }}
                          </template>
                        </span>
                        <span
                          class="ps-15px pe-15px pt-10px pb-10px lh-normal bg-dark-gray text-white fs-12 fw-600 text-uppercase border-radius-4px d-inline-block text-center"
                          >2,488 Reviews</span
                        >
                      </div>
                    </div>
                    <div class="col-9 col-lg-4 col-md-5 col-sm-8 progress-bar-style-02">
                      <div class="ps-20px md-ps-0">
                        <div class="text-dark-gray mb-15px fw-600">Average customer ratings</div>
                        <div
                          v-for="(rating, index) in [95, 66, 40, 25, 5]"
                          :key="rating"
                          class="progress border-radius-6px"
                          :class="index === 4 ? 'sm-mb-0' : 'mb-20px'"
                        >
                          <div
                            class="progress-bar bg-green m-0"
                            role="progressbar"
                            :style="{ width: `${rating}%` }"
                            :aria-valuenow="rating"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-label="rating"
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div class="col-3 col-lg-2 col-md-3 col-sm-4 mt-45px">
                      <div
                        v-for="(rating, index) in [5, 4, 3, 2, 1]"
                        :key="rating"
                        :class="
                          index === 4 ? 'lh-0 xs-lh-normal' : 'mb-15px lh-0 xs-lh-normal xs-mb-10px'
                        "
                      >
                        <span
                          class="text-golden-yellow fs-15 ls-minus-1px d-none d-sm-inline-block fashion-product-rating-stars"
                        >
                          <template v-for="star in 5" :key="star">
                            <i
                              :class="
                                star <= rating ? 'bi bi-star-fill' : 'feather icon-feather-star'
                              "
                            ></i
                            >{{ star < 5 ? " " : "" }}
                          </template>
                        </span>
                        <span class="fs-13 text-dark-gray fw-600 ms-10px xs-ms-0">{{
                          ["80%", "10%", "05%", "03%", "02%"][index]
                        }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="row g-0 mb-4 md-mb-35px fashion-product-reviews">
                    <div
                      v-for="(review, reviewIndex) in data.reviews"
                      :key="review.author"
                      :class="[
                        'col-12 border-bottom border-color-extra-medium-gray pb-40px mb-40px xs-pb-30px',
                        reviewIndex === data.reviews.length - 1 ? 'md-mb-25px' : 'xs-mb-30px',
                      ]"
                    >
                      <div class="d-block d-md-flex w-100 align-items-center">
                        <div class="w-300px md-w-250px sm-w-100 sm-mb-10px text-center">
                          <img
                            :src="sourceAsset(review.sourceImage)"
                            class="rounded-circle w-90px mb-10px"
                            alt=""
                          /><span class="text-dark-gray fw-600 d-block">{{ review.author }}</span>
                          <div class="fs-14 lh-18">{{ review.date }}</div>
                        </div>
                        <div
                          class="w-100 last-paragraph-no-margin sm-ps-0 position-relative text-center text-md-start"
                        >
                          <span
                            class="text-golden-yellow ls-minus-1px mb-5px sm-me-10px sm-mb-0 d-inline-block d-md-block fashion-product-rating-stars"
                          >
                            <template v-for="index in 5" :key="index">
                              <i class="bi bi-star-fill"></i>{{ index < 5 ? " " : "" }}
                            </template>
                          </span>
                          <a
                            href="#"
                            class="w-65px bg-light-red border-radius-15px fs-13 text-dark-gray fw-600 text-center position-absolute sm-position-relative d-inline-block d-md-block right-0px top-0px"
                            @click.prevent
                            ><i
                              :class="
                                review.author === 'Colene landin'
                                  ? 'fa-regular fa-heart'
                                  : 'fa-solid fa-heart'
                              "
                              class="text-red me-5px"
                            ></i
                            ><span>{{ ["08", "06", "00"][reviewIndex] }}</span></a
                          >
                          <p class="w-85 sm-w-100 sm-mt-15px">{{ review.text }}</p>
                        </div>
                      </div>
                    </div>
                    <div class="col-12 last-paragraph-no-margin text-center">
                      <a
                        href="#"
                        class="btn btn-link btn-hover-animation-switch btn-extra-large text-dark-gray"
                        @click.prevent
                      >
                        <span>
                          <span class="btn-text">Show more reviews</span>
                          <span class="btn-icon"><i class="fa-solid fa-chevron-down"></i></span>
                          <span class="btn-icon"><i class="fa-solid fa-chevron-down"></i></span>
                        </span>
                      </a>
                    </div>
                  </div>
                  <div class="row justify-content-center">
                    <div class="col-12">
                      <div class="p-7 lg-p-5 sm-p-7 bg-very-light-gray">
                        <div class="row justify-content-center mb-30px sm-mb-10px">
                          <div class="col-md-9 text-center">
                            <h4 class="alt-font text-dark-gray fw-500 mb-15px">Add a review</h4>
                          </div>
                        </div>
                        <form class="row contact-form-style-02" @submit.prevent="submitReview">
                          <div class="col-lg-5 col-md-6 mb-20px">
                            <label for="review-name" class="form-label mb-15px">Your name*</label>
                            <input
                              id="review-name"
                              class="input-name border-radius-4px form-control required"
                              type="text"
                              required
                              placeholder="Enter your name"
                            />
                          </div>
                          <div class="col-lg-5 col-md-6 mb-20px">
                            <label for="review-email" class="form-label mb-15px"
                              >Your email address*</label
                            >
                            <input
                              id="review-email"
                              class="border-radius-4px form-control required"
                              type="email"
                              required
                              placeholder="Enter your email address"
                            />
                          </div>
                          <div class="col-lg-2 mb-20px">
                            <label class="form-label">Your rating*</label>
                            <div>
                              <span class="ls-minus-1px icon-small d-block mt-20px md-mt-0">
                                <template v-for="index in 5" :key="index">
                                  <i class="feather icon-feather-star text-golden-yellow"></i
                                  >{{ index < 5 ? " " : "" }}
                                </template>
                              </span>
                            </div>
                          </div>
                          <div class="col-md-12 mb-20px">
                            <label for="review-message" class="form-label mb-15px"
                              >Your review</label
                            >
                            <textarea
                              id="review-message"
                              class="border-radius-4px form-control"
                              cols="40"
                              rows="4"
                              placeholder="Your message"
                            ></textarea>
                          </div>
                          <div class="col-lg-9 md-mb-25px">
                            <div
                              class="position-relative terms-condition-box text-start is-invalid mt-10px"
                            >
                              <label class="d-inline-block">
                                <input
                                  id="review-terms"
                                  type="checkbox"
                                  required
                                  class="terms-condition check-box align-middle required"
                                />
                                <span class="box fs-15"
                                  >I accept the crafto terms and conditions and I have read the
                                  privacy policy.</span
                                >
                              </label>
                            </div>
                          </div>
                          <div class="col-lg-3 text-start text-lg-end">
                            <input type="hidden" name="redirect" value="" />
                            <button
                              class="btn btn-dark-gray btn-small btn-box-shadow btn-round-edge submit"
                              type="submit"
                            >
                              Submit review
                            </button>
                          </div>
                          <div class="col-12"><div class="form-results mt-20px d-none"></div></div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-product-related">
        <div class="container">
          <div class="row mb-5">
            <div class="col-12 text-center">
              <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
                Related
                <span class="text-highlight fw-600"
                  >products<span class="bg-base-color h-5px bottom-2px"></span
                ></span>
              </h2>
            </div>
          </div>
          <ul
            class="shop-modern shop-wrapper grid grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
          >
            <li class="grid-sizer" aria-hidden="true"></li>
            <FashionStoreProductCard
              v-for="product in data.related"
              :key="product.id"
              :product="product"
              :resolve-asset="resolveAsset"
              @intent="recordRelatedIntent"
            />
          </ul>
        </div>
      </section>

      <FashionStoreProductLightbox
        ref="lightbox"
        :src="sourceAsset(gallery[galleryIndex]!)"
        :alt="data.product.name"
        :current="galleryIndex + 1"
        :total="gallery.length"
        @previous="showGallery(galleryIndex - 1)"
        @next="showGallery(galleryIndex + 1)"
        @opened="galleryPaused = true"
        @closed="galleryPaused = false"
      />
    </main>
  </FashionStoreShell>
</template>
