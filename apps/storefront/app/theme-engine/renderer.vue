<script setup lang="ts">
import type { FixtureBinding, PageTemplate } from "@shoppp/contracts";

import type { ThemeAssetResolver } from "./assets";
import { coreThemeRegistry } from "./core-registry";
import { composeThemeRegistries, renderTemplatePlan, type ThemeRegistry } from "./registry";
import {
  resolveFixtureBinding,
  resolveFixtureViewModel,
  type ExperienceFixtureRegistry,
} from "./view-models";

const properties = defineProps<{
  bindings: readonly FixtureBinding[];
  fixtures: ExperienceFixtureRegistry;
  registry: ThemeRegistry;
  resolveAsset: ThemeAssetResolver;
  template: PageTemplate;
}>();

const plan = computed(() =>
  renderTemplatePlan(
    properties.template,
    composeThemeRegistries(coreThemeRegistry, properties.registry),
  ).map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      viewModel: resolveFixtureViewModel(
        resolveFixtureBinding(block.instance.id, properties.bindings),
        properties.fixtures,
      ),
    })),
    viewModel: resolveFixtureViewModel(
      resolveFixtureBinding(section.instance.id, properties.bindings),
      properties.fixtures,
    ),
  })),
);
</script>

<template>
  <main id="preview-content" class="site-shell" tabindex="-1">
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
  </main>
</template>
