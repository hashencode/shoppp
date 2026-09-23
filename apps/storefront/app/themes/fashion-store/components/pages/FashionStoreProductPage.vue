<script setup lang="ts">
import { submitProductReviewSchema } from "@shoppp/contracts";

import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { ProductPageModel } from "../../../../theme-engine/view-models";
import {
  normalizeFashionStoreProductPresentation,
  type FashionStoreProductPresentation,
  type FashionStoreProductRuntimeState,
} from "../../contracts/product-card";
import { useFashionStoreProductActionPort } from "../../composables/useFashionStoreProductActionPort";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreProductGallery from "../shared/FashionStoreProductGallery.vue";
import FashionStoreProductLightbox from "../shared/FashionStoreProductLightbox.vue";
import FashionStoreQuantityInput from "../shared/FashionStoreQuantityInput.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  instance?: unknown;
  resolveAsset: ThemeAssetResolver;
  viewModel: ProductPageModel;
}>();
const presentation = computed(() => normalizeFashionStoreProductPresentation(properties.viewModel));
const actionPort = useFashionStoreProductActionPort(presentation);
const commerceApi = useCommerceApi();
const runtimeProduct = ref<FashionStoreProductRuntimeState | null>(null);
const runtimeState = ref<{ kind: "checking" | "error" | "ready"; message: string }>({
  kind: actionPort.authoritative ? "checking" : "ready",
  message: actionPort.authoritative
    ? "Checking current price and availability…"
    : "Preview product details are available.",
});
const hydrated = ref(false);
const initialVariant = presentation.value.variants.find(({ selected }) => selected);
const selectedOptions = ref<Record<string, string>>({ ...(initialVariant?.optionValues ?? {}) });
const quantity = ref(1);
const optionError = ref("");
const optionErrorElement = ref<HTMLElement | null>(null);
const galleryIndex = ref(0);
const galleryPaused = ref(false);
const failedDescriptionMediaSource = ref("");
const activeTab = ref<"description" | "information" | "shipping" | "reviews">("description");
const tabIds = ["description", "information", "shipping", "reviews"] as const;
const cartAddCount = ref(0);
const optionUpdateCount = ref(0);
const previewIntentCount = ref(0);
const visibleReviewCount = ref(3);
const reviewRating = ref(0);
const hoveredReviewRating = ref(0);
const reviewName = ref("");
const reviewEmail = ref("");
const reviewBody = ref("");
const reviewConsentAccepted = ref(false);
const reviewErrors = ref<{
  rating?: string;
  name?: string;
  email?: string;
  body?: string;
  consent?: string;
}>({});
const reviewFormState = ref<{ kind: "idle" | "saving" | "success" | "error"; message: string }>({
  kind: "idle",
  message: "",
});
let reviewSubmissionKey: string | null = null;
const productGallery = ref<InstanceType<typeof FashionStoreProductGallery>>();
const lightbox = ref<InstanceType<typeof FashionStoreProductLightbox>>();
let revalidationVersion = 0;

// Labels and ordering are immutable release presentation. Commerce revalidation may only
// refresh mutable variant availability, pricing, inventory-derived outcomes, and media.
const displayedOptionGroups = computed(() => presentation.value.optionGroups);
const displayedVariants = computed(
  () => runtimeProduct.value?.variants ?? presentation.value.variants,
);
const displayedGallery = computed(
  () =>
    presentation.value.colorGalleries?.[selectedOptions.value.color ?? ""] ??
    presentation.value.gallery,
);
const galleryImages = computed(() =>
  displayedGallery.value.map((item) => (item.kind === "theme-asset" ? item.path : item)),
);
const selectedVariant = computed(() =>
  displayedVariants.value.find((variant) =>
    displayedOptionGroups.value.every(
      ({ name }) => variant.optionValues[name] === selectedOptions.value[name],
    ),
  ),
);
const displayedPrice = computed(
  () => selectedVariant.value?.priceLabel ?? presentation.value.priceLabel,
);
const displayedCompareAtPrice = computed(() =>
  runtimeProduct.value
    ? selectedVariant.value?.compareAtPriceLabel
    : (selectedVariant.value?.compareAtPriceLabel ?? presentation.value.compareAtPriceLabel),
);
const addDisabled = computed(
  () =>
    presentation.value.purchaseStatus === "unverified" ||
    (actionPort.authoritative && !hydrated.value) ||
    runtimeState.value.kind === "checking" ||
    runtimeProduct.value?.availability === "out-of-stock" ||
    runtimeProduct.value?.availability === "unavailable",
);
const descriptionMedia = computed(
  () =>
    presentation.value.colorGalleries?.[selectedOptions.value.color ?? ""]?.at(-1) ??
    presentation.value.descriptionDetail.media,
);
const descriptionMediaSource = computed(() => mediaSource(descriptionMedia.value));
const descriptionMediaAlt = computed(() => descriptionMedia.value?.alt ?? presentation.value.name);
const visibleReviews = computed(() =>
  presentation.value.reviews.slice(0, visibleReviewCount.value),
);
const reviewBands = computed(() =>
  [5, 4, 3, 2, 1].map((rating) => {
    const count = presentation.value.reviewSummary.ratingBands?.[rating - 1] ?? 0;
    return {
      count,
      percentage: presentation.value.reviewSummary.count
        ? Math.round((count / presentation.value.reviewSummary.count) * 100)
        : 0,
      rating,
    };
  }),
);

function reviewInputChanged(): void {
  if (reviewSubmissionKey !== null) reviewSubmissionKey = null;
  if (Object.keys(reviewErrors.value).length) reviewErrors.value = {};
  if (reviewFormState.value.kind === "error") reviewFormState.value = { kind: "idle", message: "" };
}

async function submitReview(): Promise<void> {
  if (reviewFormState.value.kind === "saving" || reviewFormState.value.kind === "success") return;
  const errors: typeof reviewErrors.value = {};
  const name = reviewName.value.trim();
  const email = reviewEmail.value.trim();
  const body = reviewBody.value.trim();
  if (!submitProductReviewSchema.shape.rating.safeParse(reviewRating.value).success)
    errors.rating = "Choose a rating from 1 to 5 stars.";
  if (!submitProductReviewSchema.shape.displayName.safeParse(name).success)
    errors.name = "Enter a name of 2 to 80 characters.";
  if (!submitProductReviewSchema.shape.email.safeParse(email).success)
    errors.email = "Enter a valid email address.";
  if (!submitProductReviewSchema.shape.body.safeParse(body).success)
    errors.body = "Write a review of 10 to 2,000 characters.";
  if (
    !submitProductReviewSchema.shape.consentAccepted.safeParse(reviewConsentAccepted.value).success
  )
    errors.consent = "Accept the terms and privacy policy before submitting.";
  reviewErrors.value = errors;
  if (Object.keys(errors).length) return;
  reviewFormState.value = { kind: "saving", message: "Saving your review…" };
  reviewSubmissionKey ??= `review-${crypto.randomUUID()}`;
  try {
    await commerceApi.submitProductReview(
      presentation.value.slug,
      {
        body,
        consentAccepted: true,
        displayName: name,
        email,
        rating: reviewRating.value,
      },
      reviewSubmissionKey,
    );
    reviewFormState.value = {
      kind: "success",
      message: "Your review was saved and is awaiting moderation. It is not public yet.",
    };
  } catch (error) {
    const response = error as { data?: { error?: { message?: string } } };
    reviewFormState.value = {
      kind: "error",
      message: response.data?.error?.message ?? "Your review could not be saved. Try again.",
    };
  }
}

function gallerySource(index: number): string {
  const item = displayedGallery.value[index];
  if (!item) return "";
  return item.kind === "theme-asset"
    ? properties.resolveAsset(fashionStoreAssetId(item.path))
    : item.src;
}

function mediaSource(item: FashionStoreProductPresentation["gallery"][number] | undefined): string {
  if (!item) return "";
  return item.kind === "theme-asset"
    ? properties.resolveAsset(fashionStoreAssetId(item.path))
    : item.src;
}

function optionDefinition(groupName: string) {
  return presentation.value.optionDefinitions.find(({ name }) => name === groupName);
}

function optionValueDefinition(groupName: string, label: string) {
  return optionDefinition(groupName)?.values.find((value) => value.label === label);
}

function optionInputId(groupIndex: number, valueIndex: number): string {
  return `product-option-${groupIndex}-${valueIndex}`;
}

function optionDisplayName(name: string): string {
  return name ? `${name[0]!.toLocaleUpperCase()}${name.slice(1)}` : name;
}

function publishedRouteHref(path: string): string | undefined {
  return presentation.value.publishedRoutes.includes(path) ? path : undefined;
}

function optionValueAvailable(groupName: string, value: string): boolean {
  if (!actionPort.authoritative || !runtimeProduct.value) return true;
  const groupIndex = displayedOptionGroups.value.findIndex(({ name }) => name === groupName);
  return displayedVariants.value.some(
    (variant) =>
      variant.availability === "in-stock" &&
      variant.optionValues[groupName] === value &&
      displayedOptionGroups.value.every(({ name }, index) => {
        const selected = selectedOptions.value[name];
        return index >= groupIndex || !selected || variant.optionValues[name] === selected;
      }),
  );
}

function selectOption(groupName: string, value: string): void {
  if (selectedOptions.value[groupName] === value) return;
  const groupIndex = displayedOptionGroups.value.findIndex(({ name }) => name === groupName);
  selectedOptions.value = Object.fromEntries([
    ...displayedOptionGroups.value
      .slice(0, groupIndex)
      .flatMap(({ name }) =>
        selectedOptions.value[name] ? [[name, selectedOptions.value[name]!] as const] : [],
      ),
    [groupName, value],
  ]);
  if (groupName === "color") galleryIndex.value = 0;
  optionError.value = "";
  optionUpdateCount.value += 1;
}

function updateQuantity(value: number): void {
  if (quantity.value === value) return;
  quantity.value = value;
  optionUpdateCount.value += 1;
}

async function showOptionError(message: string): Promise<void> {
  optionError.value = message;
  await nextTick();
  optionErrorElement.value?.focus();
}

async function revalidate(): Promise<boolean> {
  const version = ++revalidationVersion;
  const productIdentity = `${presentation.value.productId}:${presentation.value.slug}`;
  runtimeState.value = { kind: "checking", message: "Checking current price and availability…" };
  try {
    const nextRuntimeProduct = await actionPort.revalidate();
    if (
      version !== revalidationVersion ||
      productIdentity !== `${presentation.value.productId}:${presentation.value.slug}`
    ) {
      return false;
    }
    runtimeProduct.value = nextRuntimeProduct;
    runtimeState.value = {
      kind: "ready",
      message:
        runtimeProduct.value?.availability === "in-stock"
          ? "Current price and availability verified."
          : "This product is currently unavailable.",
    };
    return Boolean(runtimeProduct.value);
  } catch {
    if (version !== revalidationVersion) return false;
    runtimeState.value = {
      kind: "error",
      message:
        "Current price and availability could not be verified. Static product details remain available; try again.",
    };
    return false;
  }
}

function resetProductState(): void {
  revalidationVersion += 1;
  runtimeProduct.value = null;
  runtimeState.value = {
    kind: actionPort.authoritative ? "checking" : "ready",
    message: actionPort.authoritative
      ? "Checking current price and availability…"
      : "Preview product details are available.",
  };
  const nextInitialVariant = presentation.value.variants.find(({ selected }) => selected);
  selectedOptions.value = { ...(nextInitialVariant?.optionValues ?? {}) };
  quantity.value = 1;
  optionError.value = "";
  galleryIndex.value = 0;
  galleryPaused.value = false;
  failedDescriptionMediaSource.value = "";
  activeTab.value = "description";
  cartAddCount.value = 0;
  optionUpdateCount.value = 0;
  previewIntentCount.value = 0;
  visibleReviewCount.value = 3;
  reviewRating.value = 0;
  hoveredReviewRating.value = 0;
  reviewName.value = "";
  reviewEmail.value = "";
  reviewBody.value = "";
  reviewConsentAccepted.value = false;
  reviewErrors.value = {};
  reviewFormState.value = { kind: "idle", message: "" };
  reviewSubmissionKey = null;
  void nextTick(() => productGallery.value?.select(0));
  if (hydrated.value && actionPort.authoritative) void revalidate();
}

async function addToCart(): Promise<void> {
  if (presentation.value.purchaseStatus === "unverified") return;
  if (runtimeState.value.kind === "error" && !(await revalidate())) return;
  const missing = displayedOptionGroups.value
    .map(({ name }) => name)
    .filter((name) => !selectedOptions.value[name]);
  if (missing.length) {
    await showOptionError(`Choose ${missing.join(" and ")} before adding this item.`);
    return;
  }
  const variant = selectedVariant.value;
  if (!variant || variant.availability === "out-of-stock") {
    await showOptionError("That option combination is unavailable. Choose another combination.");
    return;
  }
  optionError.value = "";
  runtimeState.value = { kind: "checking", message: "Adding the verified item to your cart…" };
  const outcome = await actionPort.addToCart({
    currency: presentation.value.currency,
    media: displayedGallery.value[0],
    optionValues: selectedOptions.value,
    priceLabel: displayedPrice.value,
    productId: presentation.value.productId,
    productName: presentation.value.name,
    quantity: quantity.value,
    slug: presentation.value.slug,
    variantId: variant.id,
  });
  if (outcome.kind === "succeeded") {
    if (actionPort.authoritative) cartAddCount.value += 1;
    else previewIntentCount.value += 1;
    runtimeState.value = { kind: "ready", message: outcome.message };
  } else {
    runtimeState.value = {
      kind: outcome.kind === "failed" ? "error" : "ready",
      message: outcome.message,
    };
  }
}

function perform(role: "compare" | "question" | "share" | "wishlist", label: string): void {
  actionPort.perform({ label, role });
  if (!actionPort.authoritative) previewIntentCount.value += 1;
}

function showGallery(index: number): void {
  if (!displayedGallery.value.length) return;
  galleryIndex.value =
    ((index % displayedGallery.value.length) + displayedGallery.value.length) %
    displayedGallery.value.length;
  productGallery.value?.select(galleryIndex.value);
}

function handleTabKey(event: KeyboardEvent, index: number): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  activeTab.value =
    tabIds[(index + (event.key === "ArrowRight" ? 1 : -1) + tabIds.length) % tabIds.length]!;
  void nextTick(() =>
    document.querySelector<HTMLButtonElement>(`#product-tab-${activeTab.value}`)?.focus(),
  );
}

onMounted(() => {
  hydrated.value = true;
  if (actionPort.authoritative) void revalidate();
});

watch(
  () => `${presentation.value.productId}:${presentation.value.slug}`,
  (identity, previousIdentity) => {
    if (previousIdentity !== undefined && identity !== previousIdentity) resetProductState();
  },
);
</script>

<template>
  <FashionStoreShell
    :brand-name="presentation.siteName"
    :preload-image="gallerySource(0)"
    :published-routes="presentation.publishedRoutes"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-product
      :data-cart-add-count="cartAddCount"
      :data-option-update-count="optionUpdateCount"
      :data-preview-intent-count="previewIntentCount"
      :data-runtime-status="runtimeState.kind"
    >
      <section
        class="top-space-margin bg-gradient-very-light-gray pt-20px pb-20px ps-45px pe-45px sm-ps-15px sm-pe-15px"
      >
        <div class="container-fluid">
          <div class="row align-items-center">
            <nav class="col-12 breadcrumb breadcrumb-style-01 fs-14" aria-label="Breadcrumb">
              <ul>
                <li>
                  <a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a>
                  <FashionStoreIcon name="chevron-right" class="fashion-breadcrumb-separator" />
                </li>
                <li>
                  <a
                    :href="publishedRouteHref(fashionStoreRoutePaths['shop-left'])"
                    :aria-disabled="!publishedRouteHref(fashionStoreRoutePaths['shop-left'])"
                    data-fashion-store-route
                    >Shop</a
                  >
                  <FashionStoreIcon name="chevron-right" class="fashion-breadcrumb-separator" />
                </li>
                <li>{{ presentation.name }}</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-60px pb-0 md-pt-30px fashion-product-detail">
        <div class="container">
          <div class="row">
            <div class="col-lg-7 pe-50px md-pe-15px md-mb-40px fashion-product-gallery">
              <FashionStoreProductGallery
                v-if="galleryImages.length"
                :key="selectedOptions.color"
                ref="productGallery"
                :images="galleryImages"
                :paused="galleryPaused"
                :resolve-asset="resolveAsset"
                @active-index-change="galleryIndex = $event"
                @open="
                  galleryPaused = true;
                  lightbox?.open();
                "
              />
              <div
                v-else
                class="fashion-store-product-placeholder"
                role="img"
                :aria-label="presentation.name"
              />
            </div>

            <div class="col-12 col-lg-5 product-info">
              <div
                v-if="
                  actionPort.authoritative &&
                  !hydrated &&
                  presentation.purchaseStatus !== 'unverified'
                "
                class="mb-25px"
                role="region"
                aria-label="JavaScript limitations"
              >
                <p>Shopping actions require JavaScript.</p>
                <a href="/">Return to the storefront</a>
              </div>
              <h1 class="visually-hidden">{{ presentation.name }}</h1>
              <span v-if="presentation.brand" class="fw-500 text-dark-gray d-block">{{
                presentation.brand
              }}</span>
              <h4 class="alt-font text-dark-gray fw-500 mb-5px" role="heading" aria-level="2">
                {{ presentation.name }}
              </h4>
              <div class="d-block d-sm-flex align-items-center mb-15px fashion-product-rating-line">
                <div class="me-10px xs-me-0 fashion-product-rating-star-group">
                  <span
                    class="ls-minus-1px icon-small"
                    role="img"
                    :aria-label="`${presentation.reviewSummary.averageRating} out of 5 stars`"
                  >
                    <FashionStoreIcon
                      v-for="star in 5"
                      :key="star"
                      name="star"
                      :filled="star <= Math.round(presentation.reviewSummary.averageRating)"
                      class="text-golden-yellow"
                    />
                  </span>
                </div>
                <button
                  type="button"
                  class="me-25px text-dark-gray fw-500 section-link xs-me-0 fashion-product-rating-count"
                  @click="activeTab = 'reviews'"
                >
                  {{ presentation.reviewSummary.label }}
                </button>
                <div
                  v-if="presentation.purchaseStatus !== 'unverified' && selectedVariant?.sku"
                  class="fashion-product-rating-sku"
                >
                  <span class="text-dark-gray fw-500">SKU: </span>{{ selectedVariant.sku }}
                </div>
              </div>
              <div
                v-if="presentation.purchaseStatus !== 'unverified'"
                class="product-price mb-10px"
                data-live-product-price
              >
                <span class="text-dark-gray fs-28 xs-fs-24 fw-700 ls-minus-1px">
                  <del
                    v-if="displayedCompareAtPrice"
                    class="fashion-store-compare-at-price me-10px fw-400"
                    >{{ displayedCompareAtPrice }}</del
                  >{{ displayedPrice }}
                </span>
              </div>
              <p>{{ presentation.description }}</p>

              <div
                v-if="presentation.purchaseStatus !== 'unverified'"
                class="fashion-product-options mt-20px"
              >
                <fieldset
                  v-for="(group, groupIndex) in displayedOptionGroups"
                  :key="group.name"
                  class="border-0 p-0 m-0"
                >
                  <legend class="visually-hidden">{{ optionDisplayName(group.name) }}</legend>
                  <div
                    class="d-flex align-items-center"
                    :class="groupIndex === displayedOptionGroups.length - 1 ? 'mb-35px' : 'mb-20px'"
                  >
                    <span class="text-dark-gray alt-font me-15px fw-500">{{
                      optionDisplayName(group.name)
                    }}</span>
                    <ul
                      :class="
                        optionDefinition(group.name)?.presentation === 'color' &&
                        optionDefinition(group.name)?.values.every(({ swatch }) => Boolean(swatch))
                          ? 'shop-color fashion-product-color-swatches'
                          : 'shop-size'
                      "
                      class="mb-0"
                    >
                      <li v-for="(value, valueIndex) in group.values" :key="value">
                        <input
                          :id="optionInputId(groupIndex, valueIndex)"
                          class="fashion-product-option-input"
                          type="radio"
                          :name="`product-${group.name}`"
                          :value="value"
                          :checked="selectedOptions[group.name] === value"
                          :disabled="
                            (actionPort.authoritative &&
                              (!hydrated || runtimeState.kind !== 'ready')) ||
                            !optionValueAvailable(group.name, value)
                          "
                          aria-describedby="product-option-error"
                          @change="selectOption(group.name, value)"
                        />
                        <label :for="optionInputId(groupIndex, valueIndex)">
                          <span
                            v-if="
                              optionDefinition(group.name)?.presentation === 'color' &&
                              Boolean(optionValueDefinition(group.name, value)?.swatch)
                            "
                            data-product-option-swatch
                            :data-product-option-label="value"
                            :style="{
                              backgroundColor: optionValueDefinition(group.name, value)?.swatch,
                            }"
                          ></span>
                          <span
                            v-if="
                              optionDefinition(group.name)?.presentation === 'color' &&
                              Boolean(optionValueDefinition(group.name, value)?.swatch)
                            "
                            class="visually-hidden"
                            >{{ value }}</span
                          >
                          <span v-else>{{ value }}</span>
                        </label>
                      </li>
                    </ul>
                  </div>
                </fieldset>
              </div>

              <p
                v-if="optionError"
                id="product-option-error"
                ref="optionErrorElement"
                class="mt-15px"
                data-product-option-error
                role="alert"
                tabindex="-1"
              >
                {{ optionError }}
              </p>
              <div
                v-if="presentation.purchaseStatus !== 'unverified'"
                class="d-flex align-items-center flex-column flex-sm-row mb-20px position-relative"
                data-product-purchase-region
              >
                <FashionStoreQuantityInput
                  class="me-15px xs-mb-15px order-1"
                  variant="product"
                  :model-value="quantity"
                  :min="1"
                  :max="20"
                  label="Quantity"
                  decrement-label="Decrease quantity"
                  increment-label="Increase quantity"
                  @commit="updateQuantity"
                />
                <button
                  type="button"
                  class="btn btn-cart btn-extra-large btn-switch-text btn-box-shadow btn-none-transform btn-dark-gray left-icon btn-round-edge border-0 me-15px xs-me-0 order-3 order-sm-2"
                  :disabled="addDisabled"
                  @click="addToCart"
                >
                  <span>
                    <FashionStoreIcon name="shopping-bag" />
                    <span class="btn-double-text ls-0px">Add to cart</span>
                  </span>
                </button>
                <button
                  v-if="presentation.controls.find(({ role }) => role === 'wishlist')"
                  type="button"
                  class="wishlist d-flex align-items-center justify-content-center border border-radius-5px border-color-extra-medium-gray order-2 order-sm-3"
                  :aria-label="presentation.controls.find(({ role }) => role === 'wishlist')!.label"
                  :disabled="
                    !presentation.controls.find(({ role }) => role === 'wishlist')!.enabled ||
                    actionPort.authoritative
                  "
                  @click="
                    perform(
                      'wishlist',
                      presentation.controls.find(({ role }) => role === 'wishlist')!.label,
                    )
                  "
                >
                  <FashionStoreIcon name="heart" />
                </button>
              </div>
              <p
                v-if="actionPort.authoritative && presentation.purchaseStatus !== 'unverified'"
                class="mt-15px"
                :role="runtimeState.kind === 'error' ? 'alert' : 'status'"
                aria-live="polite"
                data-live-product-status
              >
                {{ runtimeState.message }}
              </p>
              <div class="row mb-20px fashion-product-secondary-actions">
                <div
                  v-for="control in presentation.controls.filter(({ role }) =>
                    ['question', 'share'].includes(role),
                  )"
                  :key="control.role"
                  class="col-auto icon-with-text-style-08"
                >
                  <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
                    <div class="feature-box-icon me-10px">
                      <FashionStoreIcon
                        :name="control.role === 'question' ? 'mail' : 'share-2'"
                        class="align-middle text-dark-gray"
                      />
                    </div>
                    <div class="feature-box-content">
                      <button
                        type="button"
                        class="alt-font fw-500 text-dark-gray d-block"
                        :disabled="!control.enabled || actionPort.authoritative"
                        @click="
                          perform(control.role as 'compare' | 'question' | 'share', control.label)
                        "
                      >
                        {{ control.label }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div data-product-assurance data-product-region-state="assurance">
                <div class="mb-20px h-1px w-100 bg-extra-medium-gray d-block"></div>
                <div class="row mb-15px">
                  <div class="col-12 icon-with-text-style-08">
                    <div class="feature-box feature-box-left-icon d-inline-flex align-middle">
                      <div class="feature-box-icon me-10px">
                        <FashionStoreIcon
                          name="truck"
                          class="top-8px position-relative align-middle text-dark-gray"
                        />
                      </div>
                      <div class="feature-box-content">
                        <span
                          ><span class="alt-font text-dark-gray fw-500">Delivery timing:</span>
                          {{ presentation.assurance?.deliverySummary ?? "Not available" }}</span
                        >
                      </div>
                    </div>
                  </div>
                  <div class="col-12 icon-with-text-style-08 mb-10px">
                    <div class="feature-box feature-box-left-icon d-inline-flex align-middle">
                      <div class="feature-box-icon me-10px">
                        <FashionStoreIcon
                          name="archive"
                          class="top-8px position-relative align-middle text-dark-gray"
                        />
                      </div>
                      <div class="feature-box-content">
                        <span
                          ><span class="alt-font text-dark-gray fw-500"
                            >Shipping &amp; returns:</span
                          >
                          {{
                            presentation.assurance?.shippingReturnsSummary ?? "Not available"
                          }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="presentation.purchaseStatus !== 'unverified'"
                  class="bg-very-light-gray ps-30px pe-30px pt-25px pb-25px mb-20px xs-p-25px border-radius-4px"
                >
                  <span class="alt-font fs-17 fw-500 text-dark-gray mb-15px d-block lh-initial"
                    >Payment methods</span
                  >
                  <div class="fashion-product-payments">
                    <span
                      v-for="(payment, index) in presentation.assurance?.payments ?? []"
                      :key="mediaSource(payment)"
                      role="img"
                      :aria-label="payment.alt ?? `Payment method ${index + 1}`"
                    >
                      <img :src="mediaSource(payment)" class="h-30px mb-5px me-5px" alt="" />
                    </span>
                    <span v-if="!presentation.assurance?.payments.length"
                      >Payment methods are not available.</span
                    >
                  </div>
                </div>
                <div>
                  <div class="w-100 d-block">
                    <span class="text-dark-gray alt-font fw-500">Category:</span>
                    <span>{{
                      presentation.taxonomy.categories.join(", ") || "Not available"
                    }}</span>
                  </div>
                  <div>
                    <span class="text-dark-gray alt-font fw-500">Tags: </span>
                    <span>{{ presentation.taxonomy.tags.join(", ") || "Not available" }}</span>
                  </div>
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
                  <button
                    :id="`product-tab-${tab}`"
                    class="nav-link"
                    :class="{ active: activeTab === tab }"
                    type="button"
                    role="tab"
                    :aria-selected="activeTab === tab"
                    :aria-controls="`product-panel-${tab}`"
                    :tabindex="activeTab === tab ? 0 : -1"
                    @click="activeTab = tab"
                    @keydown="handleTabKey($event, index)"
                  >
                    {{
                      tab === "information"
                        ? "Additional information"
                        : tab === "shipping"
                          ? "Shipping and return"
                          : tab === "reviews"
                            ? `Reviews (${presentation.reviewSummary.count})`
                            : "Description"
                    }}
                    <span class="tab-border bg-dark-gray"></span>
                  </button>
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
                      <div
                        v-if="presentation.descriptionDetail.eyebrow"
                        class="d-flex align-items-center mb-5px"
                      >
                        <div class="col-auto pe-5px">
                          <FashionStoreIcon name="heart" filled class="text-red fs-16" />
                        </div>
                        <div class="col alt-font fw-500 text-dark-gray">
                          {{ presentation.descriptionDetail.eyebrow }}
                        </div>
                      </div>
                      <h4 class="alt-font text-dark-gray fw-500 mb-20px w-90 lg-w-100">
                        {{ presentation.descriptionDetail.heading }}
                      </h4>
                      <p class="w-90">{{ presentation.descriptionDetail.text }}</p>
                      <div v-if="presentation.descriptionDetail.bullets.length">
                        <div
                          v-for="(bullet, index) in presentation.descriptionDetail.bullets"
                          :key="bullet"
                          class="feature-box feature-box-left-icon-middle"
                          :class="{
                            'mb-10px': index < presentation.descriptionDetail.bullets.length - 1,
                          }"
                        >
                          <div
                            class="feature-box-icon feature-box-icon-rounded w-30px h-30px rounded-circle bg-very-light-gray me-10px"
                          >
                            <FashionStoreIcon name="check" class="fs-12 text-dark-gray" />
                          </div>
                          <div class="feature-box-content">
                            <span class="d-block text-dark-gray fw-500">{{ bullet }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="col-lg-6 col-md-8">
                      <img
                        v-if="
                          descriptionMediaSource &&
                          failedDescriptionMediaSource !== descriptionMediaSource
                        "
                        :src="descriptionMediaSource"
                        :alt="descriptionMediaAlt"
                        class="w-100"
                        @error="failedDescriptionMediaSource = descriptionMediaSource"
                      />
                      <div
                        v-else
                        class="fashion-store-product-placeholder"
                        role="img"
                        :aria-label="presentation.name"
                      ></div>
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
                  <template v-if="presentation.optionalRegions.specifications === 'populated'">
                    <div
                      v-for="(specification, index) in presentation.specifications"
                      :key="specification.label"
                      class="row m-0"
                      :class="{ 'bg-very-light-gray': index % 2 === 1 }"
                      data-product-region-state="information"
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
                  </template>
                  <div
                    v-else-if="
                      presentation.optionalRegions.specifications === 'source-shaped-empty'
                    "
                    class="row m-0"
                    data-product-region-state="information"
                  >
                    <div
                      class="col-lg-2 col-md-3 col-sm-4 pt-10px pb-10px text-dark-gray alt-font fw-500"
                    >
                      Product details
                    </div>
                    <div class="col-lg-10 col-md-9 col-sm-8 pt-10px pb-10px">
                      Additional product information is not available.
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
                  <div
                    v-if="
                      presentation.optionalRegions.shipping === 'populated' && presentation.shipping
                    "
                    class="row"
                    data-product-region-state="shipping"
                  >
                    <div class="col-12 col-md-6 last-paragraph-no-margin sm-mb-30px">
                      <h2 class="alt-font fs-22 text-dark-gray mb-15px fw-500">
                        Shipping information
                      </h2>
                      <p>
                        <span class="fw-500 text-dark-gray">Standard:</span>
                        {{ presentation.shipping.standard }}
                      </p>
                    </div>
                    <div class="col-12 col-md-6 last-paragraph-no-margin">
                      <h2 class="alt-font fs-22 text-dark-gray mb-15px fw-500">
                        Return information
                      </h2>
                      <p class="w-80 md-w-100">{{ presentation.shipping.returnBody }}</p>
                    </div>
                  </div>
                  <div
                    v-else-if="presentation.optionalRegions.shipping === 'source-shaped-empty'"
                    class="row"
                    data-product-region-state="shipping"
                  >
                    <div class="col-12 col-md-6 last-paragraph-no-margin sm-mb-30px">
                      <h2 class="alt-font fs-22 text-dark-gray mb-15px fw-500">
                        Shipping information
                      </h2>
                      <p>Shipping information is not available for this product.</p>
                    </div>
                    <div class="col-12 col-md-6 last-paragraph-no-margin">
                      <h2 class="alt-font fs-22 text-dark-gray mb-15px fw-500">
                        Return information
                      </h2>
                      <p class="w-80 md-w-100">
                        Return information is not available for this product.
                      </p>
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
                  <template v-if="presentation.optionalRegions.reviews === 'populated'">
                    <div
                      class="row align-items-center mb-6 sm-mb-10 fashion-product-review-overview"
                    >
                      <div class="col-lg-4 col-md-12 col-sm-7 md-mb-30px text-center text-lg-start">
                        <h5 class="alt-font text-dark-gray fw-500 mb-0 w-85 lg-w-100">
                          Customer reviews for {{ presentation.name }}.
                        </h5>
                      </div>
                      <div
                        class="col-lg-2 col-md-4 col-sm-5 text-center sm-mb-20px p-0 md-ps-15px md-pe-15px"
                      >
                        <div class="border-radius-4px bg-very-light-gray p-30px xl-p-20px">
                          <h2 class="mb-5px alt-font text-dark-gray fw-600">
                            {{ presentation.reviewSummary.averageRating.toFixed(1) }}
                          </h2>
                          <span
                            class="text-golden-yellow icon-small d-block ls-minus-1px mb-5px fashion-product-rating-stars"
                            role="img"
                            :aria-label="`${presentation.reviewSummary.averageRating} out of 5 stars`"
                          >
                            <FashionStoreIcon
                              v-for="star in 5"
                              :key="star"
                              name="star"
                              :filled="star <= Math.round(presentation.reviewSummary.averageRating)"
                            />
                          </span>
                          <span
                            class="ps-15px pe-15px pt-10px pb-10px lh-normal bg-dark-gray text-white fs-12 fw-600 text-uppercase border-radius-4px d-inline-block text-center"
                            >{{ presentation.reviewSummary.label }}</span
                          >
                        </div>
                      </div>
                      <div
                        v-if="presentation.reviewSummary.ratingBands"
                        class="col-lg-6 col-md-8 fashion-product-rating-distribution"
                      >
                        <div class="text-dark-gray mb-15px fw-600">Average customer ratings</div>
                        <div
                          v-for="band in reviewBands"
                          :key="band.rating"
                          class="fashion-product-rating-band"
                        >
                          <span class="fashion-product-rating-band-label"
                            >{{ band.rating }} stars</span
                          >
                          <div
                            class="progress border-radius-6px"
                            role="progressbar"
                            :aria-label="`${band.rating} star reviews`"
                            :aria-valuenow="band.count"
                            aria-valuemin="0"
                            :aria-valuemax="presentation.reviewSummary.count"
                          >
                            <div
                              class="progress-bar bg-green m-0"
                              :style="{ width: `${band.percentage}%` }"
                            ></div>
                          </div>
                          <span class="fashion-product-rating-band-count">{{ band.count }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="row g-0 mb-4 md-mb-35px fashion-product-reviews">
                      <div
                        v-for="(review, index) in visibleReviews"
                        :key="review.id ?? `${review.author}-${review.date}-${index}`"
                        class="col-12 border-bottom border-color-extra-medium-gray pb-40px mb-40px xs-pb-30px xs-mb-30px"
                      >
                        <div class="row g-0 w-100 align-items-start">
                          <div class="col-md-3 sm-mb-10px text-start">
                            <span class="text-dark-gray fw-600 d-block">{{ review.author }}</span>
                            <div class="fs-14 lh-18">{{ review.date }}</div>
                          </div>
                          <div
                            class="col-md-9 last-paragraph-no-margin position-relative text-start"
                          >
                            <span
                              v-if="review.rating"
                              class="text-golden-yellow ls-minus-1px mb-5px sm-me-10px sm-mb-0 d-inline-block d-md-block fashion-product-rating-stars"
                              role="img"
                              :aria-label="`${review.rating} out of 5 stars`"
                            >
                              <FashionStoreIcon
                                v-for="star in 5"
                                :key="star"
                                name="star"
                                :filled="star <= review.rating"
                              />
                            </span>
                            <p class="w-85 sm-w-100 sm-mt-15px">{{ review.text }}</p>
                          </div>
                        </div>
                      </div>
                      <div
                        v-if="visibleReviewCount < presentation.reviews.length"
                        class="col-12 text-center"
                      >
                        <button
                          type="button"
                          class="btn btn-link btn-extra-large text-dark-gray"
                          @click="visibleReviewCount += 3"
                        >
                          Show more reviews
                        </button>
                      </div>
                    </div>
                  </template>
                  <div
                    v-else-if="presentation.optionalRegions.reviews === 'source-shaped-empty'"
                    class="row align-items-center mb-6 sm-mb-10"
                    data-product-region-state="reviews"
                  >
                    <div class="col-12 text-center">
                      <h5 class="alt-font text-dark-gray fw-500 mb-0">
                        No published reviews are available.
                      </h5>
                    </div>
                  </div>
                  <div class="row justify-content-center fashion-product-review-form">
                    <div class="col-12">
                      <div class="p-7 lg-p-5 sm-p-7 bg-very-light-gray">
                        <div class="row justify-content-center mb-30px sm-mb-10px">
                          <div class="col-md-9 text-center">
                            <h4 class="alt-font text-dark-gray fw-500 mb-15px">Add a review</h4>
                          </div>
                        </div>
                        <p
                          v-if="reviewFormState.kind === 'success'"
                          role="status"
                          class="text-center mb-0"
                        >
                          {{ reviewFormState.message }}
                        </p>
                        <form
                          v-else
                          class="row contact-form-style-02"
                          @submit.prevent="submitReview"
                        >
                          <p
                            v-if="reviewFormState.kind === 'error'"
                            role="alert"
                            class="col-12 fashion-product-review-error"
                          >
                            {{ reviewFormState.message }}
                          </p>
                          <div class="col-lg-5 col-md-6 mb-20px">
                            <label class="form-label mb-15px" for="product-review-name"
                              >Your name*</label
                            >
                            <input
                              id="product-review-name"
                              v-model="reviewName"
                              class="form-control border-radius-4px"
                              type="text"
                              maxlength="80"
                              autocomplete="name"
                              placeholder="Enter your name"
                              :disabled="reviewFormState.kind === 'saving'"
                              :aria-invalid="Boolean(reviewErrors.name)"
                              :aria-describedby="
                                reviewErrors.name ? 'product-review-name-error' : undefined
                              "
                              @input="reviewInputChanged"
                            />
                            <p
                              v-if="reviewErrors.name"
                              id="product-review-name-error"
                              class="fashion-product-review-field-error"
                            >
                              {{ reviewErrors.name }}
                            </p>
                          </div>
                          <div class="col-lg-5 col-md-6 mb-20px">
                            <label class="form-label mb-15px" for="product-review-email"
                              >Your email address*</label
                            >
                            <input
                              id="product-review-email"
                              v-model="reviewEmail"
                              class="form-control border-radius-4px"
                              type="email"
                              maxlength="254"
                              autocomplete="email"
                              placeholder="Enter your email address"
                              :disabled="reviewFormState.kind === 'saving'"
                              :aria-invalid="Boolean(reviewErrors.email)"
                              :aria-describedby="
                                reviewErrors.email ? 'product-review-email-error' : undefined
                              "
                              @input="reviewInputChanged"
                            />
                            <p
                              v-if="reviewErrors.email"
                              id="product-review-email-error"
                              class="fashion-product-review-field-error"
                            >
                              {{ reviewErrors.email }}
                            </p>
                          </div>
                          <div class="col-lg-2 mb-20px">
                            <fieldset
                              :aria-describedby="
                                reviewErrors.rating ? 'product-review-rating-error' : undefined
                              "
                            >
                              <legend class="form-label mb-15px">Your rating*</legend>
                              <div
                                class="fashion-product-review-rating-options"
                                @mouseleave="hoveredReviewRating = 0"
                              >
                                <label
                                  v-for="star in 5"
                                  :key="star"
                                  class="fashion-product-review-rating-option"
                                  :data-preview-active="
                                    star <= hoveredReviewRating ? 'true' : undefined
                                  "
                                  @mouseenter="hoveredReviewRating = star"
                                >
                                  <input
                                    v-model.number="reviewRating"
                                    type="radio"
                                    name="product-review-rating"
                                    :value="star"
                                    :aria-label="`${star} stars`"
                                    :disabled="reviewFormState.kind === 'saving'"
                                    @change="reviewInputChanged"
                                  />
                                  <span aria-hidden="true">
                                    <FashionStoreIcon
                                      name="star"
                                      :filled="star <= (hoveredReviewRating || (reviewRating ?? 0))"
                                    />
                                  </span>
                                </label>
                              </div>
                            </fieldset>
                            <p
                              v-if="reviewErrors.rating"
                              id="product-review-rating-error"
                              class="fashion-product-review-field-error"
                            >
                              {{ reviewErrors.rating }}
                            </p>
                          </div>
                          <div class="col-12 mb-20px">
                            <label class="form-label mb-15px" for="product-review-body"
                              >Your review*</label
                            >
                            <textarea
                              id="product-review-body"
                              v-model="reviewBody"
                              class="form-control border-radius-4px"
                              rows="4"
                              maxlength="2000"
                              placeholder="Your message"
                              :disabled="reviewFormState.kind === 'saving'"
                              :aria-invalid="Boolean(reviewErrors.body)"
                              :aria-describedby="
                                reviewErrors.body ? 'product-review-body-error' : undefined
                              "
                              @input="reviewInputChanged"
                            ></textarea>
                            <p
                              v-if="reviewErrors.body"
                              id="product-review-body-error"
                              class="fashion-product-review-field-error"
                            >
                              {{ reviewErrors.body }}
                            </p>
                          </div>
                          <div class="col-lg-9 md-mb-25px">
                            <div
                              class="position-relative terms-condition-box text-start mt-10px"
                              :class="{ 'is-invalid': reviewErrors.consent }"
                            >
                              <label class="d-inline-block">
                                <input
                                  id="product-review-consent"
                                  v-model="reviewConsentAccepted"
                                  type="checkbox"
                                  class="terms-condition check-box align-middle"
                                  :disabled="reviewFormState.kind === 'saving'"
                                  :aria-invalid="Boolean(reviewErrors.consent)"
                                  :aria-describedby="
                                    reviewErrors.consent
                                      ? 'product-review-consent-error'
                                      : undefined
                                  "
                                  @change="reviewInputChanged"
                                />
                                <span class="box fs-15"
                                  >I accept the
                                  <a
                                    href="/policies/terms"
                                    data-fashion-store-route
                                    class="text-decoration-line-bottom text-dark-gray fw-500"
                                    >terms and conditions</a
                                  >
                                  and I have read the
                                  <a
                                    href="/policies/privacy"
                                    data-fashion-store-route
                                    class="text-decoration-line-bottom text-dark-gray fw-500"
                                    >privacy policy</a
                                  >.</span
                                >
                              </label>
                              <p
                                v-if="reviewErrors.consent"
                                id="product-review-consent-error"
                                class="fashion-product-review-field-error"
                              >
                                {{ reviewErrors.consent }}
                              </p>
                            </div>
                          </div>
                          <div class="col-lg-3 text-start text-lg-end">
                            <button
                              type="submit"
                              class="btn btn-small btn-dark-gray btn-box-shadow btn-round-edge"
                              :disabled="reviewFormState.kind === 'saving'"
                            >
                              {{
                                reviewFormState.kind === "saving"
                                  ? "Saving review…"
                                  : "Submit review"
                              }}
                            </button>
                          </div>
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
            v-if="presentation.relatedProducts.length"
            class="shop-modern shop-wrapper grid grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
          >
            <li class="grid-sizer" aria-hidden="true"></li>
            <FashionStoreProductCard
              v-for="product in presentation.relatedProducts"
              :key="product.productId"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
          <p v-else class="mb-0 text-center" data-product-region-state="related-products">
            Related products are not available for this item.
          </p>
        </div>
      </section>

      <FashionStoreProductLightbox
        v-if="displayedGallery[galleryIndex]"
        ref="lightbox"
        :src="gallerySource(galleryIndex)"
        :alt="displayedGallery[galleryIndex]!.alt ?? presentation.name"
        :current="galleryIndex + 1"
        :total="displayedGallery.length"
        @previous="showGallery(galleryIndex - 1)"
        @next="showGallery(galleryIndex + 1)"
        @opened="galleryPaused = true"
        @closed="galleryPaused = false"
        @unavailable="galleryPaused = false"
      />
    </main>
  </FashionStoreShell>
</template>
