<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";

const properties = defineProps<{ viewModel: PresentationViewModel }>();

const actions = computed(() => {
  const model = properties.viewModel;
  if (model.kind === "product") return model.actions;
  if (model.kind === "cart") {
    return [...model.lines.flatMap(({ quantityActions }) => quantityActions), model.checkoutAction];
  }
  if (model.kind === "checkout") return [model.action];
  if (model.kind === "hero" && model.primaryAction) return [model.primaryAction];
  if (model.kind === "promotion") return [model.action];
  if (model.kind === "state" && model.action) return [model.action];
  return [];
});
</script>

<template>
  <div class="controls" data-preview-block="action">
    <template v-for="action in actions" :key="action.id">
      <NuxtLink
        v-if="action.intent === 'navigation'"
        class="cta"
        :to="action.target"
        @click="recordPreviewIntent(action, 'core.action')"
      >
        {{ action.label }}
      </NuxtLink>
      <button
        v-else
        class="buy-button"
        type="button"
        @click="recordPreviewIntent(action, 'core.action')"
      >
        {{ action.label }}
      </button>
    </template>
  </div>
</template>
