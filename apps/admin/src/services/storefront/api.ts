import type {
  AdminStorefrontTheme,
  ExperienceResourceBinding,
  ThemeOverride,
} from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'

export type StorefrontExperienceValidation = {
  catalogReleaseId: string | null
  createdAt: string
  draftVersion: number
  id: string
  issues: Array<{
    code: string
    instanceId?: string
    message: string
    path?: string
    templateId?: string
  }>
  status: 'invalid' | 'valid'
  validatedBy: string
}

export type StorefrontExperienceDraft = {
  bindings: ExperienceResourceBinding[]
  configurationSchemaVersion: number
  createdAt: string
  createdBy: string
  experienceId: string
  id: string
  overrides: ThemeOverride[]
  presetId: string
  themeId: string
  themeVersion: string
  updatedAt: string
  updatedBy: string
  validation: StorefrontExperienceValidation | null
  validations: StorefrontExperienceValidation[]
  version: number
}

export type StorefrontExperienceSnapshot = {
  approvedAt: string | null
  approvedBy: string | null
  configurationSchemaVersion: number
  contentDigest: string
  createdAt: string
  createdBy: string
  experienceId: string
  id: string
  kind: 'approved' | 'preview'
  sourceDraftId: string
  sourceDraftVersion: number
  sourceValidationId: string
  themeId: string
  themeVersion: string
}

export type FashionStagingOperatorRun = {
  allowedAction: 'complete_run_bound_editor_path' | null
  approvalAuditId: string | null
  approvedAt: string | null
  candidateSha: string
  catalogReleaseId: string
  consumedAt: string | null
  expiresAt: string
  runId: string
  sourceDraftId: string
  status: 'approved' | 'awaiting_operator' | 'canceled' | 'consumed' | 'expired' | 'rejected'
  successorSnapshotId: string | null
  u12SnapshotId: string
  workingDraftId: string
}

export type StorefrontPreviewBuild = {
  artifactDigest: string | null
  artifactPrefix: string | null
  attempt: number
  cleanedAt: string | null
  completedAt: string | null
  correlationId: string | null
  createdAt: string
  expiresAt: string | null
  failureCode: string | null
  id: string
  snapshotId: string
  inputIdentity?: {
    catalogReleaseId: string
    experienceSnapshotId: string
    experienceVersion: number
    platformContractVersion: string
    themeId: string
    themeVersion: string
  } | null
  status: 'building' | 'deployed' | 'expired' | 'failed' | 'pending'
  updatedAt: string
}

export type StorefrontCatalogRelease = {
  approvedAt: string
  collections: Array<{ id: string; kind: 'collection'; name: string; slug: string }>
  destinations?: Array<{
    id: string
    kind: 'article' | 'page' | 'policy'
    name: string
    path: string
  }>
  deployedAt: string | null
  environment: 'development' | 'staging' | 'production'
  id: string
  products: Array<{ id: string; kind: 'product'; name: string; slug: string }>
  status: 'deployed'
}

export type StorefrontCatalogMedia = {
  alt: string
  height: number
  key: string
  kind: 'catalog'
  productName: string
  src: string
  width: number
}

export type StorefrontCatalogResource = {
  id: string
  kind: 'article' | 'collection' | 'page' | 'policy' | 'product'
  name: string
  path: string
}

export type StorefrontPreviewResolution = {
  build: StorefrontPreviewBuild
  snapshot: StorefrontExperienceSnapshot
}

export type StorefrontExperienceMigration = {
  approvedAt: string | null
  approvedBy: string | null
  conflicts: Array<{
    code: string
    instanceId?: string
    message?: string
    templateId?: string
    settingId?: string
    operationIndex?: number
  }>
  createdAt: string
  createdBy: string
  draftId: string
  draftVersion: number
  id: string
  sourceConfigurationSchemaVersion: number
  sourceThemeVersion: string
  status: 'approved' | 'dry_run'
  targetConfigurationSchemaVersion: number
  targetThemeVersion: string
}

const idempotencyKey = (operation: string) =>
  `${operation}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`

export const storefrontPreviewOrigin = (): string | null => {
  const configured = import.meta.env.PUBLIC_PREVIEW_ORIGIN?.trim().replace(/\/$/, '')
  if (!configured) return null
  try {
    const parsed = new URL(configured)
    return parsed.protocol === 'https:' && parsed.origin === configured ? configured : null
  } catch {
    return null
  }
}

export const fetchStorefrontThemes = async (): Promise<AdminStorefrontTheme[]> => {
  const response = await apiClient.get<{ data: AdminStorefrontTheme[] }>(
    '/admin/storefront-experiences/themes'
  )
  return response.data.data
}

export const fetchStorefrontCatalogReleases = async (): Promise<StorefrontCatalogRelease[]> => {
  const response = await apiClient.get<{ data: StorefrontCatalogRelease[] }>(
    '/admin/storefront-experiences/catalog-releases'
  )
  return response.data.data
}

export const fetchStorefrontCatalogResources = async (input: {
  kind: StorefrontCatalogResource['kind']
  page: number
  pageSize: number
  query: string
  releaseId: string
}): Promise<{
  data: StorefrontCatalogResource[]
  page: number
  pageSize: number
  total: number
}> => {
  const response = await apiClient.get<{
    data: StorefrontCatalogResource[]
    page: number
    pageSize: number
    total: number
  }>(`/admin/storefront-experiences/catalog-releases/${input.releaseId}/resources`, {
    params: {
      kind: input.kind,
      page: input.page,
      pageSize: input.pageSize,
      query: input.query || undefined,
    },
  })
  return response.data
}

export const fetchStorefrontCatalogMedia = async (
  input: { page?: number; pageSize?: number; query?: string } = {}
): Promise<{ data: StorefrontCatalogMedia[]; page: number; pageSize: number; total: number }> => {
  const response = await apiClient.get<{
    data: StorefrontCatalogMedia[]
    meta?: { page?: number; pageSize?: number; total?: number }
  }>('/admin/storefront-experiences/media', { params: input })
  return {
    data: response.data.data,
    page: response.data.meta?.page ?? input.page ?? 1,
    pageSize: response.data.meta?.pageSize ?? input.pageSize ?? response.data.data.length,
    total: response.data.meta?.total ?? response.data.data.length,
  }
}

export const fetchStorefrontExperienceDrafts = async (): Promise<StorefrontExperienceDraft[]> => {
  const response = await apiClient.get<{ data: StorefrontExperienceDraft[] }>(
    '/admin/storefront-experiences/drafts'
  )
  return response.data.data
}

export const fetchStorefrontExperienceDraft = async (
  id: string
): Promise<StorefrontExperienceDraft> => {
  const response = await apiClient.get<{ data: StorefrontExperienceDraft }>(
    `/admin/storefront-experiences/drafts/${id}`
  )
  return response.data.data
}

export const fetchFashionStagingOperatorRun = async (
  draftId: string
): Promise<FashionStagingOperatorRun | null> => {
  const response = await apiClient.get<{ data: FashionStagingOperatorRun | null }>(
    `/admin/storefront-experiences/drafts/${draftId}/operator-run`
  )
  return response.data.data
}

export const fetchStorefrontPreviewContext = async (
  draftId: string,
  draftVersion: number,
  catalogReleaseId?: string
): Promise<StorefrontPreviewResolution | null> => {
  const response = await apiClient.get<{ data: StorefrontPreviewResolution | null }>(
    `/admin/storefront-experiences/drafts/${draftId}/preview-context`,
    { params: { catalogReleaseId, draftVersion } }
  )
  return response.data.data
}

export const createStorefrontExperienceDraft = async (
  theme: AdminStorefrontTheme,
  presetId: string,
  reason: string
): Promise<StorefrontExperienceDraft> => {
  const response = await apiClient.post<{ data: StorefrontExperienceDraft }>(
    '/admin/storefront-experiences/drafts',
    {
      draft: {
        bindings: theme.fixtureBindings,
        experienceId: `storefront-${theme.id}`,
        overrides: [],
        presetId,
        themeId: theme.id,
        themeVersion: theme.themeVersion,
      },
      reason,
    },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-draft-create') } }
  )
  return response.data.data
}

export const updateStorefrontExperienceDraft = async (
  draft: StorefrontExperienceDraft,
  overrides: ThemeOverride[],
  reason: string,
  bindings: ExperienceResourceBinding[] = draft.bindings
): Promise<StorefrontExperienceDraft> => {
  const response = await apiClient.put<{ data: StorefrontExperienceDraft }>(
    `/admin/storefront-experiences/drafts/${draft.id}`,
    {
      bindings,
      expectedVersion: draft.version,
      overrides,
      reason,
    },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-draft-update') } }
  )
  return response.data.data
}

export const createStorefrontExperienceSuccessor = async (
  draft: StorefrontExperienceDraft,
  overrides: ThemeOverride[],
  reason: string,
  bindings: ExperienceResourceBinding[]
): Promise<StorefrontExperienceDraft> => {
  const response = await apiClient.post<{ data: StorefrontExperienceDraft }>(
    `/admin/storefront-experiences/drafts/${draft.id}/successors`,
    {
      bindings,
      overrides,
      reason,
      sourceVersion: draft.version,
    },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-draft-successor') } }
  )
  return response.data.data
}

export const validateStorefrontExperienceDraft = async (
  draftId: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string
): Promise<StorefrontExperienceValidation> => {
  const response = await apiClient.post<{ data: StorefrontExperienceValidation }>(
    `/admin/storefront-experiences/drafts/${draftId}/validate`,
    { catalogReleaseId, expectedVersion, reason },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-draft-validate') } }
  )
  return response.data.data
}

export const previewStorefrontExperienceDraft = async (
  draftId: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string
): Promise<StorefrontPreviewResolution> => {
  const response = await apiClient.post<{ data: StorefrontPreviewResolution }>(
    `/admin/storefront-experiences/drafts/${draftId}/preview`,
    { catalogReleaseId, expectedVersion, reason },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-preview-create') } }
  )
  return response.data.data
}

export const fetchStorefrontPreviewBuild = async (
  buildId: string
): Promise<StorefrontPreviewBuild> => {
  const response = await apiClient.get<{ data: StorefrontPreviewBuild }>(
    `/admin/storefront-experiences/builds/${buildId}`
  )
  return response.data.data
}

export const approveStorefrontExperienceDraft = async (
  draftId: string,
  expectedVersion: number,
  reason: string,
  catalogReleaseId?: string
): Promise<StorefrontExperienceSnapshot> => {
  const response = await apiClient.post<{ data: StorefrontExperienceSnapshot }>(
    `/admin/storefront-experiences/drafts/${draftId}/approve`,
    { catalogReleaseId, confirm: true, expectedVersion, reason },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-draft-approve') } }
  )
  return response.data.data
}

export const dryRunStorefrontExperienceMigration = async (
  draft: StorefrontExperienceDraft,
  target: AdminStorefrontTheme,
  reason: string
): Promise<StorefrontExperienceMigration> => {
  const response = await apiClient.post<{ data: StorefrontExperienceMigration }>(
    `/admin/storefront-experiences/drafts/${draft.id}/migrations/dry-run`,
    {
      expectedVersion: draft.version,
      reason,
      targetConfigurationSchemaVersion: target.configurationSchemaVersion,
      targetThemeVersion: target.themeVersion,
    },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-migration-dry-run') } }
  )
  return response.data.data
}

export const createStorefrontExperienceMigrationSuccessor = async (
  draft: StorefrontExperienceDraft,
  migration: StorefrontExperienceMigration,
  reason: string
): Promise<StorefrontExperienceDraft> => {
  const response = await apiClient.post<{ data: StorefrontExperienceDraft }>(
    `/admin/storefront-experiences/drafts/${draft.id}/migrations/approve`,
    {
      confirm: true,
      expectedVersion: draft.version,
      migrationId: migration.id,
      reason,
    },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-migration-successor') } }
  )
  return response.data.data
}

export const createStorefrontPreviewGrant = async (
  snapshotId: string,
  origin: string,
  reason: string,
  catalogReleaseId?: string
): Promise<{ expiresAt: string; grant: string; redeemUrl: string; snapshotId: string }> => {
  const response = await apiClient.post<{
    data: { expiresAt: string; grant: string; redeemUrl: string; snapshotId: string }
  }>(`/admin/storefront-experiences/snapshots/${snapshotId}/grants`, {
    catalogReleaseId,
    origin,
    reason,
  })
  return response.data.data
}

export const revokeStorefrontPreviewAccess = async (
  snapshotId: string,
  reason: string
): Promise<{
  grantsRevoked: number
  revokedAt: string
  sessionsRevoked: number
  snapshotId: string
}> => {
  const response = await apiClient.post<{
    data: {
      grantsRevoked: number
      revokedAt: string
      sessionsRevoked: number
      snapshotId: string
    }
  }>(
    `/admin/storefront-experiences/snapshots/${snapshotId}/revoke`,
    { reason },
    { headers: { 'Idempotency-Key': idempotencyKey('theme-preview-access-revoke') } }
  )
  return response.data.data
}
