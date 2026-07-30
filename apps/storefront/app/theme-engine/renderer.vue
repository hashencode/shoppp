<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import { renderTemplatePlan, type ThemeRegistry } from "./registry";

const properties = defineProps<{
  registry: ThemeRegistry;
  template: PageTemplate;
}>();

const plan = computed(() => renderTemplatePlan(properties.template, properties.registry));
</script>

<template>
  <component
    :is="section.component"
    v-for="section in plan"
    :key="section.instance.id"
    :instance="section.instance"
  >
    <component
      :is="block.component"
      v-for="block in section.blocks"
      :key="block.instance.id"
      :instance="block.instance"
    />
  </component>
</template>
