import type { ExperienceResourceBinding, ThemeOverride } from "@shoppp/contracts";
import { fashionStoreEditorPackage } from "./package";

const sharedSetting = (id: string) => /^(header-|footer-|identity-logo-|announcement)/.test(id);
export function migrateFashionStoreVisualOverrides(
  overrides: readonly ThemeOverride[],
): ThemeOverride[] {
  const templates = fashionStoreEditorPackage.presets[0]!.templates;
  const settings = structuredClone(templates[0]!.shell!.settings);
  let sharedChanged = false;
  for (const override of overrides)
    for (const operation of override.operations) {
      if (operation.kind === "set-setting" && sharedSetting(operation.settingId)) {
        settings[operation.settingId] = structuredClone(operation.value);
        sharedChanged = true;
      }
      if (operation.kind === "reset-setting" && sharedSetting(operation.settingId)) {
        delete settings[operation.settingId];
        const value = templates[0]!.shell!.settings[operation.settingId];
        if (value !== undefined) settings[operation.settingId] = structuredClone(value);
        sharedChanged = true;
      }
    }
  return templates.flatMap((template) => {
    const original = overrides.find(({ templateId }) => templateId === template.id);
    const operations = (original?.operations ?? []).filter(
      (operation) =>
        !(
          (operation.kind === "set-setting" || operation.kind === "reset-setting") &&
          sharedSetting(operation.settingId)
        ),
    );
    if (sharedChanged)
      operations.push({ kind: "set-shell-presentation", settings: structuredClone(settings) });
    return operations.length
      ? [
          {
            templateId: template.id,
            presetId: original?.presetId ?? overrides[0]?.presetId ?? "source-parity",
            schemaVersion: 4,
            operations,
          },
        ]
      : [];
  });
}

export function migrateFashionStoreVisualBindings(
  bindings: readonly ExperienceResourceBinding[],
): ExperienceResourceBinding[] {
  const result = structuredClone(
    bindings.some(({ kind }) => kind === "catalog")
      ? bindings.filter(({ kind }) => kind !== "fixture")
      : [...bindings],
  );
  const home = fashionStoreEditorPackage.presets[0]!.templates.find(
    ({ pageType }) => pageType === "home",
  )!;
  for (const source of bindings.filter(
    (binding) => binding.kind === "catalog" && binding.instanceId === "fashion-store-home",
  )) {
    if (source.kind !== "catalog") continue;
    for (const section of home.sections) {
      if (
        !result.some(
          (binding) =>
            binding.kind === "catalog" &&
            binding.instanceId === section.id &&
            binding.settingId === source.settingId,
        )
      )
        result.push({
          ...structuredClone(source),
          id: `migration-${section.id}-${source.settingId}`,
          instanceId: section.id,
        });
    }
  }
  return result;
}
