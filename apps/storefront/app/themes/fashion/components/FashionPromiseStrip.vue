<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface PromiseData {
  items: string[];
  options?: {
    allowTouchMove: false;
    autoplayMs: 0;
    disableOnInteraction: false;
    keyboard: boolean;
    loop: true;
    speedMs: number;
  };
}

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as PromiseData)
    : null,
);
const uniqueItems = computed(() => [...new Set(data.value?.items ?? [])]);
const paused = ref(false);
let reducedMotionQuery: MediaQueryList | undefined;

function updatePaused(): void {
  paused.value = document.hidden || Boolean(reducedMotionQuery?.matches);
}

onMounted(() => {
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  updatePaused();
  reducedMotionQuery.addEventListener("change", updatePaused);
  document.addEventListener("visibilitychange", updatePaused);
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener("change", updatePaused);
  document.removeEventListener("visibilitychange", updatePaused);
});
</script>

<template>
  <section
    v-if="data"
    class="fashion-promises"
    aria-label="Shopping promises"
    data-motion-direction="horizontal"
    data-motion-easing="linear"
    :data-motion-duration-ms="data.options?.speedMs ?? 10_000"
    :data-motion-paused="paused"
    :style="{
      '--fashion-promise-cycle-ms': `${(data.options?.speedMs ?? 10_000) * uniqueItems.length}ms`,
    }"
  >
    <div class="fashion-promises-track">
      <div class="fashion-promises-cycle">
        <p v-for="(item, index) in uniqueItems" :key="`primary-${index}`">{{ item }}</p>
      </div>
      <div class="fashion-promises-cycle" aria-hidden="true">
        <p v-for="(item, index) in uniqueItems" :key="`clone-${index}`">{{ item }}</p>
      </div>
    </div>
  </section>
</template>
