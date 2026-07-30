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
      announcement: "Private fixture preview · no live commerce activity",
      brand: properties.viewModel.brand,
      navigation: properties.viewModel.items.map(({ label }) => label),
    };
  return null;
});
</script>

<template>
  <header v-if="data" class="fashion-header">
    <a class="fashion-skip-link" href="#preview-content">Skip to content</a>
    <p class="fashion-announcement">{{ data.announcement }} <strong>Shop now</strong></p>
    <div class="fashion-nav-shell">
      <div class="fashion-nav-meta" aria-hidden="true">
        <span>⌖ Find stores</span><span>◎ 100k followers</span>
      </div>
      <NuxtLink class="fashion-brand" to="/" aria-label="Mode Life home"
        ><span>ML</span>{{ data.brand }}</NuxtLink
      >
      <nav aria-label="Primary navigation" class="fashion-desktop-nav">
        <a v-for="item in data.navigation" :key="item" href="#fashion-categories">{{ item }}</a>
      </nav>
      <div class="fashion-nav-actions" aria-label="Store utilities">
        <button type="button" aria-label="Search">⌕</button
        ><button type="button" aria-label="Account">♙</button
        ><button type="button" aria-label="Preview bag">▢<sup>0</sup></button>
      </div>
      <details class="fashion-mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <a v-for="item in data.navigation" :key="item" href="#fashion-categories">{{ item }}</a>
        </nav>
      </details>
    </div>
  </header>
</template>
