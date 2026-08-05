<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  eyebrow: string;
  heading: string;
  items: { assetId: string; category: string; date: string; title: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
</script>
<template>
  <section v-if="data" id="decor-journal" class="decor-journal">
    <header>
      <small>{{ data.eyebrow }}</small>
      <h2>{{ data.heading }}</h2>
    </header>
    <div>
      <article v-for="item in data.items" :key="item.assetId">
        <img
          :src="p.resolveAsset(item.assetId)"
          :alt="item.title"
          width="720"
          height="520"
          loading="lazy"
        /><small
          ><strong>{{ item.category }}</strong
          ><span>{{ item.date }}</span></small
        >
        <h3>{{ item.title }}</h3>
      </article>
    </div>
  </section>
</template>
