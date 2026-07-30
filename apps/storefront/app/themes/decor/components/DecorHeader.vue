<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface HeaderData {
  announcement: string;
  brand: string;
  navigation: string[];
}
const properties = defineProps<{ viewModel: PresentationViewModel }>();
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
</script>
<template>
  <header v-if="data" class="decor-header">
    <a class="decor-skip-link" href="#preview-content">Skip to content</a>
    <div class="decor-utility">
      <span>{{ data.announcement }}</span
      ><span>Customer service · Find our store · English</span>
    </div>
    <div class="decor-nav">
      <NuxtLink to="/" class="decor-brand"><i aria-hidden="true"></i>{{ data.brand }}</NuxtLink>
      <nav aria-label="Primary navigation">
        <a v-for="item in data.navigation" :key="item" href="#decor-categories">{{ item }}</a>
      </nav>
      <div class="decor-actions">
        <button type="button" aria-label="Search">⌕</button
        ><button type="button" aria-label="Preview bag">▢<sup>0</sup></button
        ><button type="button" aria-label="Account">My account</button>
      </div>
      <details class="decor-mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <a v-for="item in data.navigation" :key="item" href="#decor-categories">{{ item }}</a>
        </nav>
      </details>
    </div>
  </header>
</template>
