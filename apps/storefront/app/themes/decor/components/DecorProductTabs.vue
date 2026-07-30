<script setup lang="ts">
import { Plus } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  categories: string[];
  products: { assetId: string; name: string; price: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const active = ref(0);
const shown = computed(() => {
  const products = data.value?.products ?? [];
  return [...products.slice(active.value * 2), ...products.slice(0, active.value * 2)].slice(0, 8);
});
</script>
<template>
  <section v-if="data" id="decor-products" class="decor-products">
    <header>
      <div>
        <small>Our favorites</small>
        <h2>Curated for your space</h2>
      </div>
      <div role="tablist" aria-label="Product groups">
        <button
          v-for="(category, index) in data.categories"
          :id="`decor-tab-${index}`"
          :key="category"
          type="button"
          role="tab"
          :aria-selected="active === index"
          @click="active = index"
        >
          {{ category }}
        </button>
      </div>
    </header>
    <div class="decor-product-grid" role="tabpanel" :aria-labelledby="`decor-tab-${active}`">
      <article v-for="product in shown" :key="product.assetId">
        <a href="/products/atlas-carry-on"
          ><img
            :src="p.resolveAsset(product.assetId)"
            :alt="product.name"
            width="620"
            height="720"
            loading="lazy"
        /></a>
        <h3>{{ product.name }}</h3>
        <p>{{ product.price }}</p>
        <button type="button" aria-label="Add to preview bag">
          <Plus aria-hidden="true" :size="18" :stroke-width="1.7" />
        </button>
      </article>
    </div>
  </section>
</template>
