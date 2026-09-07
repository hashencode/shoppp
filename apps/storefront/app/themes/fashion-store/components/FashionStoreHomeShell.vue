<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { storefrontPreviewIntentCountKey } from "../../../theme-engine/presentation-context";
import FashionStoreShell from "./shared/FashionStoreShell.vue";

defineProps<{ resolveAsset: ThemeAssetResolver }>();

const previewIntentCount = ref(0);
provide(storefrontPreviewIntentCountKey, previewIntentCount);
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <FashionStoreShell
    variant="home"
    :preload-image="resolveAsset('fashion-store.decor-hero-1-product')"
    :preview-intent-count="previewIntentCount"
    :resolve-asset="resolveAsset"
  >
    <main
      id="fashion-store-main"
      class="d-flex flex-column"
      data-fashion-store-home-sections
      :data-fashion-store-live-home="hydrated || undefined"
    >
      <slot />
    </main>
  </FashionStoreShell>
</template>
