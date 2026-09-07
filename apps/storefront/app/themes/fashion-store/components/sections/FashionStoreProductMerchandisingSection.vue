<script setup lang="ts">
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import { resolveFashionStoreMerchandising } from "../../contracts/home-merchandising";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const merchandising = computed(() => resolveFashionStoreMerchandising(properties.viewModel));
const presentation = computed(() => {
  if (properties.viewModel.kind !== "theme-section") return {};
  const value = properties.viewModel.data.presentation;
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
});
const labels = computed(() => ({
  "best-sellers": textSetting("best-sellers-label", "Best sellers"),
  featured: textSetting("featured-label", "Featured"),
  "new-arrivals": textSetting("new-arrivals-label", "New arrivals"),
}));
const heading = computed(() => textSetting("merchandising-heading", "Product groups"));
const availableGroups = computed(() =>
  (merchandising.value.state === "populated" ? merchandising.value.data.groups : []).filter(
    ({ products }) => products.length > 0,
  ),
);
const selectedId = ref<string>();

watch(
  availableGroups,
  (groups) => {
    if (!groups.some(({ id }) => id === selectedId.value)) selectedId.value = groups[0]?.id;
  },
  { immediate: true },
);

const selectedGroup = computed(() =>
  availableGroups.value.find(({ id }) => id === selectedId.value),
);

function textSetting(id: string, fallback: string): string {
  const value = presentation.value[id];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
</script>

<template>
  <section
    class="fashion-store-product-merchandising ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 xs-px-0"
    data-home-section="product-merchandising"
  >
    <div class="container-fluid">
      <div class="text-center mb-35px">
        <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">
          Curated from published collections
        </p>
        <h2 class="alt-font fw-600 text-dark-gray mb-0">{{ heading }}</h2>
      </div>

      <p v-if="merchandising.state === 'loading'" data-merchandising-state="loading">
        Product groups are loading.
      </p>
      <p v-else-if="merchandising.state === 'validation-error'" data-merchandising-state="error">
        Product groups could not be loaded. Review this Section's collection binding.
      </p>
      <p v-else-if="merchandising.state === 'unavailable'" data-merchandising-state="unavailable">
        Product groups are unavailable.
      </p>
      <p v-else-if="availableGroups.length === 0" data-merchandising-state="empty">
        No published products are available in these groups.
      </p>
      <template v-else>
        <div
          class="fashion-store-merchandising-selector mb-35px"
          aria-label="Choose a product group"
        >
          <button
            v-for="group in availableGroups"
            :key="group.id"
            type="button"
            class="alt-font btn btn-small"
            :class="group.id === selectedId ? 'btn-dark-gray' : 'btn-transparent-dark-gray'"
            :aria-pressed="group.id === selectedId"
            :data-merchandising-group="group.id"
            @click="selectedId = group.id"
          >
            {{ labels[group.id] }}
          </button>
        </div>
        <ul
          v-if="selectedGroup"
          :key="selectedGroup.id"
          class="fashion-store-merchandising-panel shop-modern shop-wrapper grid grid-4col lg-grid-3col md-grid-2col xs-grid-1col gutter-extra-large text-center"
          :aria-label="labels[selectedGroup.id]"
          :data-merchandising-panel="selectedGroup.id"
        >
          <FashionStoreProductCard
            v-for="product in selectedGroup.products"
            :key="product.id"
            :product="product"
            :resolve-asset="resolveAsset"
          />
        </ul>
      </template>
    </div>
  </section>
</template>

<style scoped>
.fashion-store-merchandising-selector {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  overflow-x: auto;
  padding-block: 0.25rem;
  scrollbar-width: thin;
}

.fashion-store-merchandising-selector button {
  flex: 0 0 auto;
}

.fashion-store-merchandising-panel {
  opacity: 1;
  transition: opacity 180ms ease;
}

@media (max-width: 575px) {
  .fashion-store-merchandising-selector {
    justify-content: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fashion-store-merchandising-panel {
    transition: none;
  }
}
</style>
