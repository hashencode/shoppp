<script setup lang="ts">
import { ArrowRight } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  items: { assetId: string; name: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
</script>
<template>
  <section v-if="data" id="decor-categories" class="decor-categories">
    <div>
      <small>Browse by room</small>
      <h2>Designed for living</h2>
      <p>Thoughtful objects for every corner of home.</p>
    </div>
    <a v-for="item in data.items" :key="item.assetId" href="#decor-products"
      ><img
        :src="p.resolveAsset(item.assetId)"
        :alt="item.name"
        width="520"
        height="620"
        loading="lazy" /><span
        >{{ item.name }} <ArrowRight aria-hidden="true" :size="17" :stroke-width="1.7" /></span
    ></a>
  </section>
</template>
