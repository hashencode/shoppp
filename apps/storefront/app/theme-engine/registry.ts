import type { BlockInstance, PageTemplate, SectionInstance } from "@shoppp/contracts";
import type { Component } from "vue";
import type { ThemeCompositionAdapter } from "./composition";

export interface ThemeRegistry {
  blocks: Readonly<Record<string, Component>>;
  composition?: ThemeCompositionAdapter;
  platformShell?: Component;
  sections: Readonly<Record<string, Component>>;
}

export interface RenderBlockPlan {
  component: Component;
  instance: BlockInstance;
}

export interface RenderSectionPlan {
  blocks: RenderBlockPlan[];
  component: Component;
  instance: SectionInstance;
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
      instance: section,
    }));
}
