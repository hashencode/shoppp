import {
  adminStorefrontThemeSchema,
  experienceResourceBindingSchema,
  experienceDraftSchema,
  experienceSnapshotSchema,
  publicContactSchema,
  storefrontLinkSchema,
  storefrontResourceReferenceSchema,
  themePackageSchema,
  type BlockDefinition,
  type CanonicalCatalogRelease,
  type CatalogReleaseV3,
  type CreateStorefrontExperienceDraftRequest,
  type CreateStorefrontExperienceSuccessorRequest,
  type ExperienceResourceBinding,
  type PageTemplate,
  type StorefrontExperienceMigrationDryRunRequest,
  type StorefrontExperienceBlockCommandRequest,
  type ThemeOverride,
  type ThemePackage,
  type ThemePackageMigrationBoundary,
  type ThemePackageRegistration,
  type UpdateStorefrontExperienceDraftRequest,
  type PublicContact,
} from "@shoppp/contracts";
import {
  findUpgradeConflicts,
  packageRegistrationSupports,
  resolveTemplateOverride,
  resolveThemePackageRegistration,
  type ThemePackageOperation,
  validateRequiredCapabilities,
  type UpgradeConflict,
} from "@shoppp/domain";
import type { Context } from "hono";

import {
  fashionStoreDirectMigrationBoundaries,
  fashionStoreFixtureBindingAliasesForPackage,
  fashionStorePackageRegistrations,
} from "../../../storefront/app/themes/fashion-store/package-registry";
import {
  fashionStoreConfigurationMigrations,
  fashionStoreLegacyClaimSettingIds,
} from "../../../storefront/app/themes/fashion-store/migrations";
import { sha256Hex } from "../orders/tokens";
import fashionStoreFixture from "../../../storefront/fixtures/experience/fashion-store.json";
import { storefrontThemeCatalog } from "../generated/storefront-theme-catalog";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent, recordAuditEvent } from "../iam/audit";
import { redactForLog } from "../security/redaction";
import { normalizeAuditReason } from "../security/audit-reason";
import { getContactSettings } from "../settings/contact-profile";
import {
  assertFashionStagingOperatorRunApprovable,
  moveFashionStagingOperatorRunToSuccessor,
} from "../testing/fashion-staging-operator";
import {
  getCanonicalDeployedCatalogRelease,
  storefrontDestinationsForRelease,
} from "./catalog-resources";
import {
  assertStorefrontThemeLifecycleWritable,
  isRetiredStorefrontThemeId,
} from "./retirement-policy";

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
  readonly blockCommandAuditId?: string;
  readonly blockCommandNow?: () => string;
  readonly migrationBoundaries?: readonly ThemePackageMigrationBoundary[];
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
  catalog_release_id: string | null;
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

interface ApprovalPreviewBuildRow {
  artifact_digest: string | null;
  artifact_prefix: string | null;
  expires_at: string | null;
  id: string;
  snapshot_json: string;
  snapshot_id: string;
  status: "building" | "deployed" | "expired" | "failed" | "pending";
}

const PLATFORM_CONTRACT_VERSION = "1.0.0";
const MAX_VALIDATION_LOOKUP_BINDINGS = 100;
const defaultPackageRegistrations = [
  ...fashionStorePackageRegistrations,
] as const satisfies readonly ThemePackageRegistration[];
const fixtureBindingsByThemeId = {
  "fashion-store": fashionStoreFixture.bindings,
} as const;

function packageRegistrations(
  options?: StorefrontExperienceServiceOptions,
): readonly ThemePackageRegistration[] {
  if (options?.packages) {
    return options.packages.map((themePackage) => ({
      lifecycle: "successor" as const,
      package: themePackage,
    }));
  }
  return defaultPackageRegistrations;
}

function migrationBoundaries(
  options?: StorefrontExperienceServiceOptions,
): readonly ThemePackageMigrationBoundary[] {
  return options?.migrationBoundaries ?? fashionStoreDirectMigrationBoundaries;
}

function configurationMigrations(
  options?: StorefrontExperienceServiceOptions,
): readonly ExperienceConfigurationMigration[] {
  return options ? (options.migrations ?? []) : fashionStoreConfigurationMigrations;
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
  options: StorefrontExperienceServiceOptions | undefined,
  operation: ThemePackageOperation,
  configurationSchemaVersion?: number,
): ThemePackage {
  if (operation !== "historicalValidation" && operation !== "immutableRead") {
    assertStorefrontThemeLifecycleWritable(themeId);
  }
  let registration: ThemePackageRegistration | undefined;
  try {
    registration = resolveThemePackageRegistration(
      packageRegistrations(options),
      themeId,
      themeVersion,
      configurationSchemaVersion,
    );
  } catch {
    throw new ApiError(
      500,
      "storefront_theme_registry_ambiguous",
      "The theme package registry contains duplicate version identities.",
    );
  }
  if (!registration) {
    throw new ApiError(
      422,
      "storefront_theme_version_invalid",
      "The selected theme package version is not available.",
    );
  }
  if (!packageRegistrationSupports(registration, operation)) {
    throw new ApiError(
      422,
      "storefront_theme_package_not_creatable",
      "The selected historical theme package cannot create or activate lifecycle state.",
    );
  }
  let found = registration.package;
  if (options?.packages) {
    const parsed = themePackageSchema.safeParse(found);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "storefront_theme_package_invalid",
        "The selected theme package is invalid.",
      );
    }
    found = parsed.data;
  }
  if (
    compareVersions(PLATFORM_CONTRACT_VERSION, found.manifest.platformCompatibility.min) < 0 ||
    compareVersions(PLATFORM_CONTRACT_VERSION, found.manifest.platformCompatibility.maxExclusive) >=
      0
  ) {
    throw new ApiError(
      422,
      "storefront_theme_incompatible",
      "The selected theme package is incompatible with this platform contract.",
    );
  }
  return found;
}

export function assertStorefrontThemePackageActivatable(
  themeId: string,
  themeVersion: string,
  configurationSchemaVersion: number,
  options?: StorefrontExperienceServiceOptions,
): void {
  packageFor(themeId, themeVersion, options, "activation", configurationSchemaVersion);
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
  catalogRelease?: CanonicalCatalogRelease | CatalogReleaseV3,
): {
  issues: ExperienceValidationIssue[];
  package: ThemePackage;
  resolvedTemplates: ThemePackage["presets"][number]["templates"];
} {
  const selectedPackage =
    overridePackage ??
    packageFor(
      row.theme_id,
      row.theme_version,
      options,
      "historicalValidation",
      row.configuration_schema_version,
    );
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
  if (
    row.theme_id === "fashion-store" &&
    row.configuration_schema_version >= 3 &&
    catalogRelease?.schemaVersion === 3 &&
    catalogRelease.identity.logoAssets.length > 0
  ) {
    for (const template of resolvedTemplates.filter(({ pageType }) => pageType === "home")) {
      const home = template.sections.find(({ id }) => id === "fashion-store-home");
      if (!home) continue;
      const selected = home.settings["identity-logo-variant"] ?? "primary";
      if (!catalogRelease.identity.logoAssets.some(({ variant }) => variant === selected)) {
        issues.push({
          code: "identity_logo_variant_missing",
          message: `Logo variant ${String(selected)} is not in the selected Catalog Release.`,
          path: `${home.id}.identity-logo-variant`,
        });
      }
    }
  }
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
  const visibleSectionIds = new Set(
    resolvedTemplates.flatMap(({ sections }) =>
      sections.filter(({ visible }) => visible).map(({ id }) => id),
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
  const fixtureInstanceIdSet = new Set(fixtureInstanceIds);
  if (fixtureInstanceIdSet.size !== fixtureInstanceIds.length) {
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
    const fixtureBindingAliases = fashionStoreFixtureBindingAliasesForPackage(selectedPackage);
    for (const instanceId of visibleSectionIds) {
      const alias = fixtureBindingAliases?.[instanceId];
      if (
        !fixtureInstanceIdSet.has(instanceId) &&
        (!alias || !fixtureInstanceIdSet.has(alias.sourceInstanceId))
      ) {
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
      input.reason ? normalizeAuditReason(input.reason) : null,
      context.get("requestId"),
      JSON.stringify(redactForLog(input.metadata ?? {})),
      new Date().toISOString(),
    )
    .run();
}

const defaultStorefrontThemes = storefrontThemeCatalog
  .filter(({ id }) => !isRetiredStorefrontThemeId(id))
  .map((descriptor) => {
    let themePackage: ThemePackage;
    try {
      themePackage = packageFor(descriptor.id, descriptor.themeVersion, undefined, "creation");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        throw new ApiError(
          500,
          "storefront_theme_catalog_drift",
          "The generated storefront theme catalog does not match the creatable package registry.",
        );
      }
      throw error;
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

export function listStorefrontThemes() {
  return defaultStorefrontThemes;
}

export async function createStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  request: CreateStorefrontExperienceDraftRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(request.reason);
  const selectedPackage = packageFor(
    request.draft.themeId,
    request.draft.themeVersion,
    options,
    "creation",
  );
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
    reason: auditReason,
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
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(request.reason);
  const current = await draftRow(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(current.theme_id);
  assertExpectedVersion(current, request.expectedVersion);
  packageFor(
    current.theme_id,
    current.theme_version,
    options,
    "mutation",
    current.configuration_schema_version,
  );
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
    reason: auditReason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  return getStorefrontExperienceDraft(context.env.DB, id);
}

function withBlockOperation(
  row: DraftRow,
  templateId: string,
  operation: ThemeOverride["operations"][number],
): ThemeOverride[] {
  const overrides = parseOverrides(row.overrides_json);
  const existing = overrides.find((candidate) => candidate.templateId === templateId);
  if (existing) {
    existing.operations.push(operation);
    return overrides;
  }
  return [
    ...overrides,
    {
      operations: [operation],
      presetId: row.preset_id,
      schemaVersion: row.configuration_schema_version,
      templateId,
    },
  ];
}

function equalConfigurationValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertBoundedBlockAssets(
  definition: BlockDefinition,
  settings: Readonly<Record<string, unknown>>,
): void {
  for (const setting of definition.settings) {
    if (setting.kind !== "asset") continue;
    const value = settings[setting.id];
    if (
      typeof value !== "object" ||
      value === null ||
      !("kind" in value) ||
      value.kind !== "theme" ||
      !setting.themeOptions?.some((option) => equalConfigurationValue(option.value, value))
    ) {
      throw new ApiError(
        422,
        "storefront_experience_block_asset_invalid",
        "Block marketing media must be a bounded Theme-owned asset.",
      );
    }
  }
}

function normalizeTemplateOverride(
  row: DraftRow,
  base: PageTemplate,
  current: PageTemplate,
): ThemeOverride | undefined {
  const operations: ThemeOverride["operations"] = [];
  const currentSectionOrder = current.sections.map(({ id }) => id);
  if (
    !equalConfigurationValue(
      currentSectionOrder,
      base.sections.map(({ id }) => id),
    )
  ) {
    operations.push({ instanceIds: currentSectionOrder, kind: "reorder-sections" });
  }
  for (const section of current.sections) {
    const baseSection = base.sections.find(({ id }) => id === section.id);
    if (!baseSection) continue;
    if (section.visible !== baseSection.visible) {
      operations.push({
        instanceId: section.id,
        kind: "set-visibility",
        visible: section.visible,
      });
    }
    for (const settingId of new Set([
      ...Object.keys(baseSection.settings),
      ...Object.keys(section.settings),
    ])) {
      if (equalConfigurationValue(section.settings[settingId], baseSection.settings[settingId])) {
        continue;
      }
      operations.push(
        section.settings[settingId] === undefined
          ? { instanceId: section.id, kind: "reset-setting", settingId }
          : {
              instanceId: section.id,
              kind: "set-setting",
              settingId,
              value: structuredClone(section.settings[settingId]),
            },
      );
    }
    const baseBlocks = new Map(baseSection.blocks.map((block) => [block.id, block]));
    const currentBlocks = new Map(section.blocks.map((block) => [block.id, block]));
    for (const baseBlock of baseSection.blocks) {
      if (!currentBlocks.has(baseBlock.id)) {
        operations.push({ instanceId: baseBlock.id, kind: "remove-block" });
      }
    }
    for (const block of section.blocks) {
      const baseBlock = baseBlocks.get(block.id);
      if (!baseBlock) {
        operations.push({
          block: structuredClone(block),
          kind: "add-block",
          sectionId: section.id,
        });
        continue;
      }
      if (block.visible !== baseBlock.visible) {
        operations.push({
          instanceId: block.id,
          kind: "set-visibility",
          visible: block.visible,
        });
      }
      for (const settingId of new Set([
        ...Object.keys(baseBlock.settings),
        ...Object.keys(block.settings),
      ])) {
        if (equalConfigurationValue(block.settings[settingId], baseBlock.settings[settingId])) {
          continue;
        }
        operations.push(
          block.settings[settingId] === undefined
            ? { instanceId: block.id, kind: "reset-setting", settingId }
            : {
                instanceId: block.id,
                kind: "set-setting",
                settingId,
                value: structuredClone(block.settings[settingId]),
              },
        );
      }
    }
    const currentBlockOrder = section.blocks.map(({ id }) => id);
    if (
      !equalConfigurationValue(
        currentBlockOrder,
        baseSection.blocks.map(({ id }) => id),
      )
    ) {
      operations.push({
        instanceIds: currentBlockOrder,
        kind: "reorder-blocks",
        sectionId: section.id,
      });
    }
  }
  return operations.length === 0
    ? undefined
    : {
        operations,
        presetId: row.preset_id,
        schemaVersion: row.configuration_schema_version,
        templateId: current.id,
      };
}

export async function applyStorefrontExperienceBlockCommand(
  context: Context<ApiEnvironment>,
  id: string,
  request: StorefrontExperienceBlockCommandRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(request.reason);
  const row = await draftRow(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(row.theme_id);
  assertExpectedVersion(row, request.expectedVersion);
  const current = resolveDraft(row, options);
  if (current.issues.length > 0) {
    throw new ApiError(
      422,
      "storefront_experience_draft_invalid",
      "Repair the current draft before editing Blocks.",
      {
        issues: current.issues,
      },
    );
  }
  const command = request.command;
  const template = current.resolvedTemplates.find(
    ({ id: templateId }) => templateId === command.templateId,
  );
  if (!template)
    throw new ApiError(
      422,
      "storefront_experience_block_template_invalid",
      "The Block command references an unknown template.",
    );
  const allBlocks = template.sections.flatMap(({ blocks }) => blocks);
  const commandBlockId = "blockId" in command ? command.blockId : undefined;
  const block = commandBlockId
    ? allBlocks.find(({ id: blockId }) => blockId === commandBlockId)
    : undefined;
  const newId = () => `block-${crypto.randomUUID()}`;
  let operation: ThemeOverride["operations"][number];
  switch (command.kind) {
    case "add": {
      const section = template.sections.find(
        ({ id: sectionId }) => sectionId === command.sectionId,
      );
      const definition = current.package.manifest.componentRegistry.blocks.find(
        ({ type }) => type === command.blockType,
      );
      if (
        !section ||
        !definition ||
        !current.package.manifest.componentRegistry.sections
          .find(({ type }) => type === section.type)
          ?.allowedBlockTypes.includes(definition.type)
      ) {
        throw new ApiError(
          422,
          "storefront_experience_block_type_invalid",
          "The Block type is not allowed in this section.",
        );
      }
      assertBoundedBlockAssets(definition, command.settings);
      operation = {
        block: {
          actions: [],
          capabilities: [...definition.capabilities],
          id: newId(),
          settings: command.settings,
          type: definition.type,
          visible: true,
        },
        kind: "add-block",
        sectionId: section.id,
      };
      break;
    }
    case "duplicate": {
      if (!block)
        throw new ApiError(
          422,
          "storefront_experience_block_not_found",
          "The Block was not found.",
        );
      const section = template.sections.find(({ blocks }) =>
        blocks.some(({ id: blockId }) => blockId === block.id),
      )!;
      operation = {
        block: { ...structuredClone(block), id: newId() },
        kind: "add-block",
        sectionId: section.id,
      };
      break;
    }
    case "remove":
      if (!block)
        throw new ApiError(
          422,
          "storefront_experience_block_not_found",
          "The Block was not found.",
        );
      operation = { instanceId: block.id, kind: "remove-block" };
      break;
    case "reorder":
      operation = {
        instanceIds: command.blockIds,
        kind: "reorder-blocks",
        sectionId: command.sectionId,
      };
      break;
    case "set-visibility":
      if (!block)
        throw new ApiError(
          422,
          "storefront_experience_block_not_found",
          "The Block was not found.",
        );
      operation = { instanceId: block.id, kind: "set-visibility", visible: command.visible };
      break;
    case "set-setting":
      if (!block)
        throw new ApiError(
          422,
          "storefront_experience_block_not_found",
          "The Block was not found.",
        );
      {
        const definition = current.package.manifest.componentRegistry.blocks.find(
          ({ type }) => type === block.type,
        )!;
        const setting = definition.settings.find(
          ({ id: settingId }) => settingId === command.settingId,
        );
        if (setting?.kind === "asset") {
          assertBoundedBlockAssets(definition, {
            ...block.settings,
            [command.settingId]: command.value,
          });
        }
      }
      operation = {
        instanceId: block.id,
        kind: "set-setting",
        settingId: command.settingId,
        value: command.value,
      };
      break;
  }
  const pendingOverrides = withBlockOperation(row, command.templateId, operation);
  const catalogRelease = request.catalogReleaseId
    ? await getCanonicalDeployedCatalogRelease(context.env.DB, request.catalogReleaseId, {
        allowPrivateCandidate: true,
        environment: context.env.ENVIRONMENT,
        principalKind: context.get("principal").principalKind,
      })
    : undefined;
  const resolution = resolveDraft(row, options, undefined, pendingOverrides, catalogRelease);
  if (resolution.issues.length > 0) {
    throw new ApiError(
      422,
      "storefront_experience_block_command_invalid",
      "The Block command would create an invalid draft.",
      {
        issues: resolution.issues,
      },
    );
  }
  const preset = resolution.package.presets.find(({ id: presetId }) => presetId === row.preset_id)!;
  const resolvedTemplate = resolution.resolvedTemplates.find(
    ({ id: templateId }) => templateId === command.templateId,
  )!;
  const baseTemplate = preset.templates.find(
    ({ id: templateId }) => templateId === command.templateId,
  )!;
  const normalizedTarget = normalizeTemplateOverride(row, baseTemplate, resolvedTemplate);
  const overrides = [
    ...pendingOverrides.filter(({ templateId }) => templateId !== command.templateId),
    ...(normalizedTarget ? [normalizedTarget] : []),
  ];
  const nextBindings =
    command.kind === "remove"
      ? parseBindings(row.bindings_json).filter(({ instanceId }) => instanceId !== command.blockId)
      : parseBindings(row.bindings_json);
  try {
    experienceDraftSchema.parse({
      bindings: nextBindings,
      experienceId: row.experience_id,
      id: row.id,
      overrides,
      themeId: row.theme_id,
      themeVersion: row.theme_version,
      version: row.version + 1,
    });
  } catch {
    throw new ApiError(
      422,
      "storefront_experience_block_command_unbounded",
      "The normalized Block command exceeds the supported draft bounds.",
    );
  }
  const now = options?.blockCommandNow?.() ?? new Date().toISOString();
  const principal = context.get("principal");
  const writeCondition = {
    bindings: [],
    // D1 executes batch statements sequentially in one transaction. `changes()` therefore
    // identifies whether this batch's immediately preceding CAS UPDATE won, rather than
    // matching mutable row values that another same-principal writer may have produced.
    sql: "SELECT 1 WHERE changes() = 1",
  } as const;
  const [updated, audited] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE storefront_experience_drafts SET bindings_json = ?, overrides_json = ?, version = version + 1,
       updated_by = ?, updated_at = ? WHERE id = ? AND version = ?`,
    ).bind(
      JSON.stringify(nextBindings),
      JSON.stringify(overrides),
      principal.id,
      now,
      id,
      request.expectedVersion,
    ),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: `themes.block.${command.kind}`,
        actorId: principal.id,
        actorType: "admin",
        id: options?.blockCommandAuditId ?? crypto.randomUUID(),
        metadata: { fromVersion: request.expectedVersion, toVersion: request.expectedVersion + 1 },
        reason: auditReason,
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "storefront_experience_draft",
      },
      writeCondition,
    ),
  ]);
  if (updated?.meta.changes !== 1) throw conflictError();
  if (audited?.meta.changes !== 1) throw conflictError();
  return getStorefrontExperienceDraft(context.env.DB, id);
}

export async function createStorefrontExperienceSuccessor(
  context: Context<ApiEnvironment>,
  sourceId: string,
  request: CreateStorefrontExperienceSuccessorRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(request.reason);
  const source = await draftRow(context.env.DB, sourceId);
  packageFor(
    source.theme_id,
    source.theme_version,
    options,
    "creation",
    source.configuration_schema_version,
  );
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
  const principal = context.get("principal");
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
    reason: auditReason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_experience_draft",
  });
  await moveFashionStagingOperatorRunToSuccessor(context.env.DB, sourceId, id);
  return getStorefrontExperienceDraft(context.env.DB, id);
}

export async function validateStorefrontExperienceDraft(
  context: Context<ApiEnvironment>,
  id: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string,
  options?: StorefrontExperienceServiceOptions,
) {
  const row = await draftRow(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(row.theme_id);
  assertExpectedVersion(row, expectedVersion);
  const auditReason = reason ? normalizeAuditReason(reason) : "";
  const catalogRelease = catalogReleaseId
    ? await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId, {
        allowPrivateCandidate: true,
        environment: context.env.ENVIRONMENT,
        principalKind: context.get("principal").principalKind,
      })
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
    reason: auditReason,
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
  allowPrivateCandidate = false,
) {
  const row = await draftRow(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(row.theme_id);
  assertExpectedVersion(row, expectedVersion);
  packageFor(
    row.theme_id,
    row.theme_version,
    options,
    "activation",
    row.configuration_schema_version,
  );
  const validation = await validationRow(context.env.DB, id, expectedVersion, catalogReleaseId);
  if (!validation || validation.status !== "valid") {
    throw new ApiError(
      409,
      "storefront_experience_validation_stale",
      "Validate the current draft version before creating a snapshot.",
    );
  }
  const catalogRelease = catalogReleaseId
    ? await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId, {
        allowPrivateCandidate,
        environment: context.env.ENVIRONMENT,
        principalKind: context.get("principal").principalKind,
      })
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

async function frozenContact(context: Context<ApiEnvironment>) {
  const settings = await getContactSettings(context);
  const publicContact: PublicContact = publicContactSchema.parse(settings.publicContact);
  const version = await sha256Hex(
    canonicalJson({
      profileVersion: settings.profileVersion,
      publicContact,
    }),
  );
  return { publicContact, version };
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

async function requiredApprovalPreviewBuild(
  db: D1Database,
  draftId: string,
  draftVersion: number,
  contactVersion: string,
  catalogReleaseId?: string,
): Promise<ApprovalPreviewBuildRow> {
  const row = await db
    .prepare(
      `SELECT b.id, b.snapshot_id, b.status, b.artifact_digest, b.artifact_prefix, b.expires_at,
              s.snapshot_json
         FROM storefront_preview_builds b
         JOIN storefront_experience_snapshots s ON s.id = b.snapshot_id
         JOIN storefront_experience_validations v ON v.id = s.source_validation_id
        WHERE s.source_draft_id = ?
          AND s.source_draft_version = ?
          AND s.kind = 'preview'
          AND b.catalog_release_id IS ?
          AND v.catalog_release_id IS ?
        ORDER BY b.attempt DESC, b.created_at DESC
        LIMIT 1`,
    )
    .bind(draftId, draftVersion, catalogReleaseId ?? null, catalogReleaseId ?? null)
    .first<ApprovalPreviewBuildRow>();
  if (!row) {
    throw new ApiError(
      409,
      "storefront_preview_build_required",
      "Create and successfully deploy the exact Preview before approval.",
    );
  }
  if (
    row.status !== "deployed" ||
    !row.artifact_digest ||
    !row.artifact_prefix ||
    !row.expires_at ||
    Date.parse(row.expires_at) <= Date.now()
  ) {
    throw new ApiError(
      409,
      "storefront_preview_build_not_deployed",
      "The exact Preview build must have a current deployed artifact before approval.",
    );
  }
  const previewSnapshot = experienceSnapshotSchema.parse(JSON.parse(row.snapshot_json));
  if (previewSnapshot.contact?.version !== contactVersion) {
    throw new ApiError(
      409,
      "storefront_preview_contact_changed",
      "Public Contact changed after this Preview was built. Create and deploy a new exact Preview before approval.",
    );
  }
  return row;
}

async function approvalRequiresPrivatePreviewBuild(
  db: D1Database,
  catalogReleaseId?: string,
): Promise<boolean> {
  if (!catalogReleaseId) return false;
  const release = await db
    .prepare("SELECT purpose FROM catalog_releases WHERE id = ?")
    .bind(catalogReleaseId)
    .first<{ purpose: string | null }>();
  return release?.purpose === "private-preview";
}

async function insertSnapshot(
  context: Context<ApiEnvironment>,
  input: {
    deduplicationKey: string;
    contact: Awaited<ReturnType<typeof frozenContact>>;
    kind: "approved" | "preview";
    migrationId?: string;
    package: ThemePackage;
    reason: string;
    resolvedTemplates: ThemePackage["presets"][number]["templates"];
    row: DraftRow;
    validation: ValidationRow;
    operatorApproval?: {
      auditId: string;
      approvedAt: string;
      runId: string;
    };
    previewBuild?: ApprovalPreviewBuildRow;
  },
) {
  const principal = context.get("principal");
  const now = input.operatorApproval?.approvedAt ?? new Date().toISOString();
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
    contact: input.contact,
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
  const operatorCondition = input.operatorApproval
    ? `WHERE EXISTS (
         SELECT 1 FROM fashion_staging_operator_runs
          WHERE run_id = ? AND working_draft_id = ? AND status = 'awaiting_operator'
            AND expires_at > ? AND catalog_release_id = ?
       )`
    : "";
  const operatorBindings = input.operatorApproval
    ? [input.operatorApproval.runId, input.row.id, now, input.validation.catalog_release_id]
    : [];
  const snapshotInsert = context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_experience_snapshots
       (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
        source_validation_id, migration_id, kind, theme_id, theme_version,
        configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
        approved_at, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     ${operatorCondition}`,
  ).bind(
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
    ...operatorBindings,
  );
  const snapshotAudit = context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, actor_id, action, target_type, target_id, result, reason,
        request_id, metadata_json, created_at)
     SELECT ?, 'admin', ?, ?, 'storefront_experience_snapshot', ?, 'succeeded', ?, ?, ?, ?
     ${operatorCondition}`,
  ).bind(
    `audit-${id}`,
    principal.id,
    input.kind === "approved" ? "themes.experience.approve" : "themes.preview.snapshot.create",
    id,
    input.reason ? normalizeAuditReason(input.reason) : null,
    context.get("requestId"),
    JSON.stringify(
      redactForLog({
        catalogReleaseId: input.validation.catalog_release_id,
        draftId: input.row.id,
        draftVersion: input.row.version,
        previewArtifactDigest: input.previewBuild?.artifact_digest,
        previewArtifactPrefix: input.previewBuild?.artifact_prefix,
        previewBuildId: input.previewBuild?.id,
        previewSnapshotId: input.previewBuild?.snapshot_id,
        themeVersion: input.package.manifest.themeVersion,
      }),
    ),
    now,
    ...operatorBindings,
  );
  const statements: D1PreparedStatement[] = [snapshotInsert, snapshotAudit];
  if (input.operatorApproval) {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO audit_events
           (id, actor_type, actor_id, action, target_type, target_id, result, reason,
            request_id, metadata_json, created_at)
         SELECT ?, 'admin', ?, 'themes.fashion-staging.operator.approve',
                'fashion_staging_operator_run', ?, 'succeeded', ?, ?, ?, ?
         ${operatorCondition}`,
      ).bind(
        input.operatorApproval.auditId,
        principal.id,
        input.operatorApproval.runId,
        input.reason ? normalizeAuditReason(input.reason) : null,
        context.get("requestId"),
        JSON.stringify(
          redactForLog({
            catalogReleaseId: input.validation.catalog_release_id,
            draftId: input.row.id,
            draftVersion: input.row.version,
            snapshotContentDigest: contentDigest,
            snapshotId: id,
          }),
        ),
        now,
        ...operatorBindings,
      ),
      context.env.DB.prepare(
        `UPDATE fashion_staging_operator_runs
            SET status = 'approved', successor_snapshot_id = ?, successor_content_digest = ?,
                approval_audit_id = ?, operator_identity_id = ?, approved_at = ?, updated_at = ?
          WHERE run_id = ? AND working_draft_id = ? AND status = 'awaiting_operator'
            AND expires_at > ? AND catalog_release_id = ?`,
      ).bind(
        id,
        contentDigest,
        input.operatorApproval.auditId,
        principal.id,
        now,
        now,
        input.operatorApproval.runId,
        input.row.id,
        now,
        input.validation.catalog_release_id,
      ),
    );
  }
  const results = await context.env.DB.batch(statements);
  if (input.operatorApproval && results.at(-1)?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "fashion_u8_operator_run_conflict",
      "Operator run changed before approval evidence could be committed.",
    );
  }
  const persisted = await existingSnapshot(context.env.DB, input.deduplicationKey);
  if (!persisted) {
    throw new ApiError(
      409,
      "storefront_experience_snapshot_conflict",
      "The immutable storefront experience snapshot could not be reconciled.",
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
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(reason);
  const resolution = await validResolution(
    context,
    id,
    expectedVersion,
    catalogReleaseId,
    options,
    true,
  );
  const contact = await frozenContact(context);
  return insertSnapshot(context, {
    contact,
    deduplicationKey: `${id}:${expectedVersion}:${catalogReleaseId ?? "fixture-preview"}:preview:contact:${contact.version}`,
    kind: "preview",
    package: resolution.package,
    reason: auditReason,
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
  options?: StorefrontExperienceServiceOptions,
) {
  const auditReason = normalizeAuditReason(reason);
  const operatorApprovalTime = new Date();
  const operatorRun = await assertFashionStagingOperatorRunApprovable(
    context.env.DB,
    id,
    operatorApprovalTime,
  );
  if (operatorRun && catalogReleaseId !== operatorRun.catalogReleaseId) {
    throw new ApiError(
      409,
      "fashion_u8_operator_catalog_release_mismatch",
      "The approval must use the Catalog Release frozen by the Fashion U8 operator run.",
    );
  }
  const resolution = await validResolution(
    context,
    id,
    expectedVersion,
    catalogReleaseId,
    options,
    true,
  );
  const contact = operatorRun?.status === "approved" ? null : await frozenContact(context);
  const previewBuild =
    contact && (await approvalRequiresPrivatePreviewBuild(context.env.DB, catalogReleaseId))
      ? await requiredApprovalPreviewBuild(
          context.env.DB,
          id,
          expectedVersion,
          contact.version,
          catalogReleaseId,
        )
      : undefined;
  const deduplicationKey = contact
    ? `${id}:${expectedVersion}:${catalogReleaseId ?? "fixture-preview"}:approved:${resolution.package.manifest.themeVersion}:${resolution.package.manifest.configurationSchemaVersion}:contact:${contact.version}`
    : null;
  const expectedSnapshotId =
    operatorRun?.status === "approved"
      ? operatorRun.successorSnapshotId
      : await snapshotId(deduplicationKey!, "approved");
  if (!expectedSnapshotId) {
    throw new ApiError(
      409,
      "fashion_u8_operator_approval_conflict",
      "The approved Fashion U8 operator run has no successor snapshot.",
    );
  }
  const expectedOperatorAuditId = operatorRun
    ? `audit-fashion-u8-${(await sha256Hex(operatorRun.runId)).slice(0, 32)}`
    : null;
  if (operatorRun?.status === "approved") {
    const existing = await getStorefrontExperienceSnapshot(context.env.DB, expectedSnapshotId);
    const audit = expectedOperatorAuditId
      ? await context.env.DB.prepare(
          `SELECT actor_id, action, target_id, target_type, metadata_json, created_at
               FROM audit_events WHERE id = ?`,
        )
          .bind(expectedOperatorAuditId)
          .first<{
            action: string;
            actor_id: string | null;
            created_at: string;
            metadata_json: string;
            target_id: string | null;
            target_type: string;
          }>()
      : null;
    const auditMetadata = audit
      ? (JSON.parse(audit.metadata_json) as Record<string, unknown>)
      : null;
    if (
      operatorRun.successorSnapshotId !== expectedSnapshotId ||
      operatorRun.approvalAuditId !== expectedOperatorAuditId ||
      operatorRun.operatorIdentityId !== context.get("principal").id ||
      operatorRun.successorContentDigest !== existing.contentDigest ||
      existing.sourceDraftId !== id ||
      existing.sourceDraftVersion !== expectedVersion ||
      audit?.actor_id !== context.get("principal").id ||
      audit?.action !== "themes.fashion-staging.operator.approve" ||
      audit?.target_type !== "fashion_staging_operator_run" ||
      audit?.target_id !== operatorRun.runId ||
      audit?.created_at !== operatorRun.approvedAt ||
      auditMetadata?.snapshotId !== expectedSnapshotId ||
      auditMetadata?.snapshotContentDigest !== existing.contentDigest ||
      auditMetadata?.catalogReleaseId !== operatorRun.catalogReleaseId
    ) {
      throw new ApiError(
        409,
        "fashion_u8_operator_approval_conflict",
        "The existing Fashion U8 operator approval does not match this request.",
      );
    }
    return existing;
  }
  const snapshot = await insertSnapshot(context, {
    contact: contact!,
    deduplicationKey: deduplicationKey!,
    kind: "approved",
    package: resolution.package,
    reason: auditReason,
    resolvedTemplates: resolution.resolvedTemplates,
    row: resolution.row,
    validation: resolution.validation,
    ...(previewBuild ? { previewBuild } : {}),
    ...(operatorRun && expectedOperatorAuditId
      ? {
          operatorApproval: {
            approvedAt: operatorApprovalTime.toISOString(),
            auditId: expectedOperatorAuditId,
            runId: operatorRun.runId,
          },
        }
      : {}),
  });
  return snapshot;
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
  const migration = configurationMigrations(options).find(
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

function canonicalClaimValues(
  settingId: string,
  release: CanonicalCatalogRelease | CatalogReleaseV3,
  contact: PublicContact,
): unknown[] | undefined {
  if (settingId === "header-contact-copy" || settingId === "footer-contact-copy") {
    return [
      contact.supportEmail,
      contact.privacyEmail,
      contact.publicPhone,
      contact.serviceHours?.kind === "legacy" ? contact.serviceHours.text : null,
      ...contact.locations.flatMap(({ address, email, phone }) => [address, email, phone]),
    ].filter((value) => value !== null);
  }
  if (settingId === "header-social-link" || settingId === "footer-social-link") {
    return contact.socials.filter(({ visible }) => visible).map(({ url }) => url);
  }
  if (settingId === "header-logo" || settingId === "footer-logo") {
    return release.schemaVersion === 3
      ? release.identity.logoAssets.flatMap(({ assetId, media }) => [
          assetId,
          ...(media ? [media.src] : []),
        ])
      : undefined;
  }
  if (settingId === "delivery-summary") {
    return release.schemaVersion === 3 && release.commerce?.shippingMethods.length
      ? ["Shipping options are confirmed for your destination at checkout."]
      : undefined;
  }
  if (settingId === "shipping-returns-summary") {
    const shipping = release.policies.find(
      ({ kind, slug }) => kind === "shipping" || (!kind && slug === "shipping"),
    );
    const returns = release.policies.find(
      ({ kind, slug }) => kind === "returns" || (!kind && slug === "returns"),
    );
    return shipping && returns ? [`See ${shipping.title} and ${returns.title}.`] : undefined;
  }
  if (settingId.startsWith("payment-brand-")) {
    if (release.schemaVersion !== 3 || !release.commerce) return undefined;
    const brand = settingId.slice("payment-brand-".length);
    return [
      release.commerce.payment.enabled && release.commerce.payment.brands.includes(brand as never),
    ];
  }
  return undefined;
}

function operationMatchesCanonical(value: unknown, candidates: readonly unknown[]): boolean {
  const comparable =
    value && typeof value === "object"
      ? "url" in value && typeof value.url === "string"
        ? value.url
        : "path" in value && typeof value.path === "string"
          ? value.path
          : "target" in value &&
              value.target &&
              typeof value.target === "object" &&
              "url" in value.target &&
              typeof value.target.url === "string"
            ? value.target.url
            : value
      : value;
  return candidates.some((candidate) => canonicalJson(candidate) === canonicalJson(comparable));
}

function sourcePresetDefault(
  sourcePackage: ThemePackage,
  presetId: string,
  templateId: string,
  instanceId: string,
  settingId: string,
): unknown {
  const template = sourcePackage.presets
    .find(({ id }) => id === presetId)
    ?.templates.find(({ id }) => id === templateId);
  const instance = template?.sections
    .flatMap((section) => [section, ...section.blocks])
    .find(({ id }) => id === instanceId);
  if (!instance) return undefined;
  if (Object.prototype.hasOwnProperty.call(instance.settings, settingId)) {
    return instance.settings[settingId];
  }
  const definition = [
    ...sourcePackage.manifest.componentRegistry.sections,
    ...sourcePackage.manifest.componentRegistry.blocks,
  ]
    .find(({ type }) => type === instance.type)
    ?.settings.find(({ id }) => id === settingId);
  return definition && "default" in definition ? definition.default : undefined;
}

function canonicalClaimConflicts(
  row: DraftRow,
  sourcePackage: ThemePackage,
  release: CanonicalCatalogRelease | CatalogReleaseV3,
  contact: PublicContact,
): UpgradeConflict[] {
  if (row.theme_id !== "fashion-store") return [];
  return parseOverrides(row.overrides_json).flatMap((override) =>
    override.operations.flatMap((operation, operationIndex) => {
      if (
        (operation.kind !== "set-setting" && operation.kind !== "reset-setting") ||
        !fashionStoreLegacyClaimSettingIds.has(operation.settingId)
      ) {
        return [];
      }
      const candidates = canonicalClaimValues(operation.settingId, release, contact);
      const effectiveValue =
        operation.kind === "reset-setting"
          ? sourcePresetDefault(
              sourcePackage,
              row.preset_id,
              override.templateId,
              operation.instanceId,
              operation.settingId,
            )
          : operation.value;
      const matches =
        effectiveValue !== undefined &&
        candidates !== undefined &&
        operationMatchesCanonical(effectiveValue, candidates);
      if (matches) return [];
      return [
        {
          code: candidates
            ? ("canonical-claim-conflict" as const)
            : ("canonical-claim-unverified" as const),
          instanceId: operation.instanceId,
          operationIndex,
          settingId: operation.settingId,
        },
      ];
    }),
  );
}

export async function dryRunStorefrontExperienceMigration(
  context: Context<ApiEnvironment>,
  id: string,
  request: StorefrontExperienceMigrationDryRunRequest,
  options?: StorefrontExperienceServiceOptions,
) {
  const row = await draftRow(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(row.theme_id);
  assertExpectedVersion(row, request.expectedVersion);
  const auditReason = request.reason ? normalizeAuditReason(request.reason) : "";
  const sourcePackage = packageFor(
    row.theme_id,
    row.theme_version,
    options,
    "migrationSource",
    row.configuration_schema_version,
  );
  const targetPackage = packageFor(
    row.theme_id,
    request.targetThemeVersion,
    options,
    "activation",
    request.targetConfigurationSchemaVersion,
  );
  if (
    targetPackage.manifest.configurationSchemaVersion !== request.targetConfigurationSchemaVersion
  ) {
    throw new ApiError(
      422,
      "storefront_experience_migration_target_invalid",
      "The target package and configuration schema versions do not match.",
    );
  }
  const directBoundary = migrationBoundaries(options).some(
    ({ source, target, themeId }) =>
      themeId === row.theme_id &&
      source.themeVersion === row.theme_version &&
      source.configurationSchemaVersion === row.configuration_schema_version &&
      target.themeVersion === request.targetThemeVersion &&
      target.configurationSchemaVersion === request.targetConfigurationSchemaVersion,
  );
  if (!directBoundary) {
    throw new ApiError(
      422,
      "storefront_experience_migration_boundary_invalid",
      "The exact source and target package versions are not a declared direct migration boundary.",
    );
  }
  const overrides = migratedOverrides(row, targetPackage, options);
  const sourcePreset = sourcePackage.presets.find(({ id: presetId }) => presetId === row.preset_id);
  const targetPreset = targetPackage.presets.find(({ id: presetId }) => presetId === row.preset_id);
  const conflicts: UpgradeConflict[] = [];
  if (targetPackage.manifest.configurationSchemaVersion === 3) {
    if (!request.catalogReleaseId) {
      throw new ApiError(
        422,
        "storefront_experience_migration_release_required",
        "Select a Catalog Release before migrating canonical claims.",
      );
    }
    const [release, contact] = await Promise.all([
      getCanonicalDeployedCatalogRelease(context.env.DB, request.catalogReleaseId, {
        allowPrivateCandidate: true,
        environment: context.env.ENVIRONMENT,
        principalKind: context.get("principal").principalKind,
      }),
      frozenContact(context),
    ]);
    if (release.schemaVersion !== 3) {
      throw new ApiError(
        422,
        "storefront_experience_migration_release_invalid",
        "Canonical claim migration requires a schema-v3 Catalog Release.",
      );
    }
    conflicts.push(...canonicalClaimConflicts(row, sourcePackage, release, contact.publicContact));
  }
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
  const key = `${id}:${row.version}:${request.targetThemeVersion}:${request.targetConfigurationSchemaVersion}:${request.catalogReleaseId ?? "legacy"}`;
  const migrationId = `migration-${(await sha256Hex(key)).slice(0, 32)}`;
  const principal = context.get("principal");
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_experience_migrations
       (id, draft_id, draft_version, catalog_release_id, source_theme_version,
        source_configuration_schema_version, target_theme_version,
        target_configuration_schema_version, migrated_overrides_json, conflicts_json,
        status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dry_run', ?, ?)`,
  )
    .bind(
      migrationId,
      id,
      row.version,
      request.catalogReleaseId ?? null,
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
    reason: auditReason,
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
  const auditReason = normalizeAuditReason(reason);
  const draft = await draftRow(context.env.DB, draftId);
  assertStorefrontThemeLifecycleWritable(draft.theme_id);
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
  const validation = await validationRow(
    context.env.DB,
    draftId,
    expectedVersion,
    migration.catalog_release_id ?? undefined,
  );
  if (!validation || validation.status !== "valid") {
    throw new ApiError(
      409,
      "storefront_experience_validation_stale",
      "Validate the current draft before approving its migration.",
    );
  }
  const targetPackage = packageFor(
    draft.theme_id,
    migration.target_theme_version,
    options,
    "activation",
    migration.target_configuration_schema_version,
  );
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
    reason: auditReason,
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
