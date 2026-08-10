<script setup lang="ts">
import type { SectionInstance } from "@shoppp/contracts";

import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { recordPreviewIntent } from "../../../theme-engine/actions";

const properties = defineProps<{
  instance: SectionInstance;
  viewModel: PresentationViewModel;
}>();
const model = computed(() => (properties.viewModel.kind === "hero" ? properties.viewModel : null));
const textSetting = (id: string, fallback: string) => {
  const value = properties.instance.settings[id];
  return typeof value === "string" ? value : fallback;
};
</script>

<template>
  <section
    v-if="model"
    class="decor-hero"
    :data-palette="instance.settings.palette"
    aria-labelledby="decor-hero-title"
  >
    <div class="decor-hero-copy">
      <p class="eyebrow">{{ model.eyebrow }}</p>
      <h1 id="decor-hero-title">{{ textSetting("heading", model.heading) }}</h1>
      <p>{{ textSetting("body", model.body) }}</p>
      <NuxtLink
        v-if="model.primaryAction?.target"
        class="decor-cta"
        :to="model.primaryAction.target"
        @click="recordPreviewIntent(model.primaryAction, 'decor.layered-hero')"
      >
        {{ model.primaryAction.label }}
      </NuxtLink>
    </div>
    <div v-if="model.media" class="decor-composition">
      <span class="decor-layer decor-layer-one" aria-hidden="true" />
      <span class="decor-layer decor-layer-two" aria-hidden="true" />
      <span class="decor-layer decor-layer-three" aria-hidden="true" />
      <img
        :src="model.media.src"
        :alt="model.media.alt"
        :width="model.media.width"
        :height="model.media.height"
      />
    </div>
    <slot />
  </section>
</template>
