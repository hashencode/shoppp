<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import type { ThemeAssetResolver } from "./assets";
import { storefrontActionAdapterKey, type StorefrontActionAdapter } from "./actions";
import { storefrontCheckoutAdapterKey, type StorefrontCheckoutAdapter } from "./checkout";
import { coreThemeRegistry } from "./core-registry";
import type { PresentationProvider } from "./providers";
import { storefrontPresentationShellKey } from "./presentation-context";
import { composeThemeRegistries, renderThemeTreePlan, type ThemeRegistry } from "./registry";

const properties = defineProps<{
  actionAdapter?: StorefrontActionAdapter;
  provider: PresentationProvider;
  registry: ThemeRegistry;
  resolveAsset: ThemeAssetResolver;
  template: PageTemplate;
  checkoutAdapter?: StorefrontCheckoutAdapter;
}>();

if (properties.actionAdapter) provide(storefrontActionAdapterKey, properties.actionAdapter);
if (properties.checkoutAdapter) provide(storefrontCheckoutAdapterKey, properties.checkoutAdapter);

const registry = computed(() => composeThemeRegistries(coreThemeRegistry, properties.registry));
const tree = computed(() => renderThemeTreePlan(properties.template, registry.value));
const plan = computed(() =>
  tree.value.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      viewModel: properties.provider.resolve({ instanceId: block.instance.id }),
    })),
    viewModel: properties.provider.resolve({
      expectedKind: section.expectedViewModelKind,
      instanceId: section.instance.id,
    }),
  })),
);
const rendererShellViewModel = computed(() => {
  const shell = registry.value.sectionComposition?.rendererShell;
  if (!shell) return undefined;
  const source = properties.template.sections.find(
    ({ type, visible }) => visible && type === shell.sourceSectionType,
  );
  if (!source || !properties.provider.resolveShell) {
    throw new Error("Renderer-owned shell input is unavailable for the selected template.");
  }
  return properties.provider.resolveShell({
    instanceId: source.id,
    resource: shell.fixtureResource,
  });
});
provide(storefrontPresentationShellKey, rendererShellViewModel);
</script>

<template>
  <component :is="tree.shell" v-if="tree.shell" :resolve-asset="properties.resolveAsset">
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
  </component>
  <div v-else id="preview-content" class="site-shell" tabindex="-1">
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
