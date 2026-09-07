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
import type { FixtureBindingAliases } from "./providers/types";

export interface ThemeRegistry {
  blocks: Readonly<Record<string, Component>>;
  composition?: ThemeCompositionAdapter;
  fixtureBindingAliases?: FixtureBindingAliases;
  platformShell?: Component;
  rendererShell?: Component;
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
    ...(theme.fixtureBindingAliases ? { fixtureBindingAliases: theme.fixtureBindingAliases } : {}),
    ...(theme.platformShell ? { platformShell: theme.platformShell } : {}),
    ...(theme.rendererShell ? { rendererShell: theme.rendererShell } : {}),
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
  const visibleSections = template.sections.filter(({ visible }) => visible);
  const compositionCoversTemplate = Boolean(
    registry.sectionComposition &&
    (!registry.sectionComposition.pageTypes ||
      registry.sectionComposition.pageTypes.includes(template.pageType)),
  );
  if (
    compositionCoversTemplate &&
    visibleSections.some(
      ({ type }) => !type.startsWith("core.") && !registry.sectionComposition?.sections[type],
    )
  ) {
    throw new Error("A covered template must declare every visible Section composition.");
  }
  const ownsShell = Boolean(
    compositionCoversTemplate &&
    registry.sectionComposition?.rendererShell &&
    visibleSections.some(
      ({ type }) => type === registry.sectionComposition?.rendererShell?.sourceSectionType,
    ),
  );
  if (
    ownsShell &&
    visibleSections.some(
      ({ type }) => registry.sectionComposition?.sections[type]?.shell === "page",
    )
  ) {
    throw new Error("Renderer shell ownership cannot be combined with duplicate shell ownership.");
  }
  return visibleSections.map((section) => ({
    blocks: section.blocks
      .filter(({ visible }) => visible)
      .map((block) => ({
        component: registeredComponent(registry.blocks, block.type, "block"),
        instance: block,
      })),
    component: registeredComponent(registry.sections, section.type, "section"),
    ...(compositionCoversTemplate && registry.sectionComposition?.sections[section.type]
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
  const manifestTypes = new Set(manifestSectionTypes);
  if (descriptorTypes.some((type) => !registryTypes.includes(type) || !manifestTypes.has(type))) {
    throw new Error("A composed theme descriptor must match a registered manifest Section type.");
  }
  if (descriptor.rendererShell && !registry.rendererShell) {
    throw new Error("Renderer shell ownership requires a registered renderer shell component.");
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
  const sections = renderTemplatePlan(template, registry);
  const compositionCoversTemplate = Boolean(
    registry.sectionComposition &&
    (!registry.sectionComposition.pageTypes ||
      registry.sectionComposition.pageTypes.includes(template.pageType)),
  );
  const rendererShellSource = compositionCoversTemplate
    ? registry.sectionComposition?.rendererShell?.sourceSectionType
    : undefined;
  return {
    sections,
    ...(rendererShellSource &&
    sections.some(({ instance }) => instance.type === rendererShellSource) &&
    registry.rendererShell
      ? { shell: registry.rendererShell }
      : {}),
  };
}
