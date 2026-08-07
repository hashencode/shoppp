<script setup lang="ts">
import { recordPreviewIntent } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { resolveFashionStoreShopLayout } from "../../contracts/pages/shop";
import {
  filterFashionStoreShopProducts,
  type FashionStoreShopData,
  type FashionStoreShopFilterGroup,
} from "../../fixtures/pages/shop";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const router = useRouter();
const page = computed(() => resolveFashionStoreShopLayout(router.currentRoute.value.path));
const layout = computed(() => page.value.layout);
const data = computed<FashionStoreShopData>(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Shop requires a theme-section fixture.");
  }
  return properties.viewModel.data as unknown as FashionStoreShopData;
});
const activeFilters = reactive<Partial<Record<FashionStoreShopFilterGroup, string>>>({});
const filterGroups = ["category", "color", "size"] as const;
const visibleProducts = computed(() =>
  filterFashionStoreShopProducts(data.value.products, activeFilters),
);
const currentPage = ref(2);
const actionCount = ref(0);
const arrivalIndex = ref(0);
const arrivalPaused = ref(false);
let arrivalTimer: ReturnType<typeof setInterval> | undefined;

const rowClass = computed(() => (layout.value === "left" ? "row flex-row-reverse" : "row"));
const gridColumnClass = computed(() =>
  layout.value === "none"
    ? "col-12 md-mb-60px"
    : layout.value === "left"
      ? "col-xxl-10 col-lg-9 ps-5 md-ps-15px md-mb-60px"
      : "col-xxl-10 col-lg-9 pe-5 md-pe-15px md-mb-60px",
);
const hasSidebar = computed(() => layout.value !== "none");
const arrivalGroups = computed(() => data.value.arrivals);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function toggleFilter(group: FashionStoreShopFilterGroup, label: string): void {
  if (activeFilters[group] === label) delete activeFilters[group];
  else activeFilters[group] = label;
}

function recordProductIntent(kind: "cart" | "quickView" | "wishlist"): void {
  const action = data.value.productActions[kind];
  recordPreviewIntent(action, `fashion-store.${page.value.id}.product`);
  actionCount.value += 1;
}

function showArrival(index: number): void {
  arrivalIndex.value = (index + arrivalGroups.value.length) % arrivalGroups.value.length;
}

function stopArrivalAutoplay(): void {
  if (arrivalTimer) clearInterval(arrivalTimer);
  arrivalTimer = undefined;
}

function startArrivalAutoplay(): void {
  stopArrivalAutoplay();
  if (!hasSidebar.value || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  arrivalTimer = setInterval(() => {
    if (!arrivalPaused.value) showArrival(arrivalIndex.value + 1);
  }, 5000);
}

watch(hasSidebar, () => startArrivalAutoplay());
onMounted(startArrivalAutoplay);
onBeforeUnmount(stopArrivalAutoplay);
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-shop
      data-runtime-status="ready"
      :data-layout="layout"
      :data-preview-intent-count="actionCount"
    >
      <FashionStorePageTitle title="Shop" />
      <section class="pt-0 ps-6 pe-6 lg-ps-2 lg-pe-2 sm-ps-0 sm-pe-0">
        <div class="container-fluid">
          <div :class="rowClass">
            <div :class="gridColumnClass">
              <ul
                class="shop-modern shop-wrapper grid grid-4col xl-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
                aria-live="polite"
              >
                <li class="grid-sizer" aria-hidden="true"></li>
                <FashionStoreProductCard
                  v-for="product in visibleProducts"
                  :key="product.id"
                  :product="product"
                  :resolve-asset="resolveAsset"
                  @intent="recordProductIntent"
                />
              </ul>
              <div class="w-100 d-flex mt-4 justify-content-center md-mt-30px">
                <ul class="pagination pagination-style-01 fs-13 fw-500 mb-0">
                  <li class="page-item">
                    <button
                      class="page-link"
                      type="button"
                      aria-label="Previous page"
                      @click="currentPage = Math.max(1, currentPage - 1)"
                    >
                      <i class="feather icon-feather-arrow-left fs-18 d-xs-none"></i>
                    </button>
                  </li>
                  <li
                    v-for="number in 4"
                    :key="number"
                    class="page-item"
                    :class="{ active: currentPage === number }"
                  >
                    <button
                      class="page-link"
                      type="button"
                      :aria-current="currentPage === number ? 'page' : undefined"
                      @click="currentPage = number"
                    >
                      0{{ number }}
                    </button>
                  </li>
                  <li class="page-item">
                    <button
                      class="page-link"
                      type="button"
                      aria-label="Next page"
                      @click="currentPage = Math.min(4, currentPage + 1)"
                    >
                      <i class="feather icon-feather-arrow-right fs-18 d-xs-none"></i>
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="hasSidebar" class="col-xxl-2 col-lg-3 shop-sidebar">
              <div v-for="group in filterGroups" :key="group" class="mb-30px">
                <span class="alt-font fw-500 fs-19 text-dark-gray d-block mb-10px"
                  >Filter by {{ group === "category" ? "categories" : group }}</span
                >
                <ul class="shop-filter fs-16" :class="`${group}-filter`">
                  <li v-for="option in data.filters[group]" :key="option.label">
                    <button
                      type="button"
                      :class="{ active: activeFilters[group] === option.label }"
                      :aria-pressed="activeFilters[group] === option.label"
                      @click="toggleFilter(group, option.label)"
                    >
                      <span
                        class="product-cb"
                        :class="group === 'color' ? 'product-color-cb' : 'product-category-cb'"
                        :style="option.swatch ? { backgroundColor: option.swatch } : undefined"
                      ></span
                      >{{ option.label }}
                    </button>
                    <span class="item-qty">{{ option.count }}</span>
                  </li>
                </ul>
              </div>

              <div class="mb-30px">
                <div class="d-flex align-items-center mb-20px">
                  <span class="alt-font fw-500 fs-19 text-dark-gray">New arrivals</span>
                  <div class="d-flex ms-auto">
                    <div
                      class="slider-one-slide-prev-1 icon-very-small swiper-button-prev slider-navigation-style-08 me-5px"
                      role="button"
                      tabindex="0"
                      aria-label="Previous arrivals"
                      @click="showArrival(arrivalIndex - 1)"
                      @keydown.enter.prevent="showArrival(arrivalIndex - 1)"
                      @keydown.space.prevent="showArrival(arrivalIndex - 1)"
                    >
                      <i class="fa-solid fa-arrow-left text-dark-gray"></i>
                    </div>
                    <div
                      class="slider-one-slide-next-1 icon-very-small swiper-button-next slider-navigation-style-08 ms-5px"
                      role="button"
                      tabindex="0"
                      aria-label="Next arrivals"
                      @click="showArrival(arrivalIndex + 1)"
                      @keydown.enter.prevent="showArrival(arrivalIndex + 1)"
                      @keydown.space.prevent="showArrival(arrivalIndex + 1)"
                    >
                      <i class="fa-solid fa-arrow-right text-dark-gray"></i>
                    </div>
                  </div>
                </div>
                <div
                  class="swiper slider-one-slide"
                  :data-arrival-index="arrivalIndex"
                  tabindex="0"
                  @mouseenter="arrivalPaused = true"
                  @mouseleave="arrivalPaused = false"
                  @focusin="arrivalPaused = true"
                  @focusout="arrivalPaused = false"
                  @keydown.left.prevent="showArrival(arrivalIndex - 1)"
                  @keydown.right.prevent="showArrival(arrivalIndex + 1)"
                >
                  <div class="swiper-wrapper">
                    <div
                      v-for="(group, groupIndex) in arrivalGroups"
                      :key="groupIndex"
                      class="swiper-slide"
                      :class="{ 'swiper-slide-active': arrivalIndex === groupIndex }"
                      :aria-hidden="arrivalIndex === groupIndex ? undefined : 'true'"
                    >
                      <div class="shop-filter new-arribals">
                        <div
                          v-for="(product, index) in group"
                          :key="product.id"
                          class="d-flex align-items-center"
                          :class="{ 'mb-20px': index < group.length - 1 }"
                        >
                          <figure class="mb-0">
                            <a :href="fashionStoreRoutePaths.product" data-fashion-store-route
                              ><img
                                class="border-radius-4px w-80px"
                                :src="sourceAsset(product.sourceImage)"
                                alt=""
                            /></a>
                          </figure>
                          <div class="col ps-25px">
                            <a
                              :href="fashionStoreRoutePaths.product"
                              data-fashion-store-route
                              class="text-dark-gray alt-font fw-500 d-inline-block lh-normal"
                              >{{ product.name }}</a
                            >
                            <div class="fs-15 lh-normal">
                              <del class="me-5px">{{ product.originalPrice }}</del
                              >{{ product.price }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span class="alt-font fw-500 fs-19 text-dark-gray d-block mb-10px"
                  >Filter by tags</span
                >
                <div class="shop-filter tag-cloud fs-16">
                  <a
                    v-for="option in data.filters.tag"
                    :key="option.label"
                    href="#"
                    :class="{ active: activeFilters.tag === option.label }"
                    :aria-pressed="activeFilters.tag === option.label"
                    @click.prevent="toggleFilter('tag', option.label)"
                  >
                    {{ option.label }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
