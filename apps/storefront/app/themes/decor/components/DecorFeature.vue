<script setup lang="ts">
import type { SectionInstance } from "@shoppp/contracts";

import type { PresentationViewModel } from "../../../theme-engine/view-models";

const properties = defineProps<{
  instance: SectionInstance;
  viewModel: PresentationViewModel;
}>();
const model = computed(() =>
  properties.viewModel.kind === "editorial" ? properties.viewModel : null,
);
const textSetting = (id: string, fallback: string) => {
  const value = properties.instance.settings[id];
  return typeof value === "string" ? value : fallback;
};
</script>

<template>
  <article v-if="model" class="decor-feature">
    <p class="decor-feature-mark" aria-hidden="true">⌁</p>
    <div>
      <p class="eyebrow">Fixture composition</p>
      <h2>{{ textSetting("heading", model.heading) }}</h2>
      <p>{{ textSetting("body", model.body) }}</p>
    </div>
    <slot />
  </article>
</template>
