<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import {
  decorStoreShopData,
  pageDecorStoreProducts,
  type DecorStoreShopLayout,
  type DecorStoreShopSort,
} from "../../fixtures/pages/shop";
import { decorStoreAssetId } from "../../resources";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreProductCard from "../shared/DecorStoreProductCard.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

const properties = defineProps<{
  pageId: "shop-left" | "shop-none" | "shop-right";
  resolveAsset: ThemeAssetResolver;
}>();
const category = ref<(typeof decorStoreShopData.filters)[number]>("All");
const page = ref(1);
const sort = ref<DecorStoreShopSort>("default");
const wished = ref(new Set<string>());
const layout = computed<DecorStoreShopLayout>(() => decorStoreShopData.layouts[properties.pageId]);
const products = computed(() =>
  pageDecorStoreProducts({ category: category.value, page: page.value, sort: sort.value }),
);
const placeholder = properties.resolveAsset(
  decorStoreAssetId("images/decor-store-placeholder.svg"),
);

watch([category, sort], () => {
  page.value = 1;
});
function toggleWishlist(id: string): void {
  const next = new Set(wished.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  wished.value = next;
}
</script>

<template>
  <DecorStoreShell
    :active-page="pageId"
    :announcement="decorStoreShopData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="shop" title="Shop" />
    <section class="ps-6 pe-6 lg-ps-3 lg-pe-3 sm-ps-0 sm-pe-0">
      <div class="container-fluid">
        <div class="row" :class="{ 'flex-row-reverse': layout === 'left' }">
          <aside
            v-if="layout !== 'none'"
            class="col-xxl-2 col-lg-3 md-mb-60px"
            :data-sidebar="layout"
          >
            <span class="alt-font fw-600 fs-19 text-dark-gray d-block mb-15px"
              >Filter by category</span
            >
            <ul class="shop-filter">
              <li v-for="filter in decorStoreShopData.filters" :key="filter">
                <button
                  type="button"
                  :aria-pressed="category === filter"
                  @click="category = filter"
                >
                  {{ filter }}
                </button>
              </li>
            </ul>
          </aside>
          <div :class="layout === 'none' ? 'col-12' : 'col-xxl-10 col-lg-9'">
            <div
              class="toolbar-wrapper border-bottom d-flex flex-column flex-sm-row align-items-center w-100 mb-40px pb-15px"
            >
              <div>
                Showing {{ products.items.length }} of
                {{ decorStoreShopData.products.length }} results
              </div>
              <div class="mx-auto me-sm-0">
                <label class="sr-only" for="decor-sort">Default sorting</label>
                <select
                  id="decor-sort"
                  v-model="sort"
                  class="form-select border-0"
                  aria-label="Default sorting"
                >
                  <option value="default">Default sorting</option>
                  <option value="name">Sort by name</option>
                  <option value="price-low">Sort by price: low to high</option>
                  <option value="price-high">Sort by price: high to low</option>
                </select>
              </div>
            </div>
            <ul
              class="shop-boxed shop-wrapper grid grid-4col xl-grid-3col md-grid-2col xs-grid-1col gutter-large text-center"
            >
              <DecorStoreProductCard
                v-for="product in products.items"
                :key="product.id"
                :placeholder="placeholder"
                :product="product"
                :wished="wished.has(product.id)"
                @wishlist="toggleWishlist"
              />
            </ul>
            <div class="pagination-style-01 mt-40px d-flex justify-content-center">
              <button
                v-for="number in products.totalPages"
                :key="number"
                type="button"
                :aria-current="page === number ? 'page' : undefined"
                @click="page = number"
              >
                {{ number }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </DecorStoreShell>
</template>
