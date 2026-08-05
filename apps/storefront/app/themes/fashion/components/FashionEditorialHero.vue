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
    class="fashion-hero"
    :data-alignment="instance.settings.alignment"
    aria-labelledby="fashion-hero-title"
  >
    <div class="fashion-hero-copy">
      <p class="eyebrow">{{ model.eyebrow }}</p>
      <h1 id="fashion-hero-title">{{ textSetting("heading", model.heading) }}</h1>
      <p>{{ textSetting("body", model.body) }}</p>
      <NuxtLink
        v-if="model.primaryAction?.target"
        class="fashion-cta"
        :to="model.primaryAction.target"
        @click="recordPreviewIntent(model.primaryAction, 'fashion.editorial-hero')"
      >
        {{ model.primaryAction.label }}
      </NuxtLink>
    </div>
    <figure v-if="model.media" class="fashion-hero-media">
      <img
        :src="model.media.src"
        :alt="model.media.alt"
        :width="model.media.width"
        :height="model.media.height"
      />
      <figcaption>Fixture study 01</figcaption>
    </figure>
    <slot />
  </section>
</template>
