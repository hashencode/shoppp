<script setup lang="ts">
import type { FixtureBinding, PageTemplate } from "@shoppp/contracts";

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
  <div class="site-shell">
    <template v-for="section in plan" :key="section.instance.id">
      <component
        :is="section.component"
        :instance="section.instance"
        :view-model="section.viewModel"
      >
        <component
          :is="block.component"
          v-for="block in section.blocks"
          :key="block.instance.id"
          :instance="block.instance"
          :view-model="block.viewModel"
        />
      </component>
      <span
        v-if="section.instance.capabilities.includes('focus.skip-link')"
        id="preview-content"
        tabindex="-1"
      />
    </template>
  </div>
</template>
