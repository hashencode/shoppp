<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  bannerAssetId: string;
  heading: string;
  products: { assetId: string; name: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const current = ref(0);
</script>
<template>
  <section v-if="data" class="decor-collection">
    <div class="decor-collection-banner">
      <img
        :src="p.resolveAsset(data.bannerAssetId)"
        alt="Blue lounge interior"
        width="1200"
        height="900"
        loading="lazy"
      />
      <div>
        <small>Limited collection</small>
        <h2>{{ data.heading }}</h2>
        <a href="#decor-products">Shop collection</a>
      </div>
    </div>
    <div class="decor-collection-product">
      <article
        v-for="(product, index) in data.products"
        v-show="current === index"
        :key="product.assetId"
      >
        <img
          :src="p.resolveAsset(product.assetId)"
          :alt="product.name"
          width="700"
          height="700"
          loading="lazy"
        />
        <h3>{{ product.name }}</h3>
        <p>$199.00</p>
      </article>
      <div>
        <button
          type="button"
          aria-label="Previous product"
          @click="current = (current - 1 + data.products.length) % data.products.length"
        >
          ←</button
        ><span>{{ current + 1 }} / {{ data.products.length }}</span
        ><button
          type="button"
          aria-label="Next product"
          @click="current = (current + 1) % data.products.length"
        >
          →
        </button>
      </div>
    </div>
  </section>
</template>
