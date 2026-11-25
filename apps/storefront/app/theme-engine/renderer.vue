<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";
import { themeStyleCss } from "./styles";
import EditorRegion from './editor-region.vue';
import { storefrontEditorModeKey } from "./editor-context";

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
  editor?: boolean;
}>();

if (properties.actionAdapter) provide(storefrontActionAdapterKey, properties.actionAdapter);
provide(storefrontEditorModeKey, properties.editor ?? false);
if (properties.checkoutAdapter) provide(storefrontCheckoutAdapterKey, properties.checkoutAdapter);

const registry = computed(() => composeThemeRegistries(coreThemeRegistry, properties.registry));
const tree = computed(() => renderThemeTreePlan(properties.template, registry.value));
const inheritedShellViewModel = inject(storefrontPresentationShellKey, undefined);
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
      settings: section.instance.settings,
    }),
  })),
);
const rendererShellViewModel = computed(() => {
  if (!tree.value.shell) return inheritedShellViewModel?.value;
  const shell = registry.value.sectionComposition?.rendererShell;
  if (!shell) return undefined;
  const source = tree.value.sections.find(
    ({ instance }) => instance.type === shell.sourceSectionType,
  )?.instance;
  if ((!source && !properties.template.shell) || !properties.provider.resolveShell) {
    throw new Error("Renderer-owned shell input is unavailable for the selected template.");
  }
  const resolved = properties.provider.resolveShell({
    instanceId: source?.id ?? "shared-shell",
    resource: shell.fixtureResource,
  });
  const inherited = inheritedShellViewModel?.value;
  return {
    ...inherited,
    ...resolved,
    footer: inherited?.footer ?? resolved.footer,
    header: inherited?.header ?? resolved.header,
  };
});
provide(storefrontPresentationShellKey, rendererShellViewModel);
useHead(() => {
  const css = themeStyleCss(properties.template.styles);
  return { htmlAttrs: { "data-shoppp-theme-styles": css ? "true" : undefined }, style: css ? [{ key: "shoppp-theme-styles", innerHTML: css }] : [] };
});
</script>

<template>
  <component :is="tree.shell" v-if="tree.shell" :resolve-asset="properties.resolveAsset">
    <div id="preview-content" class="site-shell" tabindex="-1">
      <EditorRegion v-for="section in plan" :key="section.instance.id" :instance-id="section.instance.id" :enabled="properties.editor && properties.template.pageType !== 'home'">
        <component
          :is="section.component"
          :instance="section.instance"
          :data-editor-instance="properties.editor && properties.template.pageType === 'home' ? section.instance.id : undefined"
          :resolve-asset="properties.resolveAsset"
          :view-model="section.viewModel"
        >
          <component
            :is="block.component"
            v-for="block in section.blocks"
            :key="block.instance.id"
            :instance="block.instance"
            :data-editor-instance="properties.editor ? block.instance.id : undefined"
            :resolve-asset="properties.resolveAsset"
            :view-model="block.viewModel"
          />
        </component>
      </EditorRegion>
    </div>
  </component>
  <div v-else id="preview-content" class="site-shell" tabindex="-1">
    <EditorRegion v-for="section in plan" :key="section.instance.id" :instance-id="section.instance.id" :enabled="properties.editor && properties.template.pageType !== 'home'">
      <component
        :is="section.component"
        :instance="section.instance"
        :data-editor-instance="properties.editor && properties.template.pageType === 'home' ? section.instance.id : undefined"
        :resolve-asset="properties.resolveAsset"
        :view-model="section.viewModel"
      >
        <component
          :is="block.component"
          v-for="block in section.blocks"
          :key="block.instance.id"
          :instance="block.instance"
          :data-editor-instance="properties.editor ? block.instance.id : undefined"
          :resolve-asset="properties.resolveAsset"
          :view-model="block.viewModel"
        />
      </component>
    </EditorRegion>
  </div>
</template>
