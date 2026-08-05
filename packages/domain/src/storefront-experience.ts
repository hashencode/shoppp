import type { PageTemplate, ThemeOverride, ThemeOverrideOperation } from "@shoppp/contracts";

export type UpgradeConflict =
  | {
      code: "instance-removed";
      instanceId: string;
      operationIndex: number;
    }
  | {
      code: "setting-removed";
      instanceId: string;
      operationIndex: number;
      settingId: string;
    };

type InstanceLocation =
  | { kind: "section"; sectionIndex: number }
  | { blockIndex: number; kind: "block"; sectionIndex: number };
type ExperienceInstance =
  PageTemplate["sections"][number] | PageTemplate["sections"][number]["blocks"][number];

function findInstance(template: PageTemplate, instanceId: string): InstanceLocation | undefined {
  for (const [sectionIndex, section] of template.sections.entries()) {
    if (section.id === instanceId) return { kind: "section", sectionIndex };
    const blockIndex = section.blocks.findIndex(({ id }) => id === instanceId);
    if (blockIndex !== -1) return { blockIndex, kind: "block", sectionIndex };
  }
  return undefined;
}

function instancesById(template: PageTemplate): Map<string, ExperienceInstance> {
  const instances = new Map<string, ExperienceInstance>();
  for (const section of template.sections) {
    instances.set(section.id, section);
    for (const block of section.blocks) instances.set(block.id, block);
  }
  return instances;
}

function assertCompleteReorder(template: PageTemplate, instanceIds: readonly string[]): void {
  const expected = template.sections.map(({ id }) => id);
  if (
    new Set(instanceIds).size !== instanceIds.length ||
    instanceIds.length !== expected.length ||
    expected.some((id) => !instanceIds.includes(id))
  ) {
    throw new Error("Section reorder must contain every existing section exactly once.");
  }
}

function updateInstance(
  template: PageTemplate,
  instanceId: string,
  update: (
    instance: PageTemplate["sections"][number] | PageTemplate["sections"][number]["blocks"][number],
  ) => PageTemplate["sections"][number] | PageTemplate["sections"][number]["blocks"][number],
): PageTemplate {
  const location = findInstance(template, instanceId);
  if (!location) throw new Error(`Override references missing instance ${instanceId}.`);
  return {
    ...template,
    sections: template.sections.map((section, sectionIndex) => {
      if (sectionIndex !== location.sectionIndex) return section;
      if (location.kind === "section") {
        return update(section) as PageTemplate["sections"][number];
      }
      return {
        ...section,
        blocks: section.blocks.map((block, blockIndex) =>
          blockIndex === location.blockIndex
            ? (update(block) as PageTemplate["sections"][number]["blocks"][number])
            : block,
        ),
      };
    }),
  };
}

function applyOperation(
  template: PageTemplate,
  preset: PageTemplate,
  operation: ThemeOverrideOperation,
): PageTemplate {
  switch (operation.kind) {
    case "reorder-sections": {
      assertCompleteReorder(template, operation.instanceIds);
      const sectionsById = new Map(template.sections.map((section) => [section.id, section]));
      return {
        ...template,
        sections: operation.instanceIds.map((id) => {
          const section = sectionsById.get(id);
          if (!section) throw new Error(`Section reorder references missing instance ${id}.`);
          return section;
        }),
      };
    }
    case "reset-setting": {
      const presetLocation = findInstance(preset, operation.instanceId);
      if (!presetLocation) {
        throw new Error(`Override references missing instance ${operation.instanceId}.`);
      }
      const presetSection = preset.sections[presetLocation.sectionIndex]!;
      const presetInstance =
        presetLocation.kind === "section"
          ? presetSection
          : presetSection.blocks[presetLocation.blockIndex]!;
      const presetValue = presetInstance.settings[operation.settingId];
      if (presetValue === undefined) {
        throw new Error(
          `Cannot reset missing preset setting ${operation.settingId} on ${operation.instanceId}.`,
        );
      }
      return updateInstance(template, operation.instanceId, (instance) => ({
        ...instance,
        settings: {
          ...instance.settings,
          [operation.settingId]: structuredClone(presetValue),
        },
      }));
    }
    case "set-setting": {
      return updateInstance(template, operation.instanceId, (instance) => ({
        ...instance,
        settings: {
          ...instance.settings,
          [operation.settingId]: structuredClone(operation.value),
        },
      }));
    }
    case "set-visibility": {
      const location = findInstance(template, operation.instanceId);
      if (!location) {
        throw new Error(`Override references missing instance ${operation.instanceId}.`);
      }
      const section = template.sections[location.sectionIndex]!;
      if (location.kind === "section" && section.required && !operation.visible) {
        throw new Error(`Cannot hide required section ${operation.instanceId}.`);
      }
      return updateInstance(template, operation.instanceId, (instance) => ({
        ...instance,
        visible: operation.visible,
      }));
    }
  }
}

export function validateRequiredCapabilities(template: PageTemplate): string[] {
  const provided = new Set<string>();
  for (const section of template.sections) {
    if (!section.visible) continue;
    for (const capability of section.capabilities) provided.add(capability);
    for (const block of section.blocks) {
      if (!block.visible) continue;
      for (const capability of block.capabilities) provided.add(capability);
    }
  }
  return template.requiredCapabilities.filter((capability) => !provided.has(capability));
}

export function resolveTemplateOverride(
  preset: PageTemplate,
  override: ThemeOverride,
): PageTemplate {
  if (preset.id !== override.templateId) {
    throw new Error(
      `Override template ${override.templateId} does not match preset template ${preset.id}.`,
    );
  }
  const resolved = override.operations.reduce(
    (template, operation) => applyOperation(template, preset, operation),
    structuredClone(preset),
  );
  const missingCapabilities = validateRequiredCapabilities(resolved);
  if (missingCapabilities.length > 0) {
    throw new Error(`Override removes required capabilities: ${missingCapabilities.join(", ")}.`);
  }
  return resolved;
}

export function findUpgradeConflicts(
  previousPreset: PageTemplate,
  nextPreset: PageTemplate,
  override: ThemeOverride,
): UpgradeConflict[] {
  const previousById = instancesById(previousPreset);
  const nextById = instancesById(nextPreset);
  const conflicts: UpgradeConflict[] = [];

  override.operations.forEach((operation, operationIndex) => {
    if (operation.kind === "reorder-sections") {
      for (const instanceId of operation.instanceIds) {
        if (previousById.has(instanceId) && !nextById.has(instanceId)) {
          conflicts.push({ code: "instance-removed", instanceId, operationIndex });
        }
      }
      return;
    }
    const previous = previousById.get(operation.instanceId);
    const next = nextById.get(operation.instanceId);
    if (previous && !next) {
      conflicts.push({
        code: "instance-removed",
        instanceId: operation.instanceId,
        operationIndex,
      });
      return;
    }
    if (
      next &&
      (operation.kind === "set-setting" || operation.kind === "reset-setting") &&
      previous &&
      operation.settingId in previous.settings &&
      !(operation.settingId in next.settings)
    ) {
      conflicts.push({
        code: "setting-removed",
        instanceId: operation.instanceId,
        operationIndex,
        settingId: operation.settingId,
      });
    }
  });

  return conflicts;
}

export function immutableExperienceValue<Value>(value: Value): Readonly<Value> {
  const clone = structuredClone(value);
  const freeze = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== "object" || Object.isFrozen(candidate)) return;
    for (const child of Object.values(candidate)) freeze(child);
    Object.freeze(candidate);
  };
  freeze(clone);
  return clone;
}
