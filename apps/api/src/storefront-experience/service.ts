import {
  adminStorefrontThemeSchema,
  experienceResourceBindingSchema,
  experienceDraftSchema,
  experienceSnapshotSchema,
  storefrontLinkSchema,
  storefrontResourceReferenceSchema,
  themePackageSchema,
  type CanonicalCatalogRelease,
  type CreateStorefrontExperienceDraftRequest,
  type CreateStorefrontExperienceSuccessorRequest,
  type ExperienceResourceBinding,
  type FashionU8AcceptanceContext,
  type StorefrontExperienceMigrationDryRunRequest,
  type ThemeOverride,
  type ThemePackage,
  type UpdateStorefrontExperienceDraftRequest,
} from "@shoppp/contracts";
import {
  findUpgradeConflicts,
  resolveTemplateOverride,
  validateRequiredCapabilities,
  type UpgradeConflict,
} from "@shoppp/domain";
import type { Context } from "hono";

import { decorManifest } from "../../../storefront/app/themes/decor/manifest";
import { decorPreset } from "../../../storefront/app/themes/decor/presets/layered";
import { decorStoreManifest } from "../../../storefront/app/themes/decor-store/manifest";
import { decorStorePreset } from "../../../storefront/app/themes/decor-store/presets/source-parity";
import { fashionStoreManifest } from "../../../storefront/app/themes/fashion-store/manifest";
import { fashionStorePreset } from "../../../storefront/app/themes/fashion-store/presets/source-parity";
import { sha256Hex } from "../orders/tokens";
import decorFixture from "../../../storefront/fixtures/experience/decor.json";
import decorStoreFixture from "../../../storefront/fixtures/experience/decor-store.json";
import fashionStoreFixture from "../../../storefront/fixtures/experience/fashion-store.json";
import { storefrontThemeCatalog } from "../generated/storefront-theme-catalog";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { redactForLog } from "../security/redaction";
import {
  getCanonicalDeployedCatalogRelease,
  storefrontDestinationsForRelease,
} from "./catalog-resources";
import {
  authorizeFashionU8OperatorMutation,
  bindFashionU8Successor,
  consumeFashionU8AcceptanceRun,
  type FashionU8AcceptanceRun,
} from "./u8-acceptance";

export interface ExperienceValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ExperienceConfigurationMigration {
  readonly fromConfigurationSchemaVersion: number;
  readonly migrate: (overrides: readonly ThemeOverride[]) => ThemeOverride[];
  readonly themeId: string;
  readonly toConfigurationSchemaVersion: number;
}

export interface StorefrontExperienceServiceOptions {
  readonly migrations?: readonly ExperienceConfigurationMigration[];
  readonly packages?: readonly ThemePackage[];
}

interface DraftRow {
  bindings_json: string;
  configuration_schema_version: number;
  created_at: string;
  created_by: string;
  experience_id: string;
  id: string;
  overrides_json: string;
  preset_id: string;
  theme_id: string;
  theme_version: string;
  updated_at: string;
  updated_by: string;
  version: number;
}

interface ValidationRow {
  catalog_release_id: string | null;
  created_at: string;
  draft_id: string;
  draft_version: number;
  id: string;
  issues_json: string;
  resolved_templates_json: string;
  status: "invalid" | "valid";
  validated_by: string;
}

interface MigrationRow {
  approved_at: string | null;
  approved_by: string | null;
  conflicts_json: string;
  created_at: string;
  created_by: string;
  draft_id: string;
  draft_version: number;
  id: string;
  migrated_overrides_json: string;
  source_configuration_schema_version: number;
  source_theme_version: string;
  status: "approved" | "dry_run";
  target_configuration_schema_version: number;
  target_theme_version: string;
}

interface SnapshotRow {
  approved_at: string | null;
  approved_by: string | null;
  configuration_schema_version: number;
  content_digest: string | null;
  created_at: string;
  created_by: string;
  deduplication_key: string;
  experience_id: string;
  id: string;
  kind: "approved" | "preview";
  migration_id: string | null;
  snapshot_json: string;
  source_draft_id: string;
  source_draft_version: number;
  source_validation_id: string;
  theme_id: string;
  theme_version: string;
}

const PLATFORM_CONTRACT_VERSION = "1.0.0";
const MAX_VALIDATION_LOOKUP_BINDINGS = 100;
const defaultPackages = [
  themePackageSchema.parse({ manifest: decorManifest, presets: [decorPreset] }),
  themePackageSchema.parse({ manifest: decorStoreManifest, presets: [decorStorePreset] }),
  themePackageSchema.parse({ manifest: fashionStoreManifest, presets: [fashionStorePreset] }),
] as const;
const fixtureBindingsByThemeId = {
  decor: decorFixture.bindings,
  "decor-store": decorStoreFixture.bindings,
  "fashion-store": fashionStoreFixture.bindings,
} as const;

function packages(options?: StorefrontExperienceServiceOptions): readonly ThemePackage[] {
  return options?.packages ?? defaultPackages;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function packageFor(
  themeId: string,
  themeVersion: string,
  options?: StorefrontExperienceServiceOptions,
): ThemePackage {
  const matchingPackages = packages(options).filter(
    ({ manifest }) => manifest.id === themeId && manifest.themeVersion === themeVersion,
  );
  if (matchingPackages.length === 0) {
    throw new ApiError(
      422,
      "storefront_theme_version_invalid",
      "The selected theme package version is not available.",
    );
  }
  if (matchingPackages.length > 1) {
    throw new ApiError(
      500,
      "storefront_theme_registry_ambiguous",
      "The theme package registry contains duplicate version identities.",
    );
  }
  const found = matchingPackages[0]!;
  const parsed = themePackageSchema.safeParse(found);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "storefront_theme_package_invalid",
      "The selected theme package is invalid.",
    );
  }
  if (
    compareVersions(PLATFORM_CONTRACT_VERSION, parsed.data.manifest.platformCompatibility.min) <
      0 ||
    compareVersions(
      PLATFORM_CONTRACT_VERSION,
      parsed.data.manifest.platformCompatibility.maxExclusive,
    ) >= 0
  ) {
    throw new ApiError(
      422,
      "storefront_theme_incompatible",
      "The selected theme package is incompatible with this platform contract.",
    );
  }
  return parsed.data;
}

function parseBindings(value: string): ExperienceResourceBinding[] {
  return experienceResourceBindingSchema.array().parse(JSON.parse(value));
}

function parseOverrides(value: string): ThemeOverride[] {
  return JSON.parse(value) as ThemeOverride[];
}

function mapValidation(row: ValidationRow | null) {
  return row
    ? {
        catalogReleaseId: row.catalog_release_id,
        createdAt: row.created_at,
        draftVersion: row.draft_version,
        id: row.id,
        issues: JSON.parse(row.issues_json) as ExperienceValidationIssue[],
        status: row.status,
        validatedBy: row.validated_by,
      }
    : null;
}

function mapDraft(row: DraftRow, validationRows: readonly ValidationRow[] = []) {
  const validations = validationRows.map((validation) => mapValidation(validation)!);
  return {
    bindings: parseBindings(row.bindings_json),
    configurationSchemaVersion: row.configuration_schema_version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    experienceId: row.experience_id,
    id: row.id,
    overrides: parseOverrides(row.overrides_json),
    presetId: row.preset_id,
    themeId: row.theme_id,
    themeVersion: row.theme_version,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    validation: validations.find(({ catalogReleaseId }) => catalogReleaseId === null) ?? null,
    validations,
    version: row.version,
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function mapSnapshot(row: SnapshotRow) {
  const snapshot = experienceSnapshotSchema.parse(JSON.parse(row.snapshot_json));
  return {
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    configurationSchemaVersion: row.configuration_schema_version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    contentDigest: row.content_digest ?? (await sha256Hex(canonicalJson(snapshot))),
    experienceId: row.experience_id,
    id: row.id,
    kind: row.kind,
    migrationId: row.migration_id,
    snapshot,
    sourceDraftId: row.source_draft_id,
    sourceDraftVersion: row.source_draft_version,
    sourceValidationId: row.source_validation_id,
    themeId: row.theme_id,
    themeVersion: row.theme_version,
  };
}

async function draftRow(db: D1Database, id: string): Promise<DraftRow> {
  const row = await db
    .prepare("SELECT * FROM storefront_experience_drafts WHERE id = ?")
    .bind(id)
    .first<DraftRow>();
  if (!row) {
    throw new ApiError(
      404,
      "storefront_experience_draft_not_found",
      "The storefront experience draft was not found.",
    );
  }
  return row;
}

async function validationRow(
  db: D1Database,
  draftId: string,
  draftVersion: number,
  catalogReleaseId?: string,
): Promise<ValidationRow | null> {
  return db
    .prepare(
      `SELECT *
         FROM storefront_experience_validations
        WHERE draft_id = ? AND draft_version = ? AND catalog_release_id IS ?`,
    )
    .bind(draftId, draftVersion, catalogReleaseId ?? null)
    .first<ValidationRow>();
}

async function validationRows(
  db: D1Database,
  draftId: string,
  draftVersion: number,
): Promise<ValidationRow[]> {
  const rows = await db
    .prepare(
      `SELECT *
         FROM storefront_experience_validations
        WHERE draft_id = ? AND draft_version = ?
        ORDER BY created_at DESC, id DESC`,
    )
    .bind(draftId, draftVersion)
    .all<ValidationRow>();
  return rows.results;
}

function draftVersionKey(draftId: string, draftVersion: number): string {
  return `${draftId}\u0000${draftVersion}`;
}

async function validationRowsByDraft(
  db: D1Database,
  drafts: readonly Pick<DraftRow, "id" | "version">[],
): Promise<Map<string, ValidationRow[]>> {
  const grouped = new Map<string, ValidationRow[]>();
  const draftsPerQuery = Math.floor(MAX_VALIDATION_LOOKUP_BINDINGS / 2);

  for (let index = 0; index < drafts.length; index += draftsPerQuery) {
    const chunk = drafts.slice(index, index + draftsPerQuery);
    const predicates = chunk.map(() => "(draft_id = ? AND draft_version = ?)").join(" OR ");
    const bindings = chunk.flatMap(({ id, version }) => [id, version]);
    const rows = await db
      .prepare(
        `SELECT *
           FROM storefront_experience_validations
          WHERE ${predicates}
          ORDER BY draft_id ASC, draft_version ASC, created_at DESC, id DESC`,
      )
      .bind(...bindings)
      .all<ValidationRow>();

    for (const row of rows.results) {
      const key = draftVersionKey(row.draft_id, row.draft_version);
      const validations = grouped.get(key);
      if (validations) validations.push(row);
      else grouped.set(key, [row]);
    }
  }

  return grouped;
}

function conflictError(): ApiError {
  return new ApiError(
    409,
    "storefront_experience_draft_conflict",
    "The storefront experience draft changed. Reload it before saving again.",
  );
}

function assertExpectedVersion(row: DraftRow, expectedVersion: number): void {
  if (row.version !== expectedVersion) throw conflictError();
}

function resolveDraft(
  row: DraftRow,
  options?: StorefrontExperienceServiceOptions,
  overridePackage?: ThemePackage,
  overrideOperations?: readonly ThemeOverride[],
  catalogRelease?: CanonicalCatalogRelease,
): {
  issues: ExperienceValidationIssue[];
  package: ThemePackage;
  resolvedTemplates: ThemePackage["presets"][number]["templates"];
} {
  const selectedPackage = overridePackage ?? packageFor(row.theme_id, row.theme_version, options);
  const issues: ExperienceValidationIssue[] = [];
  if (
    !overridePackage &&
    row.configuration_schema_version !== selectedPackage.manifest.configurationSchemaVersion
  ) {
    issues.push({
      code: "configuration_schema_mismatch",
      message: "The draft configuration schema does not match its exact theme package.",
    });
  }
  const preset = selectedPackage.presets.find(({ id }) => id === row.preset_id);
  if (!preset) {
    return {
      issues: [
        ...issues,
        {
          code: "preset_not_found",
          message: `Preset ${row.preset_id} is not declared by the selected theme package.`,
        },
      ],
      package: selectedPackage,
      resolvedTemplates: [],
    };
  }
  const overrides = [...(overrideOperations ?? parseOverrides(row.overrides_json))];
  const overridesByTemplate = new Map<string, ThemeOverride>();
  for (const override of overrides) {
    if (
      override.presetId !== preset.id ||
      override.schemaVersion !== selectedPackage.manifest.configurationSchemaVersion
    ) {
      issues.push({
        code: "override_schema_mismatch",
        message: `Override for ${override.templateId} does not match the selected preset schema.`,
        path: override.templateId,
      });
      continue;
    }
    if (overridesByTemplate.has(override.templateId)) {
      issues.push({
        code: "duplicate_template_override",
        message: `Template ${override.templateId} has more than one override.`,
        path: override.templateId,
      });
      continue;
    }
    overridesByTemplate.set(override.templateId, override);
  }
  for (const templateId of overridesByTemplate.keys()) {
    if (!preset.templates.some(({ id }) => id === templateId)) {
      issues.push({
        code: "unknown_template_override",
        message: `Override references unknown template ${templateId}.`,
        path: templateId,
      });
    }
  }
  const resolvedTemplates = preset.templates.flatMap((template) => {
    const override = overridesByTemplate.get(template.id);
    try {
      const resolved = override
        ? resolveTemplateOverride(template, override)
        : structuredClone(template);
      const missing = validateRequiredCapabilities(resolved);
      if (missing.length > 0) {
        issues.push({
          code: "required_capability_missing",
          message: `Template ${template.id} is missing ${missing.join(", ")}.`,
          path: template.id,
        });
        return [];
      }
      return [resolved];
    } catch (error) {
      issues.push({
        code: "override_invalid",
        message: error instanceof Error ? error.message : "The override could not be resolved.",
        path: template.id,
      });
      return [];
    }
  });
  const resolvedPackage = themePackageSchema.safeParse({
    manifest: selectedPackage.manifest,
    presets: selectedPackage.presets.map((candidate) =>
      candidate.id === preset.id ? { ...candidate, templates: resolvedTemplates } : candidate,
    ),
  });
  if (!resolvedPackage.success) {
    for (const issue of resolvedPackage.error.issues.slice(0, 20)) {
      issues.push({
        code: "resolved_template_invalid",
        message: issue.message,
        path: issue.path.join("."),
      });
    }
  }
  const visibleInstanceIds = new Set(
    resolvedTemplates.flatMap(({ sections }) =>
      sections.flatMap((section) => [
        ...(section.visible ? [section.id] : []),
        ...section.blocks.filter(({ visible }) => visible).map(({ id }) => id),
      ]),
    ),
  );
  const declaredInstanceIds = new Set(
    resolvedTemplates.flatMap(({ sections }) =>
      sections.flatMap((section) => [section.id, ...section.blocks.map(({ id }) => id)]),
    ),
  );
  const bindings = parseBindings(row.bindings_json);
  const bindingIds = bindings.map(({ id }) => id);
  if (new Set(bindingIds).size !== bindingIds.length) {
    issues.push({
      code: "duplicate_binding_id",
      message: "Fixture binding IDs must be unique.",
    });
  }
  const fixtureBindings = bindings.filter((binding) => binding.kind === "fixture");
  const fixtureInstanceIds = fixtureBindings.map(({ instanceId }) => instanceId);
  if (new Set(fixtureInstanceIds).size !== fixtureInstanceIds.length) {
    issues.push({ code: "duplicate_fixture_binding", message: "Fixture bindings must be unique." });
  }
  const catalogBindings = bindings.filter((binding) => binding.kind === "catalog");
  const referenceKeys = catalogRelease
    ? new Set([
        ...catalogRelease.products.map(({ id }) => `product:${id}`),
        ...catalogRelease.collections.map(({ id }) => `collection:${id}`),
        ...storefrontDestinationsForRelease(catalogRelease).map(({ id, kind }) => `${kind}:${id}`),
      ])
    : null;
  const catalogBindingKeys = catalogBindings.map(
    ({ instanceId, settingId }) => `${instanceId}:${settingId}`,
  );
  if (new Set(catalogBindingKeys).size !== catalogBindingKeys.length) {
    issues.push({
      code: "duplicate_catalog_binding",
      message: "Each catalog reference field may have only one binding.",
    });
  }
  for (const instanceId of bindings.map(({ instanceId }) => instanceId)) {
    if (!declaredInstanceIds.has(instanceId)) {
      issues.push({
        code: "resource_binding_unknown",
        message: `Resource binding references unknown instance ${instanceId}.`,
        path: instanceId,
      });
    }
  }
  const definitionsByInstance = new Map(
    resolvedTemplates.flatMap(({ sections }) =>
      sections.flatMap((section) => {
        const instances = [section, ...section.blocks];
        return instances.map((instance) => {
          const definition =
            selectedPackage.manifest.componentRegistry.sections.find(
              ({ type }) => type === instance.type,
            ) ??
            selectedPackage.manifest.componentRegistry.blocks.find(
              ({ type }) => type === instance.type,
            );
          return [instance.id, definition?.settings ?? []] as const;
        });
      }),
    ),
  );
  if (catalogBindings.length === 0) {
    for (const instanceId of visibleInstanceIds) {
      if (!fixtureInstanceIds.includes(instanceId)) {
        issues.push({
          code: "fixture_binding_missing",
          message: `Visible instance ${instanceId} has no fixture binding.`,
          path: instanceId,
        });
      }
    }
  } else {
    for (const binding of catalogBindings) {
      const definition = definitionsByInstance
        .get(binding.instanceId)
        ?.find(({ id }) => id === binding.settingId);
      const expectedKind =
        binding.reference.kind === "product" ? "product-reference" : "collection-reference";
      if (!definition || definition.kind !== expectedKind) {
        issues.push({
          code: "catalog_binding_setting_invalid",
          message: `Catalog binding ${binding.id} does not match a declared ${expectedKind} field.`,
          path: `${binding.instanceId}.${binding.settingId}`,
        });
      }
      if (
        referenceKeys &&
        !referenceKeys.has(`${binding.reference.kind}:${binding.reference.id}`)
      ) {
        issues.push({
          code: "catalog_reference_missing",
          message: `Catalog reference ${binding.reference.id} is not in the selected Catalog Release.`,
          path: `${binding.instanceId}.${binding.settingId}`,
        });
      }
    }
  }
  if (referenceKeys || catalogBindings.length > 0) {
    for (const [instanceId, definitions] of definitionsByInstance) {
      if (!visibleInstanceIds.has(instanceId)) continue;
      for (const definition of definitions) {
        if (
          definition.required &&
          (definition.kind === "product-reference" || definition.kind === "collection-reference") &&
          !catalogBindings.some(
            (binding) => binding.instanceId === instanceId && binding.settingId === definition.id,
          )
        ) {
          issues.push({
            code: "catalog_binding_missing",
            message: `Required catalog reference ${definition.id} is missing.`,
            path: `${instanceId}.${definition.id}`,
          });
        }
      }
    }
  }
  if (referenceKeys) {
    for (const template of resolvedTemplates) {
      for (const instance of template.sections.flatMap((section) => [section, ...section.blocks])) {
        const definitions = definitionsByInstance.get(instance.id) ?? [];
        for (const definition of definitions) {
          const value = instance.settings[definition.id];
          if (value === undefined) continue;
          const reference = storefrontResourceReferenceSchema.safeParse(value);
          const link = storefrontLinkSchema.safeParse(value);
          const target = reference.success
            ? reference.data
            : link.success && link.data.target.kind === "internal"
              ? link.data.target.reference
              : null;
          if (target && !referenceKeys.has(`${target.kind}:${target.id}`)) {
            issues.push({
              code: "content_reference_missing",
              message: `Content reference ${target.id} is not in the selected Catalog Release.`,
              path: `${instance.id}.${definition.id}`,
            });
          }
        }
      }
    }
  }
  return { issues, package: selectedPackage, resolvedTemplates };
}

async function recordAuditOnce(
  context: Context<ApiEnvironment>,
  input: {
    action: string;
    id: string;
    metadata?: Record<string, unknown>;
    reason: string;
    result: "failed" | "succeeded";
    targetId: string;
    targetType: string;
  },
): Promise<void> {
  const principal = context.get("principal");
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, actor_id, action, target_type, target_id, result, reason,
        request_id, metadata_json, created_at)
     VALUES (?, 'admin', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      principal.id,
      input.action,
      input.targetType,
      input.targetId,
      input.result,
      String(redactForLog(input.reason)),
      context.get("requestId"),
      JSON.stringify(redactForLog(input.metadata ?? {})),
      new Date().toISOString(),
    )
    .run();
}

export function listStorefrontThemes() {
  return storefrontThemeCatalog.map((descriptor) => {
    const themePackage = defaultPackages.find(
      ({ manifest }) =>
        manifest.id === descriptor.id && manifest.themeVersion === descriptor.themeVersion,
    );
    if (!themePackage) {
      throw new ApiError(
        500,
        "storefront_theme_catalog_drift",
        "The generated storefront theme catalog does not match the package registry.",
      );
    }
    return adminStorefrontThemeSchema.parse({
      ...descriptor,
      componentRegistry: themePackage.manifest.componentRegistry,
      fixtureBindings: experienceResourceBindingSchema
        .array()
        .parse(fixtureBindingsByThemeId[descriptor.id]),
      presetDefinitions: themePackage.presets,
    });
  });
}

export async function createStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  request: CreateStorefrontExperienceDraftRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const selectedPackage = packageFor(request.draft.themeId, request.draft.themeVersion, options);
  if (!selectedPackage.presets.some(({ id }) => id === request.draft.presetId)) {
    throw new ApiError(
      422,
      "storefront_theme_preset_invalid",
      "The selected preset is not available in this theme package.",
    );
  }
  const principal = context.get("principal");
  const id = `draft-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  experienceDraftSchema.parse({
    bindings: request.draft.bindings,
    experienceId: request.draft.experienceId,
    id,
    overrides: request.draft.overrides,
    themeId: request.draft.themeId,
    themeVersion: request.draft.themeVersion,
    version: 1,
  });
  await context.env.DB.prepare(
    `INSERT INTO storefront_experience_drafts
       (id, experience_id, theme_id, theme_version, configuration_schema_version,
        preset_id, bindings_json, overrides_json, version, created_by, updated_by,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      request.draft.experienceId,
      request.draft.themeId,
      request.draft.themeVersion,
      selectedPackage.manifest.configurationSchemaVersion,
      request.draft.presetId,
      JSON.stringify(request.draft.bindings),
      JSON.stringify(request.draft.overrides),
      principal.id,
      principal.id,
      now,
      now,
    )
    .run();
  await recordAuditEvent(context.env.DB, {
    action: "themes.draft.create",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: {
      presetId: request.draft.presetId,
      themeId: request.draft.themeId,
      themeVersion: request.draft.themeVersion,
    },
    reason: request.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  return getStorefrontExperienceDraft(context.env.DB, id);
}

export async function getStorefrontExperienceDraft(db: D1Database, id: string) {
  const row = await draftRow(db, id);
  return mapDraft(row, await validationRows(db, id, row.version));
}

export async function listStorefrontExperienceDrafts(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT *
         FROM storefront_experience_drafts
        ORDER BY updated_at DESC, id DESC
        LIMIT 100`,
    )
    .all<DraftRow>();
  const validationsByDraft = await validationRowsByDraft(db, rows.results);
  return rows.results.map((row) =>
    mapDraft(row, validationsByDraft.get(draftVersionKey(row.id, row.version)) ?? []),
  );
}

export async function updateStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  id: string,
  request: UpdateStorefrontExperienceDraftRequest,
) {
  const current = await draftRow(context.env.DB, id);
  assertExpectedVersion(current, request.expectedVersion);
  experienceDraftSchema.parse({
    bindings: request.bindings,
    experienceId: current.experience_id,
    id: current.id,
    overrides: request.overrides,
    themeId: current.theme_id,
    themeVersion: current.theme_version,
    version: current.version + 1,
  });
  const principal = context.get("principal");
  await authorizeFashionU8OperatorMutation(
    context.env.DB,
    principal,
    id,
    request.reason,
    request.u8Acceptance,
  );
  const now = new Date().toISOString();
  const updated = await context.env.DB.prepare(
    `UPDATE storefront_experience_drafts
        SET bindings_json = ?, overrides_json = ?, version = version + 1,
            updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(
      JSON.stringify(request.bindings),
      JSON.stringify(request.overrides),
      principal.id,
      now,
      id,
      request.expectedVersion,
    )
    .run();
  if (updated.meta.changes !== 1) throw conflictError();
  await recordAuditEvent(context.env.DB, {
    action: "themes.draft.update",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: { fromVersion: request.expectedVersion, toVersion: request.expectedVersion + 1 },
    reason: request.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  return getStorefrontExperienceDraft(context.env.DB, id);
}

export async function createStorefrontExperienceSuccessor(
  context: Context<ApiEnvironment>,
  sourceId: string,
  request: CreateStorefrontExperienceSuccessorRequest,
) {
  const principal = context.get("principal");
  const acceptanceRun = await authorizeFashionU8OperatorMutation(
    context.env.DB,
    principal,
    sourceId,
    request.reason,
    request.u8Acceptance,
  );
  const source = await draftRow(context.env.DB, sourceId);
  if (request.sourceVersion > source.version) {
    throw new ApiError(
      409,
      "storefront_experience_successor_source_invalid",
      "The successor source version is newer than the saved draft.",
    );
  }
  const id = `draft-${crypto.randomUUID()}`;
  experienceDraftSchema.parse({
    bindings: request.bindings,
    experienceId: source.experience_id,
    id,
    overrides: request.overrides,
    themeId: source.theme_id,
    themeVersion: source.theme_version,
    version: 1,
  });
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO storefront_experience_drafts
       (id, experience_id, theme_id, theme_version, configuration_schema_version,
        preset_id, bindings_json, overrides_json, version, created_by, updated_by,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      source.experience_id,
      source.theme_id,
      source.theme_version,
      source.configuration_schema_version,
      source.preset_id,
      JSON.stringify(request.bindings),
      JSON.stringify(request.overrides),
      principal.id,
      principal.id,
      now,
      now,
    )
    .run();
  await recordAuditEvent(context.env.DB, {
    action: "themes.draft.successor.create",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: {
      savedSourceVersion: source.version,
      sourceDraftId: sourceId,
      sourceVersion: request.sourceVersion,
    },
    reason: request.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  if (acceptanceRun) {
    await bindFashionU8Successor(context.env.DB, acceptanceRun, sourceId, id);
  }
  return getStorefrontExperienceDraft(context.env.DB, id);
}

export async function validateStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  id: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string,
  u8Acceptance?: FashionU8AcceptanceContext,
  options?: StorefrontExperienceServiceOptions,
) {
  await authorizeFashionU8OperatorMutation(
    context.env.DB,
    context.get("principal"),
    id,
    reason,
    u8Acceptance,
  );
  const row = await draftRow(context.env.DB, id);
  assertExpectedVersion(row, expectedVersion);
  const catalogRelease = catalogReleaseId
    ? await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId)
    : undefined;
  const resolution = resolveDraft(row, options, undefined, undefined, catalogRelease);
  const validationId = `validation-${(
    await sha256Hex(`${id}:${expectedVersion}:${catalogReleaseId ?? "fixture-preview"}`)
  ).slice(0, 40)}`;
  const principal = context.get("principal");
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_experience_validations
       (id, draft_id, draft_version, catalog_release_id, status, issues_json,
        resolved_templates_json, validated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      validationId,
      id,
      expectedVersion,
      catalogReleaseId ?? null,
      resolution.issues.length === 0 ? "valid" : "invalid",
      JSON.stringify(resolution.issues),
      JSON.stringify(resolution.resolvedTemplates),
      principal.id,
      now,
    )
    .run();
  await recordAuditOnce(context, {
    action: "themes.draft.validate",
    id: `audit-${validationId}`,
    metadata: {
      catalogReleaseId: catalogReleaseId ?? null,
      issueCount: resolution.issues.length,
      version: expectedVersion,
    },
    reason,
    result: resolution.issues.length === 0 ? "succeeded" : "failed",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  const validation = await validationRow(context.env.DB, id, expectedVersion, catalogReleaseId);
  return mapValidation(validation);
}

async function validResolution(
  context: Context<ApiEnvironment>,
  id: string,
  expectedVersion: number,
  catalogReleaseId?: string,
  options?: StorefrontExperienceServiceOptions,
) {
  const row = await draftRow(context.env.DB, id);
  assertExpectedVersion(row, expectedVersion);
  const validation = await validationRow(context.env.DB, id, expectedVersion, catalogReleaseId);
  if (!validation || validation.status !== "valid") {
    throw new ApiError(
      409,
      "storefront_experience_validation_stale",
      "Validate the current draft version before creating a snapshot.",
    );
  }
  const catalogRelease = catalogReleaseId
    ? await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId)
    : undefined;
  const resolution = resolveDraft(row, options, undefined, undefined, catalogRelease);
  if (resolution.issues.length > 0) {
    throw new ApiError(
      409,
      "storefront_experience_validation_invalid",
      "The validated draft no longer resolves safely.",
    );
  }
  return { ...resolution, row, validation };
}

async function snapshotId(deduplicationKey: string, kind: "approved" | "preview") {
  return `snapshot-${kind}-${(await sha256Hex(deduplicationKey)).slice(0, 32)}`;
}

async function existingSnapshot(
  db: D1Database,
  deduplicationKey: string,
): Promise<SnapshotRow | null> {
  return db
    .prepare("SELECT * FROM storefront_experience_snapshots WHERE deduplication_key = ?")
    .bind(deduplicationKey)
    .first<SnapshotRow>();
}

async function insertSnapshot(
  context: Context<ApiEnvironment>,
  input: {
    deduplicationKey: string;
    kind: "approved" | "preview";
    migrationId?: string;
    package: ThemePackage;
    reason: string;
    resolvedTemplates: ThemePackage["presets"][number]["templates"];
    row: DraftRow;
    validation: ValidationRow;
    acceptanceRun?: FashionU8AcceptanceRun;
  },
) {
  const principal = context.get("principal");
  const now = new Date().toISOString();
  const id = await snapshotId(input.deduplicationKey, input.kind);
  let snapshotOverrides = parseOverrides(input.row.overrides_json);
  if (input.migrationId) {
    const migration = await context.env.DB.prepare(
      "SELECT migrated_overrides_json FROM storefront_experience_migrations WHERE id = ?",
    )
      .bind(input.migrationId)
      .first<{ migrated_overrides_json: string }>();
    if (!migration) {
      throw new ApiError(
        404,
        "storefront_experience_migration_not_found",
        "The storefront experience migration was not found.",
      );
    }
    snapshotOverrides = JSON.parse(migration.migrated_overrides_json) as ThemeOverride[];
  }
  const snapshot = experienceSnapshotSchema.parse({
    approvedAt: input.kind === "approved" ? now : null,
    approvedBy: input.kind === "approved" ? principal.id : null,
    bindings: parseBindings(input.row.bindings_json),
    configurationSchemaVersion: input.package.manifest.configurationSchemaVersion,
    experienceId: input.row.experience_id,
    id,
    kind: input.kind,
    overrides: snapshotOverrides,
    platformContractVersion: input.package.manifest.platformContractVersion,
    provenance: input.package.manifest.provenance,
    resolvedTemplates: input.resolvedTemplates,
    themeId: input.package.manifest.id,
    themeVersion: input.package.manifest.themeVersion,
    version: input.row.version,
  });
  const contentDigest = await sha256Hex(canonicalJson(snapshot));
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_experience_snapshots
       (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
        source_validation_id, migration_id, kind, theme_id, theme_version,
        configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
        approved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.deduplicationKey,
      input.row.experience_id,
      input.row.id,
      input.row.version,
      input.validation.id,
      input.migrationId ?? null,
      input.kind,
      input.package.manifest.id,
      input.package.manifest.themeVersion,
      input.package.manifest.configurationSchemaVersion,
      JSON.stringify(snapshot),
      contentDigest,
      principal.id,
      input.kind === "approved" ? principal.id : null,
      input.kind === "approved" ? now : null,
      now,
    )
    .run();
  await recordAuditOnce(context, {
    action:
      input.kind === "approved" ? "themes.experience.approve" : "themes.preview.snapshot.create",
    id: `audit-${id}`,
    metadata: {
      catalogReleaseId: input.validation.catalog_release_id,
      draftId: input.row.id,
      draftVersion: input.row.version,
      themeVersion: input.package.manifest.themeVersion,
    },
    reason: input.reason,
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_snapshot",
  });
  const persisted = await existingSnapshot(context.env.DB, input.deduplicationKey);
  if (!persisted) {
    throw new ApiError(
      409,
      "storefront_experience_snapshot_conflict",
      "The immutable storefront experience snapshot could not be reconciled.",
    );
  }
  if (input.kind === "approved" && input.acceptanceRun) {
    await consumeFashionU8AcceptanceRun(
      context.env.DB,
      input.acceptanceRun,
      principal.id,
      input.row.id,
      id,
    );
  }
  return mapSnapshot(persisted);
}

export async function createStorefrontExperiencePreviewSnapshot(
  context: Context<ApiEnvironment>,
  id: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string,
  u8Acceptance?: FashionU8AcceptanceContext,
  options?: StorefrontExperienceServiceOptions,
) {
  await authorizeFashionU8OperatorMutation(
    context.env.DB,
    context.get("principal"),
    id,
    reason,
    u8Acceptance,
  );
  const resolution = await validResolution(context, id, expectedVersion, catalogReleaseId, options);
  return insertSnapshot(context, {
    deduplicationKey: `${id}:${expectedVersion}:${catalogReleaseId ?? "fixture-preview"}:preview`,
    kind: "preview",
    package: resolution.package,
    reason,
    resolvedTemplates: resolution.resolvedTemplates,
    row: resolution.row,
    validation: resolution.validation,
  });
}

export async function approveStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  id: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string,
  u8Acceptance?: FashionU8AcceptanceContext,
  options?: StorefrontExperienceServiceOptions,
) {
  const acceptanceRun = await authorizeFashionU8OperatorMutation(
    context.env.DB,
    context.get("principal"),
    id,
    reason,
    u8Acceptance,
  );
  const resolution = await validResolution(context, id, expectedVersion, catalogReleaseId, options);
  return insertSnapshot(context, {
    ...(acceptanceRun ? { acceptanceRun } : {}),
    deduplicationKey: `${id}:${expectedVersion}:${catalogReleaseId ?? "fixture-preview"}:approved:${resolution.package.manifest.themeVersion}:${resolution.package.manifest.configurationSchemaVersion}`,
    kind: "approved",
    package: resolution.package,
    reason,
    resolvedTemplates: resolution.resolvedTemplates,
    row: resolution.row,
    validation: resolution.validation,
  });
}

function mapMigration(row: MigrationRow) {
  return {
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    conflicts: JSON.parse(row.conflicts_json) as UpgradeConflict[],
    createdAt: row.created_at,
    createdBy: row.created_by,
    draftId: row.draft_id,
    draftVersion: row.draft_version,
    id: row.id,
    sourceConfigurationSchemaVersion: row.source_configuration_schema_version,
    sourceThemeVersion: row.source_theme_version,
    status: row.status,
    targetConfigurationSchemaVersion: row.target_configuration_schema_version,
    targetThemeVersion: row.target_theme_version,
  };
}

async function migrationRow(db: D1Database, id: string): Promise<MigrationRow> {
  const row = await db
    .prepare("SELECT * FROM storefront_experience_migrations WHERE id = ?")
    .bind(id)
    .first<MigrationRow>();
  if (!row) {
    throw new ApiError(
      404,
      "storefront_experience_migration_not_found",
      "The storefront experience migration dry run was not found.",
    );
  }
  return row;
}

function migratedOverrides(
  row: DraftRow,
  target: ThemePackage,
  options?: StorefrontExperienceServiceOptions,
): ThemeOverride[] {
  const source = parseOverrides(row.overrides_json);
  if (row.configuration_schema_version === target.manifest.configurationSchemaVersion) {
    return source.map((override) => ({
      ...structuredClone(override),
      schemaVersion: target.manifest.configurationSchemaVersion,
    }));
  }
  const migration = options?.migrations?.find(
    (candidate) =>
      candidate.themeId === row.theme_id &&
      candidate.fromConfigurationSchemaVersion === row.configuration_schema_version &&
      candidate.toConfigurationSchemaVersion === target.manifest.configurationSchemaVersion,
  );
  if (!migration) {
    throw new ApiError(
      422,
      "storefront_experience_migration_unavailable",
      "No pure configuration migration is registered for the selected schema versions.",
    );
  }
  return migration.migrate(source);
}

export async function dryRunStorefrontExperienceMigration(
  context: Context<ApiEnvironment>,
  id: string,
  request: StorefrontExperienceMigrationDryRunRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const row = await draftRow(context.env.DB, id);
  assertExpectedVersion(row, request.expectedVersion);
  const sourcePackage = packageFor(row.theme_id, row.theme_version, options);
  const targetPackage = packageFor(row.theme_id, request.targetThemeVersion, options);
  if (
    targetPackage.manifest.configurationSchemaVersion !== request.targetConfigurationSchemaVersion
  ) {
    throw new ApiError(
      422,
      "storefront_experience_migration_target_invalid",
      "The target package and configuration schema versions do not match.",
    );
  }
  const overrides = migratedOverrides(row, targetPackage, options);
  const sourcePreset = sourcePackage.presets.find(({ id: presetId }) => presetId === row.preset_id);
  const targetPreset = targetPackage.presets.find(({ id: presetId }) => presetId === row.preset_id);
  const conflicts: UpgradeConflict[] = [];
  if (!sourcePreset || !targetPreset) {
    conflicts.push({ code: "instance-removed", instanceId: row.preset_id, operationIndex: 0 });
  } else {
    for (const override of overrides) {
      const previous = sourcePreset.templates.find(
        ({ id: templateId }) => templateId === override.templateId,
      );
      const next = targetPreset.templates.find(
        ({ id: templateId }) => templateId === override.templateId,
      );
      if (!previous || !next) {
        conflicts.push({
          code: "instance-removed",
          instanceId: override.templateId,
          operationIndex: 0,
        });
      } else {
        conflicts.push(...findUpgradeConflicts(previous, next, override));
      }
    }
  }
  const key = `${id}:${row.version}:${request.targetThemeVersion}:${request.targetConfigurationSchemaVersion}`;
  const migrationId = `migration-${(await sha256Hex(key)).slice(0, 32)}`;
  const principal = context.get("principal");
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_experience_migrations
       (id, draft_id, draft_version, source_theme_version,
        source_configuration_schema_version, target_theme_version,
        target_configuration_schema_version, migrated_overrides_json, conflicts_json,
        status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'dry_run', ?, ?)`,
  )
    .bind(
      migrationId,
      id,
      row.version,
      row.theme_version,
      row.configuration_schema_version,
      request.targetThemeVersion,
      request.targetConfigurationSchemaVersion,
      JSON.stringify(overrides),
      JSON.stringify(conflicts),
      principal.id,
      now,
    )
    .run();
  await recordAuditOnce(context, {
    action: "themes.migration.dry-run",
    id: `audit-${migrationId}`,
    metadata: { conflictCount: conflicts.length },
    reason: request.reason,
    result: conflicts.length === 0 ? "succeeded" : "failed",
    targetId: migrationId,
    targetType: "storefront_experience_migration",
  });
  return mapMigration(await migrationRow(context.env.DB, migrationId));
}

export async function approveStorefrontExperienceMigration(
  context: Context<ApiEnvironment>,
  draftId: string,
  migrationId: string,
  expectedVersion: number,
  reason: string,
  options?: StorefrontExperienceServiceOptions,
) {
  const draft = await draftRow(context.env.DB, draftId);
  assertExpectedVersion(draft, expectedVersion);
  const migration = await migrationRow(context.env.DB, migrationId);
  if (migration.draft_id !== draftId || migration.draft_version !== expectedVersion) {
    throw new ApiError(
      409,
      "storefront_experience_migration_stale",
      "The migration does not belong to the current draft version.",
    );
  }
  const conflicts = JSON.parse(migration.conflicts_json) as UpgradeConflict[];
  if (conflicts.length > 0) {
    throw new ApiError(
      422,
      "storefront_experience_migration_conflicts",
      "Resolve stable-instance migration conflicts before approval.",
    );
  }
  const validation = await validationRow(context.env.DB, draftId, expectedVersion);
  if (!validation || validation.status !== "valid") {
    throw new ApiError(
      409,
      "storefront_experience_validation_stale",
      "Validate the current draft before approving its migration.",
    );
  }
  const targetPackage = packageFor(draft.theme_id, migration.target_theme_version, options);
  const overrides = JSON.parse(migration.migrated_overrides_json) as ThemeOverride[];
  const resolution = resolveDraft(draft, options, targetPackage, overrides);
  if (resolution.issues.length > 0) {
    throw new ApiError(
      422,
      "storefront_experience_migration_invalid",
      "The migrated configuration does not satisfy the target package.",
    );
  }
  const principal = context.get("principal");
  const now = new Date().toISOString();
  const successorId = `draft-migration-${(await sha256Hex(migrationId)).slice(0, 32)}`;
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO storefront_experience_drafts
         (id, experience_id, theme_id, theme_version, configuration_schema_version,
          preset_id, bindings_json, overrides_json, version, created_by, updated_by,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(
      successorId,
      draft.experience_id,
      draft.theme_id,
      targetPackage.manifest.themeVersion,
      targetPackage.manifest.configurationSchemaVersion,
      draft.preset_id,
      draft.bindings_json,
      JSON.stringify(overrides),
      principal.id,
      principal.id,
      now,
      now,
    ),
    context.env.DB.prepare(
      `UPDATE storefront_experience_migrations
          SET status = 'approved', approved_by = ?, approved_at = ?
        WHERE id = ? AND status = 'dry_run'`,
    ).bind(principal.id, now, migrationId),
  ]);
  const reconciled = await migrationRow(context.env.DB, migrationId);
  if (reconciled.status !== "approved") {
    throw new ApiError(
      409,
      "storefront_experience_migration_conflict",
      "The migration successor changed concurrently.",
    );
  }
  await recordAuditOnce(context, {
    action: "themes.migration.successor.create",
    id: `audit-successor-${migrationId}`,
    metadata: { migrationId, sourceDraftId: draftId, sourceDraftVersion: expectedVersion },
    reason,
    result: "succeeded",
    targetId: successorId,
    targetType: "storefront_experience_draft",
  });
  return getStorefrontExperienceDraft(context.env.DB, successorId);
}

export async function getStorefrontExperienceSnapshot(db: D1Database, id: string) {
  const row = await db
    .prepare("SELECT * FROM storefront_experience_snapshots WHERE id = ?")
    .bind(id)
    .first<SnapshotRow>();
  if (!row) {
    throw new ApiError(
      404,
      "storefront_experience_snapshot_not_found",
      "The storefront experience snapshot was not found.",
    );
  }
  return mapSnapshot(row);
}
