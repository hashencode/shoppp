<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface Data {
  banners: { assetId: string; name: string; size: string }[];
  featured: { assetId: string; count: string; name: string }[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as Data)
    : null,
);
</script>

<template>
  <section v-if="data" id="decor-categories" class="decor-categories">
    <div class="decor-category-icons">
      <header>
        <small>♥ On demand</small>
        <h2>Featured categories</h2>
      </header>
      <div class="decor-category-icon-list">
        <a v-for="item in data.featured" :key="item.assetId" href="/#decor-products">
          <span>
            <img
              :src="properties.resolveAsset(item.assetId)"
              alt=""
              width="65"
              height="65"
              loading="lazy"
            />
            <b>{{ item.count }}</b>
          </span>
          <strong>{{ item.name }}</strong>
        </a>
      </div>
    </div>
    <div class="decor-category-banners">
      <a
        v-for="item in data.banners"
        :key="item.assetId"
        href="/#decor-products"
        :class="{ 'decor-category-banner-large': item.size === 'large' }"
      >
        <img
          :src="properties.resolveAsset(item.assetId)"
          :alt="item.name"
          :width="580"
          :height="item.size === 'large' ? 540 : 260"
          loading="lazy"
        />
        <span>
          {{ item.name }}
          <small>Explore category</small>
        </span>
      </a>
    </div>
  </section>
</template>
