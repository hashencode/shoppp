<script setup lang="ts">
import { Search, ShoppingBag } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface HeaderData {
  announcement: string;
  brand: string;
  brandAssetId?: string;
  navigation: string[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed<HeaderData | null>(() => {
  if (properties.viewModel.kind === "theme-section")
    return properties.viewModel.data as unknown as HeaderData;
  if (properties.viewModel.kind === "navigation")
    return {
      announcement: "Private fixture preview",
      brand: properties.viewModel.brand,
      navigation: properties.viewModel.items.map(({ label }) => label),
    };
  return null;
});
const destinations = [
  "/",
  "#decor-products",
  "#decor-categories",
  "#decor-footer",
  "#decor-journal",
  "#decor-contact",
];
</script>
<template>
  <header v-if="data" class="decor-header">
    <a class="decor-skip-link" href="#preview-content">Skip to content</a>
    <div class="decor-utility">
      <span>{{ data.announcement }}</span
      ><span>Customer service · Find our store · English</span>
    </div>
    <div class="decor-nav">
      <NuxtLink to="/" class="decor-brand">
        <img
          v-if="data.brandAssetId"
          :src="properties.resolveAsset(data.brandAssetId)"
          :alt="data.brand"
          width="167"
          height="36"
        />
        <template v-else><i aria-hidden="true"></i>{{ data.brand }}</template>
      </NuxtLink>
      <nav aria-label="Primary navigation">
        <a
          v-for="(item, index) in data.navigation"
          :key="item"
          :href="destinations[index] ?? '#decor-categories'"
          >{{ item }}</a
        >
      </nav>
      <div class="decor-actions">
        <button type="button" aria-label="Search">
          <Search aria-hidden="true" :size="19" :stroke-width="1.7" /></button
        ><button type="button" aria-label="Preview bag">
          <ShoppingBag aria-hidden="true" :size="19" :stroke-width="1.7" /><sup>0</sup></button
        ><button type="button" aria-label="Account">My account</button>
      </div>
      <details class="decor-mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <a
            v-for="(item, index) in data.navigation"
            :key="item"
            :href="destinations[index] ?? '#decor-categories'"
            >{{ item }}</a
          >
        </nav>
      </details>
    </div>
  </header>
</template>
