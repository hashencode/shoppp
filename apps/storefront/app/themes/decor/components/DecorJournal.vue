<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorRevealMotion } from "../composables/useDecorRevealMotion";
interface Data {
  eyebrow: string;
  heading: string;
  items: { assetId: string; category: string; date: string; title: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const revealRoot = useDecorRevealMotion(["journal-heading", "journal-grid"]);
</script>
<template>
  <section
    v-if="data"
    id="decor-journal"
    ref="revealRoot"
    class="decor-journal"
    data-source-reveal="journal"
    data-reveal-state="pending"
  >
    <header data-reveal-group="journal-heading" data-reveal-item>
      <small>{{ data.eyebrow }}</small>
      <h2>{{ data.heading }}</h2>
    </header>
    <div data-reveal-group="journal-grid">
      <article v-for="item in data.items" :key="item.assetId" data-reveal-item>
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
