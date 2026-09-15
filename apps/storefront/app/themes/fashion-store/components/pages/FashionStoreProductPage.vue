<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import {
  normalizeFashionStoreProductPresentation,
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
  viewModel: PresentationViewModel;
}>();
const presentation = computed(() => normalizeFashionStoreProductPresentation(properties.viewModel));
const actionPort = useFashionStoreProductActionPort(presentation);
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
const productGallery = ref<InstanceType<typeof FashionStoreProductGallery>>();
const lightbox = ref<InstanceType<typeof FashionStoreProductLightbox>>();
let revalidationVersion = 0;

const displayedOptionGroups = computed(
  () => runtimeProduct.value?.optionGroups ?? presentation.value.optionGroups,
);
const displayedVariants = computed(
  () => runtimeProduct.value?.variants ?? presentation.value.variants,
);
const displayedGallery = computed(
  () => runtimeProduct.value?.gallery ?? presentation.value.gallery,
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
const displayedCompareAtPrice = computed(
  () => selectedVariant.value?.compareAtPriceLabel ?? presentation.value.compareAtPriceLabel,
);
const addDisabled = computed(
  () =>
    (actionPort.authoritative && !hydrated.value) ||
    runtimeState.value.kind === "checking" ||
    runtimeProduct.value?.availability === "out-of-stock" ||
    runtimeProduct.value?.availability === "unavailable",
);
const descriptionMediaSource = computed(() => gallerySource(0));
const descriptionMediaAlt = computed(
  () => displayedGallery.value[0]?.alt ?? presentation.value.name,
);

function gallerySource(index: number): string {
  const item = displayedGallery.value[index];
  if (!item) return "";
  return item.kind === "theme-asset"
    ? properties.resolveAsset(fashionStoreAssetId(item.path))
    : item.src;
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
  void nextTick(() => productGallery.value?.select(0));
  if (hydrated.value && actionPort.authoritative) void revalidate();
}

async function addToCart(): Promise<void> {
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
    :preload-image="gallerySource(0)"
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
                  <a :href="fashionStoreRoutePaths['shop-left']" data-fashion-store-route>Shop</a>
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
                v-if="actionPort.authoritative && !hydrated"
                class="mb-25px"
                role="region"
                aria-label="JavaScript limitations"
              >
                <p>Shopping actions require JavaScript.</p>
                <a href="/shop">Browse the published catalog</a>
              </div>
              <h1 class="visually-hidden">{{ presentation.name }}</h1>
              <h4 class="alt-font text-dark-gray fw-500 mb-5px" role="heading" aria-level="2">
                {{ presentation.name }}
              </h4>
              <div class="d-block d-sm-flex align-items-center mb-15px">
                <div v-if="selectedVariant?.sku">
                  <span class="text-dark-gray fw-500">SKU: </span>{{ selectedVariant.sku }}
                </div>
              </div>
              <div class="product-price mb-10px" data-live-product-price>
                <span class="text-dark-gray fs-28 xs-fs-24 fw-700 ls-minus-1px">
                  <del v-if="displayedCompareAtPrice" class="text-medium-gray me-10px fw-400">{{
                    displayedCompareAtPrice
                  }}</del
                  >{{ displayedPrice }}
                </span>
              </div>
              <p>{{ presentation.description }}</p>

              <div class="fashion-product-options mt-20px">
                <fieldset
                  v-for="(group, groupIndex) in displayedOptionGroups"
                  :key="group.name"
                  class="border-0 p-0 m-0"
                >
                  <legend class="visually-hidden">{{ group.name }}</legend>
                  <div
                    class="d-flex align-items-center"
                    :class="groupIndex === displayedOptionGroups.length - 1 ? 'mb-35px' : 'mb-20px'"
                  >
                    <span class="text-dark-gray alt-font me-15px fw-500">{{ group.name }}</span>
                    <ul :class="group.name === 'Color' ? 'shop-color' : 'shop-size'" class="mb-0">
                      <li v-for="value in group.values" :key="value">
                        <input
                          :id="`product-${group.name.toLowerCase()}-${value.toLowerCase()}`"
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
                        <label :for="`product-${group.name.toLowerCase()}-${value.toLowerCase()}`">
                          <span>{{ value }}</span>
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
                class="d-flex align-items-center flex-column flex-sm-row mb-20px position-relative"
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
                    <span class="btn-double-text ls-0px">{{
                      runtimeState.kind === "error" ? "Retry and add to cart" : "Add to cart"
                    }}</span>
                  </span>
                </button>
                <button
                  v-if="presentation.controls.find(({ role }) => role === 'wishlist')"
                  type="button"
                  class="wishlist d-flex align-items-center justify-content-center border border-radius-5px border-color-extra-medium-gray order-2 order-sm-3"
                  aria-label="Add to wishlist"
                  :disabled="actionPort.authoritative"
                  @click="perform('wishlist', 'Toggle product wishlist')"
                >
                  <FashionStoreIcon name="heart" />
                </button>
              </div>
              <p
                v-if="actionPort.authoritative"
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
                    ['compare', 'question', 'share'].includes(role),
                  )"
                  :key="control.role"
                  class="col-auto icon-with-text-style-08"
                >
                  <div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">
                    <div class="feature-box-icon me-10px">
                      <FashionStoreIcon
                        :name="
                          control.role === 'compare'
                            ? 'repeat'
                            : control.role === 'question'
                              ? 'mail'
                              : 'share-2'
                        "
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
                            ? "Reviews (0)"
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
                      <h4 class="alt-font text-dark-gray fw-500 mb-20px w-90 lg-w-100">
                        {{ presentation.name }}
                      </h4>
                      <p class="w-90">{{ presentation.description }}</p>
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
                  <div
                    v-if="presentation.optionalRegions.specifications === 'source-shaped-empty'"
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
                    v-if="presentation.optionalRegions.shipping === 'source-shaped-empty'"
                    class="row"
                    data-product-region-state="shipping"
                  >
                    <div class="col-12 col-md-6 last-paragraph-no-margin sm-mb-30px">
                      <h2 class="alt-font fs-22">Shipping information</h2>
                      <p>Shipping information is not available for this product.</p>
                    </div>
                    <div class="col-12 col-md-6 last-paragraph-no-margin">
                      <h2 class="alt-font fs-22">Return information</h2>
                      <p>Return information is not available for this product.</p>
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
                  <div
                    v-if="presentation.optionalRegions.reviews === 'source-shaped-empty'"
                    class="row align-items-center mb-6 sm-mb-10"
                    data-product-region-state="reviews"
                  >
                    <div class="col-12 text-center">
                      <h5 class="alt-font text-dark-gray fw-500 mb-0">
                        No published reviews are available.
                      </h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="presentation.relatedProducts.length" class="pt-0 fashion-product-related">
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
              v-for="product in presentation.relatedProducts"
              :key="product.productId"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
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
