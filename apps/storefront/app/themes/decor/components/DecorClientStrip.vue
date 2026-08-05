<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  items: string[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
</script>
<template>
  <section
    v-if="data"
    class="decor-clients"
    aria-label="Selected partners"
    data-motion-autoplay-ms="0"
    data-motion-duration-ms="3000"
    data-motion-direction="horizontal"
    data-motion-interaction="continuous,no-touch,no-hover-pause"
    data-motion-ready="true"
  >
    <div class="decor-clients-window">
      <div class="decor-clients-track">
        <template v-for="loop in 2" :key="loop">
          <span v-for="item in data.items" :key="`${loop}-${item}`">
            <img
              :src="p.resolveAsset(item)"
              :alt="loop === 1 ? 'Partner mark' : ''"
              :aria-hidden="loop === 2 ? 'true' : undefined"
              width="195"
              height="50"
              loading="lazy"
            />
          </span>
        </template>
      </div>
    </div>
  </section>
</template>
