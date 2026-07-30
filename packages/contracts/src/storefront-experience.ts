import * as z from "zod";

const MAX_SECTIONS = 40;
const MAX_BLOCKS_PER_SECTION = 20;
const MAX_SETTINGS_PER_COMPONENT = 32;
const MAX_OVERRIDE_OPERATIONS = 120;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const themeAssetPathPattern = /^assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
const htmlTagPattern = /<[a-z][^>]*>/i;
const safeTextSchema = z
  .string()
  .max(5_000)
  .refine((value) => !htmlTagPattern.test(value), "HTML markup is not allowed.");

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function safeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.port;
  } catch {
    return false;
  }
}

export const storefrontIdentifierSchema = z.string().min(1).max(100).regex(identifierPattern);
export const storefrontSemverSchema = z.string().regex(semverPattern);
export const storefrontCapabilitySchema = storefrontIdentifierSchema;
export const pageTypeSchema = z.enum([
  "home",
  "collection",
  "product",
  "cart",
  "checkout",
  "order",
  "policy",
]);
export const fixtureStateSchema = z.enum([
  "populated",
  "empty",
  "loading",
  "unavailable",
  "validation-error",
  "success",
]);

export const themeAssetReferenceSchema = z
  .object({
    alt: z.string().trim().min(1).max(300),
    height: z.int().positive().max(16_384),
    kind: z.literal("theme"),
    path: z
      .string()
      .regex(themeAssetPathPattern)
      .refine((path) => !path.includes("..") && !path.includes("//"), "Unsafe theme asset path."),
    width: z.int().positive().max(16_384),
  })
  .strict();

export const remoteAssetReferenceSchema = z
  .object({
    alt: z.string().trim().min(1).max(300),
    height: z.int().positive().max(16_384),
    kind: z.literal("remote"),
    url: z
      .string()
      .url()
      .refine(safeHttpsUrl, "Remote media must use a credential-free HTTPS URL."),
    width: z.int().positive().max(16_384),
  })
  .strict();

export const assetReferenceSchema = z.discriminatedUnion("kind", [
  themeAssetReferenceSchema,
  remoteAssetReferenceSchema,
]);

export const linkTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("route"),
      path: z
        .string()
        .min(1)
        .max(500)
        .regex(/^\/(?!\/)[^\s]*$/)
        .refine((path) => !path.includes(".."), "Route targets cannot traverse paths."),
    })
    .strict(),
  z
    .object({
      kind: z.literal("external"),
      url: z
        .string()
        .url()
        .refine(safeHttpsUrl, "External links must be credential-free HTTPS URLs."),
    })
    .strict(),
]);

const textSettingDefinitionSchema = z
  .object({
    default: safeTextSchema,
    id: storefrontIdentifierSchema,
    kind: z.literal("text"),
    maxLength: z.int().positive().max(5_000),
    required: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.default.length > value.maxLength) {
      context.addIssue({
        code: "custom",
        message: "The default text exceeds maxLength.",
        path: ["default"],
      });
    }
  });

const numberSettingDefinitionSchema = z
  .object({
    default: z.number().finite(),
    id: storefrontIdentifierSchema,
    kind: z.literal("number"),
    max: z.number().finite(),
    min: z.number().finite(),
    required: z.boolean(),
    step: z.number().positive().finite(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.min > value.max || value.default < value.min || value.default > value.max) {
      context.addIssue({
        code: "custom",
        message: "The numeric setting bounds or default are invalid.",
        path: ["default"],
      });
    }
  });

const booleanSettingDefinitionSchema = z
  .object({
    default: z.boolean(),
    id: storefrontIdentifierSchema,
    kind: z.literal("boolean"),
    required: z.boolean(),
  })
  .strict();

const selectSettingDefinitionSchema = z
  .object({
    default: storefrontIdentifierSchema,
    id: storefrontIdentifierSchema,
    kind: z.literal("select"),
    options: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(100),
            value: storefrontIdentifierSchema,
          })
          .strict(),
      )
      .min(1)
      .max(30),
    required: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const optionValues = value.options.map(({ value: optionValue }) => optionValue);
    if (new Set(optionValues).size !== optionValues.length) {
      context.addIssue({
        code: "custom",
        message: "Select option values must be unique.",
        path: ["options"],
      });
    }
    if (!optionValues.includes(value.default)) {
      context.addIssue({
        code: "custom",
        message: "The select default must name a declared option.",
        path: ["default"],
      });
    }
  });

const assetSettingDefinitionSchema = z
  .object({
    default: assetReferenceSchema,
    id: storefrontIdentifierSchema,
    kind: z.literal("asset"),
    required: z.boolean(),
  })
  .strict();

const linkSettingDefinitionSchema = z
  .object({
    default: linkTargetSchema,
    id: storefrontIdentifierSchema,
    kind: z.literal("link"),
    required: z.boolean(),
  })
  .strict();

export const settingDefinitionSchema = z.discriminatedUnion("kind", [
  textSettingDefinitionSchema,
  numberSettingDefinitionSchema,
  booleanSettingDefinitionSchema,
  selectSettingDefinitionSchema,
  assetSettingDefinitionSchema,
  linkSettingDefinitionSchema,
]);

export const settingValueSchema = z.union([
  safeTextSchema,
  z.number().finite(),
  z.boolean(),
  assetReferenceSchema,
  linkTargetSchema,
]);

const componentDefinitionBase = {
  capabilities: z.array(storefrontCapabilitySchema).max(20),
  settings: z.array(settingDefinitionSchema).max(MAX_SETTINGS_PER_COMPONENT),
  type: storefrontIdentifierSchema,
};

export const blockDefinitionSchema = z
  .object(componentDefinitionBase)
  .strict()
  .superRefine(validateComponentDefinition);

export const sectionDefinitionSchema = z
  .object({
    ...componentDefinitionBase,
    allowedBlockTypes: z.array(storefrontIdentifierSchema).max(30),
  })
  .strict()
  .superRefine(validateComponentDefinition);

function validateComponentDefinition(
  value: { capabilities: string[]; settings: { id: string }[] },
  context: z.RefinementCtx,
): void {
  const settingIds = value.settings.map(({ id }) => id);
  if (new Set(settingIds).size !== settingIds.length) {
    context.addIssue({
      code: "custom",
      message: "Component setting IDs must be unique.",
      path: ["settings"],
    });
  }
  if (new Set(value.capabilities).size !== value.capabilities.length) {
    context.addIssue({
      code: "custom",
      message: "Component capabilities must be unique.",
      path: ["capabilities"],
    });
  }
}

export const storefrontActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: storefrontIdentifierSchema,
      intent: storefrontIdentifierSchema,
      kind: z.literal("intent"),
    })
    .strict(),
  z
    .object({
      id: storefrontIdentifierSchema,
      kind: z.literal("navigate"),
      target: linkTargetSchema,
    })
    .strict(),
]);

const settingsRecordSchema = z.record(storefrontIdentifierSchema, settingValueSchema);

export const blockInstanceSchema = z
  .object({
    actions: z.array(storefrontActionSchema).max(8).default([]),
    capabilities: z.array(storefrontCapabilitySchema).max(20),
    id: storefrontIdentifierSchema,
    settings: settingsRecordSchema,
    type: storefrontIdentifierSchema,
    visible: z.boolean().default(true),
  })
  .strict();

export const sectionInstanceSchema = z
  .object({
    blocks: z.array(blockInstanceSchema).max(MAX_BLOCKS_PER_SECTION),
    capabilities: z.array(storefrontCapabilitySchema).max(20),
    id: storefrontIdentifierSchema,
    required: z.boolean().optional(),
    settings: settingsRecordSchema,
    type: storefrontIdentifierSchema,
    visible: z.boolean(),
  })
  .strict();

export const pageTemplateSchema = z
  .object({
    id: storefrontIdentifierSchema,
    pageType: pageTypeSchema,
    requiredCapabilities: z.array(storefrontCapabilitySchema).max(30),
    sections: z.array(sectionInstanceSchema).max(MAX_SECTIONS),
  })
  .strict();

export const themePresetSchema = z
  .object({
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(100),
    templates: z.array(pageTemplateSchema).min(1).max(10),
  })
  .strict();

export const themeProvenanceSchema = z
  .object({
    approvedAt: z.iso.datetime(),
    approvedBy: z.string().trim().min(1).max(120),
    license: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const platformCompatibilitySchema = z
  .object({
    maxExclusive: storefrontSemverSchema,
    min: storefrontSemverSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (compareVersions(value.min, value.maxExclusive) >= 0) {
      context.addIssue({
        code: "custom",
        message: "Platform compatibility min must be below maxExclusive.",
      });
    }
  });

export const themeManifestSchema = z
  .object({
    approvedRemoteMediaHosts: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(253)
          .toLowerCase()
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
      )
      .max(20)
      .refine(
        (hosts) => new Set(hosts).size === hosts.length,
        "Approved media hosts must be unique.",
      )
      .default([]),
    componentRegistry: z
      .object({
        blocks: z.array(blockDefinitionSchema).max(60),
        sections: z.array(sectionDefinitionSchema).max(60),
      })
      .strict(),
    configurationSchemaVersion: z.int().positive(),
    designTokens: z
      .record(
        z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/),
        z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine(
            (value) => !/[{};]/.test(value) && !/url\s*\(|@import/i.test(value),
            "Design tokens cannot contain raw CSS constructs.",
          ),
      )
      .superRefine((tokens, context) => {
        if (Object.keys(tokens).length > 100) {
          context.addIssue({ code: "custom", message: "A theme may define at most 100 tokens." });
        }
      }),
    id: storefrontIdentifierSchema,
    platformCompatibility: platformCompatibilitySchema,
    platformContractVersion: storefrontSemverSchema,
    provenance: themeProvenanceSchema,
    supportedPageTemplates: z.array(pageTypeSchema).min(1).max(10),
    themeVersion: storefrontSemverSchema,
  })
  .strict();

export const themePackageSchema = z
  .object({
    manifest: themeManifestSchema,
    presets: z.array(themePresetSchema).min(1).max(20),
  })
  .strict()
  .superRefine((themePackage, context) => {
    validateThemePackage(themePackage, context);
  });

export const fixtureBindingSchema = z
  .object({
    fixtureId: storefrontIdentifierSchema,
    id: storefrontIdentifierSchema,
    instanceId: storefrontIdentifierSchema,
    kind: z.literal("fixture"),
    resource: storefrontIdentifierSchema,
    state: fixtureStateSchema,
  })
  .strict();

const reorderSectionsOperationSchema = z
  .object({
    instanceIds: z.array(storefrontIdentifierSchema).min(1).max(MAX_SECTIONS),
    kind: z.literal("reorder-sections"),
  })
  .strict();
const setVisibilityOperationSchema = z
  .object({
    instanceId: storefrontIdentifierSchema,
    kind: z.literal("set-visibility"),
    visible: z.boolean(),
  })
  .strict();
const setSettingOperationSchema = z
  .object({
    instanceId: storefrontIdentifierSchema,
    kind: z.literal("set-setting"),
    settingId: storefrontIdentifierSchema,
    value: settingValueSchema,
  })
  .strict();
const resetSettingOperationSchema = z
  .object({
    instanceId: storefrontIdentifierSchema,
    kind: z.literal("reset-setting"),
    settingId: storefrontIdentifierSchema,
  })
  .strict();
export const themeOverrideOperationSchema = z.discriminatedUnion("kind", [
  reorderSectionsOperationSchema,
  setVisibilityOperationSchema,
  setSettingOperationSchema,
  resetSettingOperationSchema,
]);

export const themeOverrideSchema = z
  .object({
    operations: z.array(themeOverrideOperationSchema).max(MAX_OVERRIDE_OPERATIONS),
    presetId: storefrontIdentifierSchema,
    schemaVersion: z.int().positive(),
    templateId: storefrontIdentifierSchema,
  })
  .strict();

export const experienceDraftSchema = z
  .object({
    bindings: z.array(fixtureBindingSchema).max(100),
    experienceId: storefrontIdentifierSchema,
    id: storefrontIdentifierSchema,
    overrides: z.array(themeOverrideSchema).max(10),
    themeId: storefrontIdentifierSchema,
    themeVersion: storefrontSemverSchema,
    version: z.int().positive(),
  })
  .strict();

const experienceSnapshotBaseSchema = z
  .object({
    bindings: z.array(fixtureBindingSchema).max(100),
    configurationSchemaVersion: z.int().positive(),
    experienceId: storefrontIdentifierSchema,
    id: storefrontIdentifierSchema,
    overrides: z.array(themeOverrideSchema).max(10),
    platformContractVersion: storefrontSemverSchema,
    provenance: themeProvenanceSchema,
    resolvedTemplates: z.array(pageTemplateSchema).min(1).max(10),
    themeId: storefrontIdentifierSchema,
    themeVersion: storefrontSemverSchema,
    version: z.int().positive(),
  })
  .strict();

export const experienceSnapshotSchema = z.discriminatedUnion("kind", [
  experienceSnapshotBaseSchema.extend({
    approvedAt: z.null(),
    approvedBy: z.null(),
    kind: z.literal("preview"),
  }),
  experienceSnapshotBaseSchema.extend({
    approvedAt: z.iso.datetime(),
    approvedBy: z.string().trim().min(1).max(120),
    kind: z.literal("approved"),
  }),
]);

export const storefrontThemeDescriptorSchema = z
  .object({
    configurationSchemaVersion: z.int().positive(),
    id: storefrontIdentifierSchema,
    platformCompatibility: platformCompatibilitySchema,
    platformContractVersion: storefrontSemverSchema,
    presets: z.array(storefrontIdentifierSchema).min(1).max(20),
    supportedPageTemplates: z.array(pageTypeSchema).min(1).max(10),
    themeVersion: storefrontSemverSchema,
  })
  .strict();

function addIssue(context: z.RefinementCtx, path: PropertyKey[], message: string): void {
  context.addIssue({ code: "custom", message, path });
}

function validateUnique(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  if (new Set(values).size !== values.length) addIssue(context, path, message);
}

function settingMatchesDefinition(
  value: z.infer<typeof settingValueSchema>,
  definition: z.infer<typeof settingDefinitionSchema>,
): boolean {
  switch (definition.kind) {
    case "asset":
      return (
        typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        (value.kind === "theme" || value.kind === "remote")
      );
    case "boolean":
      return typeof value === "boolean";
    case "link":
      return (
        typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        (value.kind === "route" || value.kind === "external")
      );
    case "number":
      return typeof value === "number" && value >= definition.min && value <= definition.max;
    case "select":
      return (
        typeof value === "string" &&
        definition.options.some(({ value: optionValue }) => optionValue === value)
      );
    case "text":
      return typeof value === "string" && value.length <= definition.maxLength;
  }
}

function validateInstanceSettings(
  settings: Record<string, z.infer<typeof settingValueSchema>>,
  definitions: z.infer<typeof settingDefinitionSchema>[],
  approvedRemoteMediaHosts: Set<string>,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  for (const [settingId, value] of Object.entries(settings)) {
    const definition = definitionsById.get(settingId);
    if (!definition) {
      addIssue(context, [...path, "settings", settingId], "The setting is not declared.");
      continue;
    }
    if (!settingMatchesDefinition(value, definition)) {
      addIssue(context, [...path, "settings", settingId], "The setting value has the wrong type.");
    }
    if (typeof value === "object" && value !== null && "kind" in value && value.kind === "remote") {
      const hostname = new URL(value.url).hostname.toLowerCase();
      if (!approvedRemoteMediaHosts.has(hostname)) {
        addIssue(context, [...path, "settings", settingId], "Remote media host is not approved.");
      }
    }
  }
  for (const definition of definitions) {
    if (definition.required && !(definition.id in settings)) {
      addIssue(
        context,
        [...path, "settings", definition.id],
        "A required component setting is missing.",
      );
    }
  }
}

function validateThemePackage(
  themePackage: z.infer<typeof themePackageSchema>,
  context: z.RefinementCtx,
): void {
  const { manifest, presets } = themePackage;
  const { blocks, sections } = manifest.componentRegistry;
  const blockByType = new Map(blocks.map((definition) => [definition.type, definition]));
  const sectionByType = new Map(sections.map((definition) => [definition.type, definition]));
  const approvedRemoteMediaHosts = new Set(manifest.approvedRemoteMediaHosts);

  validateUnique(
    blocks.map(({ type }) => type),
    context,
    ["manifest", "componentRegistry", "blocks"],
    "Block component types must be unique.",
  );
  validateUnique(
    sections.map(({ type }) => type),
    context,
    ["manifest", "componentRegistry", "sections"],
    "Section component types must be unique.",
  );
  for (const [kind, definitions] of [
    ["blocks", blocks],
    ["sections", sections],
  ] as const) {
    definitions.forEach((definition, index) => {
      if (!definition.type.startsWith("core.") && !definition.type.startsWith(`${manifest.id}.`)) {
        addIssue(
          context,
          ["manifest", "componentRegistry", kind, index, "type"],
          "Theme components must use the theme namespace or core namespace.",
        );
      }
      const defaultValue = definition.settings
        .filter((setting) => setting.kind === "asset")
        .map((setting) => setting.default)
        .find((asset) => asset.kind === "remote");
      if (
        defaultValue?.kind === "remote" &&
        !approvedRemoteMediaHosts.has(new URL(defaultValue.url).hostname.toLowerCase())
      ) {
        addIssue(
          context,
          ["manifest", "componentRegistry", kind, index, "settings"],
          "A default remote media host is not approved.",
        );
      }
    });
  }
  sections.forEach((definition, index) => {
    definition.allowedBlockTypes.forEach((blockType, blockIndex) => {
      if (!blockByType.has(blockType)) {
        addIssue(
          context,
          ["manifest", "componentRegistry", "sections", index, "allowedBlockTypes", blockIndex],
          "The allowed block type is not declared.",
        );
      }
    });
  });

  if (
    compareVersions(manifest.platformCompatibility.min, manifest.platformContractVersion) > 0 ||
    compareVersions(
      manifest.platformContractVersion,
      manifest.platformCompatibility.maxExclusive,
    ) >= 0
  ) {
    addIssue(
      context,
      ["manifest", "platformCompatibility"],
      "The package platform contract version is outside its compatibility range.",
    );
  }

  validateUnique(
    presets.map(({ id }) => id),
    context,
    ["presets"],
    "Preset IDs must be unique.",
  );
  presets.forEach((preset, presetIndex) => {
    validateUnique(
      preset.templates.map(({ id }) => id),
      context,
      ["presets", presetIndex, "templates"],
      "Template IDs must be unique within a preset.",
    );
    preset.templates.forEach((template, templateIndex) => {
      const templatePath = ["presets", presetIndex, "templates", templateIndex] as PropertyKey[];
      if (!manifest.supportedPageTemplates.includes(template.pageType)) {
        addIssue(context, [...templatePath, "pageType"], "The page template is not supported.");
      }
      validateUnique(
        template.sections.map(({ id }) => id),
        context,
        [...templatePath, "sections"],
        "Section instance IDs must be unique.",
      );
      validateUnique(
        template.sections.flatMap((section) => [section.id, ...section.blocks.map(({ id }) => id)]),
        context,
        [...templatePath, "sections"],
        "Section and block instance IDs must be unique within a template.",
      );
      const visibleCapabilities = new Set<string>();
      template.sections.forEach((section, sectionIndex) => {
        const sectionPath = [...templatePath, "sections", sectionIndex] as PropertyKey[];
        const definition = sectionByType.get(section.type);
        if (!definition) {
          addIssue(
            context,
            [...sectionPath, "type"],
            "The section component type is not declared.",
          );
          return;
        }
        validateInstanceSettings(
          section.settings,
          definition.settings,
          approvedRemoteMediaHosts,
          context,
          sectionPath,
        );
        if (section.required && !section.visible) {
          addIssue(context, [...sectionPath, "visible"], "A required section cannot be hidden.");
        }
        for (const capability of section.capabilities) {
          if (!definition.capabilities.includes(capability)) {
            addIssue(
              context,
              [...sectionPath, "capabilities"],
              "The section instance declares an unsupported capability.",
            );
          }
          if (section.visible) visibleCapabilities.add(capability);
        }
        validateUnique(
          section.blocks.map(({ id }) => id),
          context,
          [...sectionPath, "blocks"],
          "Block instance IDs must be unique within a section.",
        );
        section.blocks.forEach((block, blockIndex) => {
          const blockPath = [...sectionPath, "blocks", blockIndex] as PropertyKey[];
          const blockDefinition = blockByType.get(block.type);
          if (!blockDefinition) {
            addIssue(context, [...blockPath, "type"], "The block component type is not declared.");
            return;
          }
          if (!definition.allowedBlockTypes.includes(block.type)) {
            addIssue(
              context,
              [...blockPath, "type"],
              "The block type is not allowed in this section.",
            );
          }
          validateInstanceSettings(
            block.settings,
            blockDefinition.settings,
            approvedRemoteMediaHosts,
            context,
            blockPath,
          );
          for (const capability of block.capabilities) {
            if (!blockDefinition.capabilities.includes(capability)) {
              addIssue(
                context,
                [...blockPath, "capabilities"],
                "The block instance declares an unsupported capability.",
              );
            }
            if (section.visible && block.visible) visibleCapabilities.add(capability);
          }
        });
      });
      for (const capability of template.requiredCapabilities) {
        if (!visibleCapabilities.has(capability)) {
          addIssue(
            context,
            [...templatePath, "requiredCapabilities"],
            `Required capability ${capability} is not provided by a visible instance.`,
          );
        }
      }
    });
  });
}

export type AssetReference = z.infer<typeof assetReferenceSchema>;
export type BlockDefinition = z.infer<typeof blockDefinitionSchema>;
export type BlockInstance = z.infer<typeof blockInstanceSchema>;
export type ExperienceDraft = z.infer<typeof experienceDraftSchema>;
export type ExperienceSnapshot = z.infer<typeof experienceSnapshotSchema>;
export type FixtureBinding = z.infer<typeof fixtureBindingSchema>;
export type PageTemplate = z.infer<typeof pageTemplateSchema>;
export type SectionInstance = z.infer<typeof sectionInstanceSchema>;
export type SectionDefinition = z.infer<typeof sectionDefinitionSchema>;
export type StorefrontAction = z.infer<typeof storefrontActionSchema>;
export type StorefrontThemeDescriptor = z.infer<typeof storefrontThemeDescriptorSchema>;
export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeOverride = z.infer<typeof themeOverrideSchema>;
export type ThemeOverrideOperation = z.infer<typeof themeOverrideOperationSchema>;
export type ThemePackage = z.infer<typeof themePackageSchema>;
export type ThemePreset = z.infer<typeof themePresetSchema>;
