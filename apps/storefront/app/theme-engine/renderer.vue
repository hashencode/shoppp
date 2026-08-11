<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import type { ThemeAssetResolver } from "./assets";
import { previewActionAdapterKey, type PreviewActionAdapter } from "./actions";
import { previewCheckoutAdapterKey, type PreviewCheckoutAdapter } from "./checkout";
import { coreThemeRegistry } from "./core-registry";
import type { PresentationProvider } from "./providers";
import { composeThemeRegistries, renderTemplatePlan, type ThemeRegistry } from "./registry";

const properties = defineProps<{
  actionAdapter: PreviewActionAdapter;
  provider: PresentationProvider;
  registry: ThemeRegistry;
  resolveAsset: ThemeAssetResolver;
  template: PageTemplate;
  checkoutAdapter: PreviewCheckoutAdapter;
}>();

provide(previewActionAdapterKey, properties.actionAdapter);
provide(previewCheckoutAdapterKey, properties.checkoutAdapter);

const plan = computed(() =>
  renderTemplatePlan(
    properties.template,
    composeThemeRegistries(coreThemeRegistry, properties.registry),
  ).map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      viewModel: properties.provider.resolve({ instanceId: block.instance.id }),
    })),
    viewModel: properties.provider.resolve({ instanceId: section.instance.id }),
  })),
);
</script>

<template>
  <div id="preview-content" class="site-shell" tabindex="-1">
    <template v-for="section in plan" :key="section.instance.id">
      <component
        :is="section.component"
        :instance="section.instance"
        :resolve-asset="properties.resolveAsset"
        :view-model="section.viewModel"
      >
        <component
          :is="block.component"
          v-for="block in section.blocks"
          :key="block.instance.id"
          :instance="block.instance"
          :resolve-asset="properties.resolveAsset"
          :view-model="block.viewModel"
        />
      </component>
    </template>
  </div>
</template>
