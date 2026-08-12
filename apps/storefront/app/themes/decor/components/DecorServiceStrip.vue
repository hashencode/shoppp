<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorRevealMotion } from "../composables/useDecorRevealMotion";
interface Data {
  items: { assetId: string; detail: string; label: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const revealRoot = useDecorRevealMotion(["services"]);
</script>
<template>
  <section
    v-if="data"
    ref="revealRoot"
    class="decor-services"
    data-source-reveal="services"
    data-reveal-group="services"
    data-reveal-state="pending"
  >
    <article v-for="item in data.items" :key="item.assetId" data-reveal-item>
      <img :src="p.resolveAsset(item.assetId)" alt="" width="60" height="50" loading="lazy" />
      <div>
        <h2>{{ item.label }}</h2>
        <span class="decor-service-detail">{{ item.detail }}</span>
      </div>
    </article>
  </section>
</template>
