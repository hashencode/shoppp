import type {
  PageTemplate,
  ThemeOverride,
  ThemeOverrideOperation,
  ThemePackageRegistration,
} from "@shoppp/contracts";

export type ThemePackageOperation =
  | "activation"
  | "creation"
  | "historicalValidation"
  | "immutableRead"
  | "migrationSource"
  | "mutation";

export function packageRegistrationSupports(
  registration: ThemePackageRegistration,
  operation: ThemePackageOperation,
): boolean {
  return (
    registration.lifecycle === "successor" ||
    (operation !== "activation" && operation !== "creation" && operation !== "mutation")
  );
}

export function resolveThemePackageRegistration(
  registrations: readonly ThemePackageRegistration[],
  themeId: string,
  themeVersion: string,
  configurationSchemaVersion?: number,
): ThemePackageRegistration | undefined {
  const matches = registrations.filter(
    ({ package: themePackage }) =>
      themePackage.manifest.id === themeId &&
      themePackage.manifest.themeVersion === themeVersion &&
      (configurationSchemaVersion === undefined ||
        themePackage.manifest.configurationSchemaVersion === configurationSchemaVersion),
  );
  if (matches.length > 1) {
    throw new Error(
      `Theme package registry contains duplicate exact identity ${themeId}@${themeVersion}.`,
    );
  }
  return matches[0];
}

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

function assertCompleteBlockReorder(
  template: PageTemplate,
  sectionId: string,
  instanceIds: readonly string[],
): void {
  const section = template.sections.find(({ id }) => id === sectionId);
  if (!section) throw new Error(`Block reorder references missing section ${sectionId}.`);
  const expected = section.blocks.map(({ id }) => id);
  if (
    new Set(instanceIds).size !== instanceIds.length ||
    instanceIds.length !== expected.length ||
    expected.some((id) => !instanceIds.includes(id))
  ) {
    throw new Error("Block reorder must contain every existing block exactly once.");
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
    case "add-block": {
      if (findInstance(template, operation.block.id)) {
        throw new Error(`Block ID ${operation.block.id} already exists.`);
      }
      const section = template.sections.find(({ id }) => id === operation.sectionId);
      if (!section) throw new Error(`Block add references missing section ${operation.sectionId}.`);
      return {
        ...template,
        sections: template.sections.map((candidate) =>
          candidate.id === operation.sectionId
            ? { ...candidate, blocks: [...candidate.blocks, structuredClone(operation.block)] }
            : candidate,
        ),
      };
    }
    case "remove-block": {
      const location = findInstance(template, operation.instanceId);
      if (!location || location.kind !== "block") {
        throw new Error(`Block remove references missing block ${operation.instanceId}.`);
      }
      return {
        ...template,
        sections: template.sections.map((section, sectionIndex) =>
          sectionIndex === location.sectionIndex
            ? { ...section, blocks: section.blocks.filter(({ id }) => id !== operation.instanceId) }
            : section,
        ),
      };
    }
    case "reorder-blocks": {
      assertCompleteBlockReorder(template, operation.sectionId, operation.instanceIds);
      return {
        ...template,
        sections: template.sections.map((section) => {
          if (section.id !== operation.sectionId) return section;
          const byId = new Map(section.blocks.map((block) => [block.id, block]));
          return { ...section, blocks: operation.instanceIds.map((id) => byId.get(id)!) };
        }),
      };
    }
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
    if (operation.kind === "add-block") return;
    if (operation.kind === "reorder-sections" || operation.kind === "reorder-blocks") {
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
