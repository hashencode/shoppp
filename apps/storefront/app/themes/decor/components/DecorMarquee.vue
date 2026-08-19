<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorRevealMotion } from "../composables/useDecorRevealMotion";
interface Data {
  messages: string[];
}
const p = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const revealRoot = useDecorRevealMotion(["marquee"]);
</script>
<template>
  <aside
    v-if="data"
    ref="revealRoot"
    class="decor-marquee"
    aria-label="Store values"
    data-motion-autoplay-ms="1"
    data-motion-duration-ms="8000"
    data-motion-direction="horizontal"
    data-motion-interaction="continuous,no-touch"
    data-motion-ready="true"
    data-source-reveal="marquee"
    data-reveal-state="pending"
  >
    <div class="decor-marquee-window">
      <div class="decor-marquee-track" data-reveal-group="marquee" data-reveal-item>
        <template v-for="loop in 3" :key="loop">
          <span
            v-for="message in data.messages"
            :key="`${loop}-${message}`"
            :aria-hidden="loop !== 2 ? 'true' : undefined"
            ><i aria-hidden="true"></i>&nbsp;{{ message }}</span
          >
        </template>
      </div>
    </div>
  </aside>
</template>
