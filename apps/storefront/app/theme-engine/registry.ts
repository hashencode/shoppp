import {
  themeCompositionDescriptorSchema,
  type BlockInstance,
  type PageTemplate,
  type PresentationViewModelKind,
  type SectionInstance,
  type ThemeCompositionDescriptor,
} from "@shoppp/contracts";
import type { Component } from "vue";
import type { ThemeCompositionAdapter } from "./composition";

export interface ThemeRegistry {
  blocks: Readonly<Record<string, Component>>;
  composition?: ThemeCompositionAdapter;
  platformShell?: Component;
  sectionComposition?: ThemeCompositionDescriptor;
  sections: Readonly<Record<string, Component>>;
}

export interface RenderBlockPlan {
  component: Component;
  instance: BlockInstance;
}

export interface RenderSectionPlan {
  blocks: RenderBlockPlan[];
  component: Component;
  expectedViewModelKind?: PresentationViewModelKind;
  instance: SectionInstance;
}

export interface RenderThemeTreePlan {
  sections: RenderSectionPlan[];
  shell?: Component;
}

function duplicateKeys(
  left: Readonly<Record<string, Component>>,
  right: Readonly<Record<string, Component>>,
): string[] {
  return Object.keys(left).filter((key) => key in right);
}

export function composeThemeRegistries(core: ThemeRegistry, theme: ThemeRegistry): ThemeRegistry {
  const duplicates = [
    ...duplicateKeys(core.blocks, theme.blocks),
    ...duplicateKeys(core.sections, theme.sections),
  ];
  if (duplicates.length > 0) {
    throw new Error(`Theme registry has duplicate component types: ${duplicates.join(", ")}.`);
  }
  return {
    blocks: Object.freeze({ ...core.blocks, ...theme.blocks }),
    ...(theme.composition ? { composition: theme.composition } : {}),
    ...(theme.platformShell ? { platformShell: theme.platformShell } : {}),
    ...(theme.sectionComposition ? { sectionComposition: theme.sectionComposition } : {}),
    sections: Object.freeze({ ...core.sections, ...theme.sections }),
  };
}

function registeredComponent(
  registry: Readonly<Record<string, Component>>,
  type: string,
  kind: "block" | "section",
): Component {
  const component = registry[type];
  if (!component) throw new Error(`Visible ${kind} component ${type} is not registered.`);
  return component;
}

export function renderTemplatePlan(
  template: PageTemplate,
  registry: ThemeRegistry,
): RenderSectionPlan[] {
  validateThemeRegistryComposition(registry);
  return template.sections
    .filter(({ visible }) => visible)
    .map((section) => ({
      blocks: section.blocks
        .filter(({ visible }) => visible)
        .map((block) => ({
          component: registeredComponent(registry.blocks, block.type, "block"),
          instance: block,
        })),
      component: registeredComponent(registry.sections, section.type, "section"),
      ...(registry.sectionComposition?.sections[section.type]
        ? {
            expectedViewModelKind: registry.sectionComposition.sections[section.type]!.fixture.kind,
          }
        : {}),
      instance: section,
    }));
}

export function validateThemeRegistryComposition(
  registry: ThemeRegistry,
  manifestSectionTypes: readonly string[] = Object.keys(registry.sections),
): void {
  if (!registry.sectionComposition) return;
  const descriptor = themeCompositionDescriptorSchema.parse(registry.sectionComposition);
  const registryTypes = Object.keys(registry.sections)
    .filter((type) => !type.startsWith("core."))
    .sort();
  const descriptorTypes = Object.keys(descriptor.sections).sort();
  const manifestTypes = [...manifestSectionTypes].sort();
  if (
    JSON.stringify(registryTypes) !== JSON.stringify(descriptorTypes) ||
    JSON.stringify(registryTypes) !== JSON.stringify(manifestTypes)
  ) {
    throw new Error(
      "A composed theme must declare exactly one descriptor for every registry and manifest Section type.",
    );
  }
  if (descriptor.rendererShell && !registry.platformShell) {
    throw new Error("Renderer shell ownership requires a registered platform shell component.");
  }
  if (
    descriptor.rendererShell &&
    Object.values(descriptor.sections).some(({ shell }) => shell === "page")
  ) {
    throw new Error("Renderer shell ownership cannot be combined with duplicate shell ownership.");
  }
  if (
    descriptor.rendererShell &&
    !(descriptor.rendererShell.sourceSectionType in descriptor.sections)
  ) {
    throw new Error("Renderer shell source Section must have a composition descriptor.");
  }
}

export function renderThemeTreePlan(
  template: PageTemplate,
  registry: ThemeRegistry,
): RenderThemeTreePlan {
  return {
    sections: renderTemplatePlan(template, registry),
    ...(registry.sectionComposition?.rendererShell && registry.platformShell
      ? { shell: registry.platformShell }
      : {}),
  };
}
