import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import type {
  AdminStorefrontTheme,
  AssetReference,
  ExperienceResourceBinding,
  PageTemplate,
  SectionDefinition,
  SectionInstance,
  StorefrontLink,
  StorefrontResourceReference,
  ThemeOverride,
  ThemeOverrideOperation,
} from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
  App,
} from 'antd'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  approveStorefrontExperienceDraft,
  createStorefrontExperienceSuccessor,
  createStorefrontExperienceMigrationSuccessor,
  createStorefrontPreviewGrant,
  dryRunStorefrontExperienceMigration,
  fetchStorefrontExperienceDraft,
  fetchFashionStagingOperatorRun,
  fetchStorefrontCatalogReleases,
  fetchStorefrontPreviewBuild,
  fetchStorefrontPreviewContext,
  fetchStorefrontThemes,
  previewStorefrontExperienceDraft,
  revokeStorefrontPreviewAccess,
  storefrontPreviewOrigin,
  updateStorefrontExperienceDraft,
  validateStorefrontExperienceDraft,
  type StorefrontExperienceDraft,
  type FashionStagingOperatorRun,
  type StorefrontExperienceMigration,
  type StorefrontExperienceSnapshot,
  type StorefrontPreviewBuild,
  type StorefrontCatalogRelease,
} from '../../services/storefront/api'
import { QueryStateBlock } from '../../shared/components/query-state-block'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CatalogMediaPicker } from './catalog-media-picker'
import { StorefrontResourcePicker } from './storefront-resource-picker'
import { StorefrontLinkEditor, type StorefrontEditorResource } from './storefront-link-editor'

void React

type ThemeEditorPageProps = {
  pollIntervalMs?: number
  previewOrigin?: string | null
}
type Translate = (message: string, values?: Record<string, number | string>) => string
type DraftConflict = {
  bindings: ExperienceResourceBinding[]
  draft: StorefrontExperienceDraft
  overrides: ThemeOverride[]
}

const operatorRunStatusMessages: Record<FashionStagingOperatorRun['status'], string> = {
  approved: 'Approved',
  awaiting_operator: 'Awaiting operator',
  canceled: 'Canceled',
  consumed: 'Consumed',
  expired: 'Expired',
  rejected: 'Rejected',
}

const cloneTemplates = (templates: readonly PageTemplate[]): PageTemplate[] =>
  structuredClone(templates) as PageTemplate[]

const equalValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

const experienceFieldId = (templateId: string, instanceId: string, settingId: string): string =>
  `experience-field-${templateId}-${instanceId}-${settingId}`

export const resolveValidationFieldPath = (issue: {
  instanceId?: string | null
  path?: string | null
}): { instanceId?: string; settingId?: string } => {
  const pathParts = issue.path?.split('.') ?? []
  const instanceId = issue.instanceId ?? pathParts[0]
  const settingId =
    issue.path && instanceId && issue.path.startsWith(`${instanceId}.`)
      ? issue.path.slice(instanceId.length + 1)
      : pathParts[1]
  return { instanceId, settingId }
}

export const resolveDraftTemplates = (
  theme: AdminStorefrontTheme,
  draft: StorefrontExperienceDraft
): PageTemplate[] => {
  const preset = theme.presetDefinitions.find(({ id }) => id === draft.presetId)
  if (!preset) return []
  const templates = cloneTemplates(preset.templates)
  for (const override of draft.overrides) {
    const template = templates.find(({ id }) => id === override.templateId)
    if (!template) continue
    const presetTemplate = preset.templates.find(({ id }) => id === override.templateId)
    for (const operation of override.operations) {
      if (operation.kind === 'reorder-sections') {
        const byId = new Map(template.sections.map((section) => [section.id, section]))
        template.sections = operation.instanceIds
          .map((id) => byId.get(id))
          .filter((section): section is SectionInstance => Boolean(section))
      } else {
        const section = template.sections.find(({ id }) => id === operation.instanceId)
        const presetSection = presetTemplate?.sections.find(({ id }) => id === operation.instanceId)
        if (!section) continue
        if (operation.kind === 'set-visibility') {
          section.visible = operation.visible
        }
        if (operation.kind === 'set-setting') {
          section.settings[operation.settingId] = structuredClone(operation.value)
        }
        if (operation.kind === 'reset-setting') {
          if (presetSection && operation.settingId in presetSection.settings) {
            section.settings[operation.settingId] = structuredClone(
              presetSection.settings[operation.settingId]
            )
          } else {
            delete section.settings[operation.settingId]
          }
        }
      }
    }
  }
  return templates
}

export const createThemeOverrides = (
  theme: AdminStorefrontTheme,
  draft: StorefrontExperienceDraft,
  templates: readonly PageTemplate[]
): ThemeOverride[] => {
  const preset = theme.presetDefinitions.find(({ id }) => id === draft.presetId)
  if (!preset) return []
  return templates.flatMap((template): ThemeOverride[] => {
    const base = preset.templates.find(({ id }) => id === template.id)
    if (!base) return []
    const operations: ThemeOverrideOperation[] = []
    const currentOrder = template.sections.map(({ id }) => id)
    if (
      !equalValue(
        currentOrder,
        base.sections.map(({ id }) => id)
      )
    ) {
      operations.push({ instanceIds: currentOrder, kind: 'reorder-sections' })
    }
    for (const section of template.sections) {
      const baseSection = base.sections.find(({ id }) => id === section.id)
      if (!baseSection) continue
      if (section.visible !== baseSection.visible) {
        operations.push({
          instanceId: section.id,
          kind: 'set-visibility',
          visible: section.visible,
        })
      }
      for (const settingId of new Set([
        ...Object.keys(baseSection.settings),
        ...Object.keys(section.settings),
      ])) {
        if (!equalValue(section.settings[settingId], baseSection.settings[settingId])) {
          if (section.settings[settingId] === undefined) {
            operations.push({ instanceId: section.id, kind: 'reset-setting', settingId })
          } else {
            operations.push({
              instanceId: section.id,
              kind: 'set-setting',
              settingId,
              value: structuredClone(section.settings[settingId]),
            })
          }
        }
      }
    }
    return operations.length === 0
      ? []
      : [
          {
            operations,
            presetId: draft.presetId,
            schemaVersion: draft.configurationSchemaVersion,
            templateId: template.id,
          },
        ]
  })
}

export const submitPreviewGrant = (
  grant: { grant: string; redeemUrl: string },
  documentRef: Document = document
) => {
  const form = documentRef.createElement('form')
  form.action = grant.redeemUrl
  form.method = 'POST'
  form.target = '_blank'
  form.style.display = 'none'
  const credential = documentRef.createElement('input')
  credential.type = 'hidden'
  credential.name = 'grant'
  credential.value = grant.grant
  form.append(credential)
  documentRef.body.append(form)
  form.submit()
  form.remove()
}

export const previewBuildStatus = (build: StorefrontPreviewBuild | null) => {
  switch (build?.status) {
    case 'pending':
      return { color: 'default', label: 'Queued' }
    case 'building':
      return { color: 'processing', label: 'Building' }
    case 'deployed':
      return { color: 'success', label: 'Ready' }
    case 'failed':
      return { color: 'error', label: 'Failed' }
    case 'expired':
      return { color: 'warning', label: 'Expired' }
    default:
      return { color: 'default', label: 'Not requested' }
  }
}

const requiredSection = (template: PageTemplate, section: SectionInstance) =>
  section.required === true ||
  section.capabilities.some((capability) => template.requiredCapabilities.includes(capability))

const settingDefinitionFor = (
  theme: AdminStorefrontTheme,
  section: SectionInstance
): SectionDefinition['settings'] =>
  theme.componentRegistry.sections.find(({ type }) => type === section.type)?.settings ?? []

export const SectionMoveButtons = ({
  count,
  index,
  instanceId,
  onMove,
  t,
}: {
  count: number
  index: number
  instanceId: string
  onMove: (direction: -1 | 1) => void
  t: Translate
}) => (
  <Space.Compact>
    <Button
      aria-label={t('Move {id} before', { id: instanceId })}
      icon={<ArrowUpOutlined aria-hidden />}
      disabled={index === 0}
      onClick={() => onMove(-1)}
    />
    <Button
      aria-label={t('Move {id} after', { id: instanceId })}
      icon={<ArrowDownOutlined aria-hidden />}
      disabled={index === count - 1}
      onClick={() => onMove(1)}
    />
  </Space.Compact>
)

export const ThemeEditorPage = ({
  pollIntervalMs = 2_000,
  previewOrigin = storefrontPreviewOrigin(),
}: ThemeEditorPageProps) => {
  const { message } = App.useApp()
  const { draftId } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const canPreview = hasPermission(role, 'themes.preview', permissions)
  const canReadCatalog = hasPermission(role, 'catalog.read', permissions)
  const canApprove = hasPermission(role, 'themes.approve', permissions)
  const [draft, setDraft] = useState<StorefrontExperienceDraft | null>(null)
  const [operatorRun, setOperatorRun] = useState<FashionStagingOperatorRun | null>(null)
  const [theme, setTheme] = useState<AdminStorefrontTheme | null>(null)
  const [availableThemes, setAvailableThemes] = useState<AdminStorefrontTheme[]>([])
  const [templates, setTemplates] = useState<PageTemplate[]>([])
  const [savedTemplates, setSavedTemplates] = useState<PageTemplate[]>([])
  const [bindings, setBindings] = useState<ExperienceResourceBinding[]>([])
  const [savedBindings, setSavedBindings] = useState<ExperienceResourceBinding[]>([])
  const [catalogReleases, setCatalogReleases] = useState<StorefrontCatalogRelease[]>([])
  const [catalogReleasesLoading, setCatalogReleasesLoading] = useState(false)
  const [catalogReleasesError, setCatalogReleasesError] = useState<string | null>(null)
  const [catalogReleasesRetry, setCatalogReleasesRetry] = useState(0)
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    () => window.sessionStorage.getItem('storefront-editor-catalog-release') ?? ''
  )
  const selectedReleaseIdRef = useRef(selectedReleaseId)
  const [activeTemplateId, setActiveTemplateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [approvalReason, setApprovalReason] = useState('')
  const [sectionMoveStatus, setSectionMoveStatus] = useState('')
  const [build, setBuild] = useState<StorefrontPreviewBuild | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<StorefrontExperienceSnapshot | null>(null)
  const [revokedPreviewSnapshotId, setRevokedPreviewSnapshotId] = useState<string | null>(null)
  const [approvedSnapshot, setApprovedSnapshot] = useState<StorefrontExperienceSnapshot | null>(
    null
  )
  const [migration, setMigration] = useState<StorefrontExperienceMigration | null>(null)
  const [conflict, setConflict] = useState<DraftConflict | null>(null)
  const [upgradeThemeKey, setUpgradeThemeKey] = useState('')
  const [validationFocusRequest, setValidationFocusRequest] = useState(0)
  const loadRequest = useRef(0)
  const previewContextRequest = useRef(0)
  const conflictActionRef = useRef<HTMLButtonElement>(null)
  const previewLaunchRef = useRef<HTMLButtonElement>(null)
  const draftHeadingRef = useRef<HTMLHeadingElement>(null)
  const successorFocusTarget = useRef<string | null>(null)
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const dirty = useMemo(
    () => !equalValue(templates, savedTemplates) || !equalValue(bindings, savedBindings),
    [bindings, savedBindings, savedTemplates, templates]
  )
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!draft?.id || draft.id === draftId || dirty) return
    navigate(`/storefront/themes/${draft.id}`, { replace: true })
  }, [draft?.id, draftId, dirty, navigate])

  useEffect(() => {
    if (!conflict) return
    const frame = window.requestAnimationFrame(() => conflictActionRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [conflict])

  useEffect(() => {
    const successorId = successorFocusTarget.current
    if (loading || !successorId || draft?.id !== successorId || draftId !== successorId) return
    const frame = window.requestAnimationFrame(() => {
      const heading = draftHeadingRef.current
      if (!heading || successorFocusTarget.current !== successorId) return
      heading.focus()
      successorFocusTarget.current = null
    })
    return () => window.cancelAnimationFrame(frame)
  }, [draft?.id, draftId, loading])

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    if (!draftId) {
      setError(t('The experience draft ID is missing.'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextDraft, themes, nextOperatorRun] = await Promise.all([
        fetchStorefrontExperienceDraft(draftId),
        fetchStorefrontThemes(),
        fetchFashionStagingOperatorRun(draftId),
      ])
      const nextTheme = themes.find(
        ({ id, themeVersion }) =>
          id === nextDraft.themeId && themeVersion === nextDraft.themeVersion
      )
      if (!nextTheme) throw new Error(t('The exact approved theme package is no longer available.'))
      if (request !== loadRequest.current) return
      const nextTemplates = resolveDraftTemplates(nextTheme, nextDraft)
      setDraft(nextDraft)
      setOperatorRun(nextOperatorRun)
      setTheme(nextTheme)
      setAvailableThemes(themes)
      setTemplates(nextTemplates)
      setSavedTemplates(cloneTemplates(nextTemplates))
      setBindings(structuredClone(nextDraft.bindings))
      setSavedBindings(structuredClone(nextDraft.bindings))
      setActiveTemplateId((current) => current || nextTemplates[0]?.id || '')
      if (
        nextDraft.themeId === 'fashion-store' &&
        nextOperatorRun &&
        ['awaiting_operator', 'approved'].includes(nextOperatorRun.status)
      ) {
        selectedReleaseIdRef.current = nextOperatorRun.catalogReleaseId
        setSelectedReleaseId(nextOperatorRun.catalogReleaseId)
        window.sessionStorage.setItem(
          'storefront-editor-catalog-release',
          nextOperatorRun.catalogReleaseId
        )
      } else if (nextDraft.themeId !== 'fashion-store') {
        selectedReleaseIdRef.current = ''
        setSelectedReleaseId('')
      }
      previewContextRequest.current += 1
      setBuild(null)
      setPreviewSnapshot(null)
      setRevokedPreviewSnapshotId(null)
      setMigration(null)
      setConflict(null)
      const upgrade = themes.find(
        ({ id, themeVersion }) =>
          id === nextDraft.themeId && themeVersion !== nextDraft.themeVersion
      )
      setUpgradeThemeKey(
        upgrade ? `${upgrade.id}@${upgrade.themeVersion}@${upgrade.configurationSchemaVersion}` : ''
      )
    } catch (cause) {
      if (request !== loadRequest.current) return
      setError(normalizeApiError(cause).message)
    } finally {
      if (request === loadRequest.current) setLoading(false)
    }
  }, [draftId, t])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      loadRequest.current += 1
    }
  }, [load])

  useEffect(() => {
    if (!canPreview || !canReadCatalog || draft?.themeId !== 'fashion-store') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setCatalogReleasesLoading(true)
      setCatalogReleasesError(null)
      void fetchStorefrontCatalogReleases()
        .then((releases) => {
          if (cancelled) return
          setCatalogReleases(releases)
          setSelectedReleaseId((current) => {
            const frozen =
              operatorRun && ['awaiting_operator', 'approved'].includes(operatorRun.status)
                ? operatorRun.catalogReleaseId
                : null
            const next =
              frozen ??
              (releases.some(({ id }) => id === current) ? current : (releases[0]?.id ?? ''))
            selectedReleaseIdRef.current = next
            return next
          })
        })
        .catch((cause) => {
          if (!cancelled) setCatalogReleasesError(normalizeApiError(cause).message)
        })
        .finally(() => {
          if (!cancelled) setCatalogReleasesLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [canPreview, canReadCatalog, catalogReleasesRetry, draft?.themeId, operatorRun])

  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  useEffect(() => {
    if (!build || !['pending', 'building'].includes(build.status)) return
    let cancelled = false
    const buildId = build.id
    const releaseId = build.inputIdentity?.catalogReleaseId ?? ''
    const timer = window.setTimeout(async () => {
      try {
        const nextBuild = await fetchStorefrontPreviewBuild(buildId)
        if (!cancelled && selectedReleaseIdRef.current === releaseId) {
          setBuild((current) => (current?.id === buildId ? nextBuild : current))
        }
      } catch (cause) {
        if (!cancelled) setError(normalizeApiError(cause).message)
      }
    }, pollIntervalMs)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [build, pollIntervalMs])

  const activeTemplate = templates.find(({ id }) => id === activeTemplateId) ?? templates[0]
  const requiresCatalogRelease = draft?.themeId === 'fashion-store'
  const selectedRelease = catalogReleases.find(({ id }) => id === selectedReleaseId)
  const selectedReleaseAvailable = Boolean(selectedRelease)
  const hydratedDraftId = draft?.id
  const hydratedDraftVersion = draft?.version
  useEffect(() => {
    if (!hydratedDraftId || !hydratedDraftVersion || !canPreview) return
    if (requiresCatalogRelease && (!canReadCatalog || !selectedReleaseAvailable)) return
    const releaseId = requiresCatalogRelease ? selectedReleaseId : ''
    const request = ++previewContextRequest.current
    let cancelled = false
    void fetchStorefrontPreviewContext(
      hydratedDraftId,
      hydratedDraftVersion,
      releaseId || undefined
    )
      .then((resolution) => {
        if (
          cancelled ||
          request !== previewContextRequest.current ||
          releaseId !== selectedReleaseIdRef.current
        ) {
          return
        }
        setBuild(resolution?.build ?? null)
        setPreviewSnapshot(resolution?.snapshot ?? null)
        setRevokedPreviewSnapshotId(null)
      })
      .catch((cause) => {
        if (
          !cancelled &&
          request === previewContextRequest.current &&
          releaseId === selectedReleaseIdRef.current
        ) {
          setError(normalizeApiError(cause).message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    canPreview,
    canReadCatalog,
    hydratedDraftId,
    hydratedDraftVersion,
    requiresCatalogRelease,
    selectedReleaseAvailable,
    selectedReleaseId,
  ])
  const editorResources = useMemo<StorefrontEditorResource[]>(
    () =>
      selectedRelease
        ? [
            ...selectedRelease.products.map((product) => ({
              id: product.id,
              kind: product.kind,
              label: product.name,
              path: `/products/${product.slug}`,
            })),
            ...selectedRelease.collections.map((collection) => ({
              id: collection.id,
              kind: collection.kind,
              label: collection.name,
              path: `/collections/${collection.slug}`,
            })),
            ...(selectedRelease.destinations ?? []).map((destination) => ({
              id: destination.id,
              kind: destination.kind,
              label: destination.name,
              path: destination.path,
            })),
          ]
        : [],
    [selectedRelease]
  )
  const status = previewBuildStatus(build)
  const upgradeCandidates = availableThemes.filter(
    ({ id, themeVersion }) => id === draft?.themeId && themeVersion !== draft?.themeVersion
  )
  const upgradeTheme = upgradeCandidates.find(
    (candidate) =>
      `${candidate.id}@${candidate.themeVersion}@${candidate.configurationSchemaVersion}` ===
      upgradeThemeKey
  )

  const updateSection = (
    templateId: string,
    sectionId: string,
    update: (section: SectionInstance) => void
  ) => {
    setTemplates((current) => {
      const next = cloneTemplates(current)
      const section = next
        .find(({ id }) => id === templateId)
        ?.sections.find(({ id }) => id === sectionId)
      if (section) update(section)
      return next
    })
  }

  const moveSection = (templateId: string, sectionId: string, direction: -1 | 1) => {
    setTemplates((current) => {
      const next = cloneTemplates(current)
      const template = next.find(({ id }) => id === templateId)
      const index = template?.sections.findIndex(({ id }) => id === sectionId) ?? -1
      const target = index + direction
      if (!template || index < 0 || target < 0 || target >= template.sections.length) return current
      const [section] = template.sections.splice(index, 1)
      template.sections.splice(target, 0, section)
      setSectionMoveStatus(
        t('{id} moved to position {position} of {count} on {pageType}.', {
          id: section.id,
          position: target + 1,
          count: template.sections.length,
          pageType: template.pageType,
        })
      )
      return next
    })
  }

  const resetSection = (templateId: string, sectionId: string) => {
    if (!theme || !draft) return
    const preset = theme.presetDefinitions.find(({ id }) => id === draft.presetId)
    const original = preset?.templates
      .find(({ id }) => id === templateId)
      ?.sections.find(({ id }) => id === sectionId)
    if (!original) return
    updateSection(templateId, sectionId, (section) => {
      section.settings = structuredClone(original.settings)
      section.visible = original.visible
    })
  }

  const save = async (reason: string): Promise<StorefrontExperienceDraft> => {
    if (!draft || !theme) throw new Error(t('The exact draft package is not loaded.'))
    if (!dirty) return draft
    const overrides = createThemeOverrides(theme, draft, templates)
    let updated: StorefrontExperienceDraft
    try {
      updated = await updateStorefrontExperienceDraft(draft, overrides, reason, bindings)
    } catch (cause) {
      const apiError = normalizeApiError(cause)
      if (apiError.status === 409) {
        setConflict({
          bindings: structuredClone(bindings),
          draft: structuredClone(draft),
          overrides: structuredClone(overrides),
        })
      }
      throw apiError
    }
    setDraft(updated)
    setSavedTemplates(cloneTemplates(templates))
    setBindings(structuredClone(updated.bindings))
    setSavedBindings(structuredClone(updated.bindings))
    return updated
  }

  const validate = async (target: StorefrontExperienceDraft, reason: string, releaseId: string) => {
    if (selectedReleaseIdRef.current !== releaseId) return null
    const validation = await validateStorefrontExperienceDraft(
      target.id,
      target.version,
      reason,
      releaseId || undefined
    )
    if (selectedReleaseIdRef.current !== releaseId) return null
    const validations = [
      ...target.validations.filter(
        ({ catalogReleaseId }) => catalogReleaseId !== validation.catalogReleaseId
      ),
      validation,
    ]
    const validated = {
      ...target,
      validation: validation.catalogReleaseId === null ? validation : target.validation,
      validations,
    }
    setDraft(validated)
    if (validation.status === 'invalid' && validation.issues.length > 0) {
      setValidationFocusRequest((request) => request + 1)
    }
    return validated
  }

  const selectedValidation = (target: StorefrontExperienceDraft, releaseId: string) =>
    target.validations.find(({ catalogReleaseId }) => catalogReleaseId === (releaseId || null))

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setBusy(false)
    }
  }

  const reasonReady = changeReason.trim().length >= 3
  const currentValidation = draft?.validations.find(
    ({ catalogReleaseId }) => catalogReleaseId === (selectedReleaseId || null)
  )
  useEffect(() => {
    if (currentValidation?.status !== 'invalid' || currentValidation.issues.length === 0) return
    const frame = window.requestAnimationFrame(() => validationSummaryRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [
    currentValidation?.id,
    currentValidation?.issues.length,
    currentValidation?.status,
    validationFocusRequest,
  ])
  const validationCurrent =
    currentValidation?.status === 'valid' && currentValidation.draftVersion === draft?.version
  const previewContextCurrent =
    build?.status === 'deployed' &&
    previewSnapshot?.id === build.snapshotId &&
    (!requiresCatalogRelease ||
      (previewSnapshot.sourceDraftId === draft?.id &&
        previewSnapshot.sourceDraftVersion === draft?.version &&
        build.inputIdentity?.catalogReleaseId === selectedReleaseId &&
        build.inputIdentity.experienceVersion === draft?.version))

  useEffect(() => {
    if (!previewContextCurrent || !previewLaunchRef.current) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('preview-return') !== '1') return
    const timer = window.setTimeout(() => {
      url.searchParams.delete('preview-return')
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`
      )
      previewLaunchRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [previewContextCurrent])

  const startPreview = async (
    target: StorefrontExperienceDraft,
    reason: string,
    releaseId: string
  ) => {
    if (selectedReleaseIdRef.current !== releaseId) return false
    if (requiresCatalogRelease && !releaseId) {
      throw new Error(t('Select a deployed Catalog Release before previewing.'))
    }
    previewContextRequest.current += 1
    const resolution = await previewStorefrontExperienceDraft(
      target.id,
      target.version,
      reason,
      releaseId || undefined
    )
    if (selectedReleaseIdRef.current !== releaseId) return false
    setPreviewSnapshot(resolution.snapshot)
    setRevokedPreviewSnapshotId(null)
    setBuild(resolution.build)
    return true
  }

  const setCatalogBinding = (
    instanceId: string,
    settingId: string,
    kind: 'collection' | 'product',
    referenceId?: string
  ) => {
    setBindings((current) => {
      const rest = current.filter(
        (binding) =>
          binding.kind !== 'catalog' ||
          binding.instanceId !== instanceId ||
          binding.settingId !== settingId
      )
      if (!referenceId) return rest
      return [
        ...rest,
        {
          id: `catalog-${instanceId}-${settingId}`,
          instanceId,
          kind: 'catalog',
          reference: { id: referenceId, kind },
          settingId,
        },
      ]
    })
  }

  const reloadSavedDraft = () => {
    if (
      dirty &&
      !window.confirm(t('Discard local theme edits and reload the last saved draft version?'))
    ) {
      return
    }
    void load()
  }

  if (loading) {
    return <QueryStateBlock state="loading" title={t('Loading the exact experience draft…')} />
  }
  if (error && (!draft || !theme)) {
    return (
      <QueryStateBlock
        state="error"
        title={t('Experience editor could not be loaded')}
        description={error}
        primaryActionLabel={t('Reload')}
        onPrimaryAction={() => void load()}
        secondaryActionLabel={t('Back to themes')}
        onSecondaryAction={() => navigate('/storefront/themes')}
      />
    )
  }
  if (!draft || !theme || !activeTemplate) return null

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button
            type="link"
            className="!-ml-4"
            icon={<ArrowLeftOutlined aria-hidden />}
            onClick={() => navigate('/storefront/themes')}
          >
            {t('Storefront themes')}
          </Button>
          <Typography.Title ref={draftHeadingRef} level={2} tabIndex={-1} className="!mb-1 !mt-0">
            {draft.experienceId}
          </Typography.Title>
          <Space wrap>
            <Tag color="blue">
              {draft.themeId} {draft.themeVersion}
            </Tag>
            <Tag>
              {t('Draft')} v{draft.version}
            </Tag>
            <Tag color={validationCurrent ? 'success' : 'default'}>
              {validationCurrent ? `${t('Validated')} v${draft.version}` : t('Validation required')}
            </Tag>
            {dirty ? <Tag color="warning">{t('Unsaved changes')}</Tag> : <Tag>{t('Saved')}</Tag>}
          </Space>
        </div>
        <Space wrap>
          {canWrite ? (
            <>
              <Button
                icon={<SaveOutlined aria-hidden />}
                disabled={!dirty || !reasonReady}
                loading={busy}
                onClick={() =>
                  void runAction(async () => {
                    await save(changeReason)
                    void message.success(t('Draft saved with a new version.'))
                  })
                }
              >
                {t('Save')}
              </Button>
              <Button
                disabled={dirty || !reasonReady}
                loading={busy}
                onClick={() =>
                  void runAction(async () => {
                    const releaseId = selectedReleaseId
                    const validated = await validate(draft, changeReason, releaseId)
                    if (validated && selectedValidation(validated, releaseId)?.status === 'valid') {
                      void message.success(
                        t('Draft v{version} is valid.', { version: validated.version })
                      )
                    }
                  })
                }
              >
                {t('Validate saved version')}
              </Button>
            </>
          ) : null}
          {canPreview ? (
            <Button
              type="primary"
              icon={<EyeOutlined aria-hidden />}
              disabled={
                busy ||
                !reasonReady ||
                (requiresCatalogRelease && (!selectedReleaseId || !canReadCatalog))
              }
              loading={busy}
              onClick={() =>
                void runAction(async () => {
                  const releaseId = selectedReleaseId
                  const saved = await save(changeReason)
                  const validated = await validate(saved, changeReason, releaseId)
                  if (!validated || selectedValidation(validated, releaseId)?.status !== 'valid')
                    return
                  if (!(await startPreview(validated, changeReason, releaseId))) return
                  void message.success(
                    t('Preview requested for validated draft v{version}.', {
                      version: validated.version,
                    })
                  )
                })
              }
            >
              {t('Save and preview')}
            </Button>
          ) : null}
        </Space>
      </header>

      {blocker.state === 'blocked' ? (
        <Alert
          type="warning"
          showIcon
          title={t('Discard unsaved theme edits?')}
          description={t(
            'The destination will open only after you explicitly discard the local changes.'
          )}
          action={
            <Space>
              <Button size="small" onClick={() => blocker.reset()}>
                {t('Keep editing')}
              </Button>
              <Button size="small" danger onClick={() => blocker.proceed()}>
                {t('Discard and leave')}
              </Button>
            </Space>
          }
        />
      ) : null}
      {conflict ? (
        <Alert
          type="warning"
          showIcon
          title={t('The saved draft changed while local edits were open')}
          description={t(
            'Your local edits are preserved. Reload and discard them, or save them as a separate successor draft for review.'
          )}
          action={
            <Space wrap>
              <Button
                ref={conflictActionRef}
                size="small"
                onClick={() => {
                  setConflict(null)
                  setError(null)
                }}
              >
                {t('Keep local edits')}
              </Button>
              <Button
                size="small"
                danger
                onClick={() => {
                  setConflict(null)
                  setError(null)
                  void load()
                }}
              >
                {t('Reload and discard local edits')}
              </Button>
              <Button
                size="small"
                type="primary"
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    const successor = await createStorefrontExperienceSuccessor(
                      conflict.draft,
                      conflict.overrides,
                      changeReason,
                      conflict.bindings
                    )
                    successorFocusTarget.current = successor.id
                    setLoading(true)
                    setConflict(null)
                    setDraft(successor)
                    setSavedTemplates(cloneTemplates(templates))
                    setBindings(structuredClone(successor.bindings))
                    setSavedBindings(structuredClone(successor.bindings))
                    void message.success(
                      t('Successor draft {id} created for review.', { id: successor.id })
                    )
                  })
                }
              >
                {t('Save local edits as successor')}
              </Button>
            </Space>
          }
        />
      ) : error ? (
        <Alert
          type="error"
          showIcon
          title={t('The last operation did not complete')}
          description={error}
          action={
            <Button size="small" icon={<ReloadOutlined aria-hidden />} onClick={reloadSavedDraft}>
              {t('Reload saved draft')}
            </Button>
          }
        />
      ) : null}
      {!canWrite ? (
        <Alert
          type="info"
          showIcon
          title={t('Read-only experience')}
          description={t(
            'Your role can inspect the package, capabilities, validation, and versions only.'
          )}
        />
      ) : null}

      {operatorRun ? (
        <Alert
          type={operatorRun.status === 'awaiting_operator' ? 'info' : 'warning'}
          showIcon
          title={t('Fashion staging acceptance run')}
          description={
            <Descriptions size="small" column={{ xs: 1, lg: 2 }}>
              <Descriptions.Item label={t('Run')}>{operatorRun.runId}</Descriptions.Item>
              <Descriptions.Item label={t('State')}>
                {t(operatorRunStatusMessages[operatorRun.status])}
              </Descriptions.Item>
              <Descriptions.Item label={t('U12 baseline')}>
                {operatorRun.u12SnapshotId}
              </Descriptions.Item>
              <Descriptions.Item label={t('Catalog Release')}>
                {operatorRun.catalogReleaseId}
              </Descriptions.Item>
              <Descriptions.Item label={t('Source draft')}>
                {operatorRun.sourceDraftId}
              </Descriptions.Item>
              <Descriptions.Item label={t('Expires')}>{operatorRun.expiresAt}</Descriptions.Item>
              <Descriptions.Item label={t('Allowed action')}>
                {operatorRun.allowedAction === 'complete_run_bound_editor_path'
                  ? t('Complete the run-bound editor path')
                  : t('No further action is authorized')}
              </Descriptions.Item>
            </Descriptions>
          }
        />
      ) : null}

      <Descriptions bordered size="small" column={{ xs: 1, lg: 3 }}>
        <Descriptions.Item label={t('Draft identity')}>
          <Typography.Text className="break-all">{draft.id}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('Preset')}>{draft.presetId}</Descriptions.Item>
        <Descriptions.Item label={t('Schema')}>
          {draft.configurationSchemaVersion}
        </Descriptions.Item>
        <Descriptions.Item label={t('Last saved')}>{draft.updatedAt}</Descriptions.Item>
        <Descriptions.Item label={t('Resource bindings')}>{bindings.length}</Descriptions.Item>
        <Descriptions.Item label={t('Production theme')}>{t('Unchanged')}</Descriptions.Item>
      </Descriptions>

      {requiresCatalogRelease ? (
        <Card title={t('Live preview context')}>
          {!canReadCatalog ? (
            <Alert
              type="warning"
              showIcon
              title={t('Catalog access is required')}
              description={t(
                'Live preview requires both themes.preview and catalog.read permissions.'
              )}
            />
          ) : catalogReleasesLoading ? (
            <Space>
              <Spin size="small" />
              <span>{t('Loading deployed Catalog Releases…')}</span>
            </Space>
          ) : catalogReleasesError ? (
            <Alert
              type="error"
              showIcon
              title={t('Catalog Releases could not be loaded')}
              description={catalogReleasesError}
              action={
                <Button size="small" onClick={() => setCatalogReleasesRetry((value) => value + 1)}>
                  {t('Retry Catalog Releases')}
                </Button>
              }
            />
          ) : catalogReleases.length === 0 ? (
            <Alert
              type="info"
              showIcon
              title={t('No deployed canonical Catalog Release is available in this environment.')}
            />
          ) : (
            <Space orientation="vertical" className="w-full">
              <Select
                aria-label={t('Catalog Release')}
                className="w-full"
                disabled={
                  busy ||
                  Boolean(
                    operatorRun && ['awaiting_operator', 'approved'].includes(operatorRun.status)
                  )
                }
                value={selectedReleaseId || undefined}
                options={catalogReleases.map((release) => ({
                  label: `${release.id} · ${release.environment} · ${release.deployedAt ?? release.approvedAt}`,
                  value: release.id,
                }))}
                onChange={(value) => {
                  selectedReleaseIdRef.current = value
                  setSelectedReleaseId(value)
                  window.sessionStorage.setItem('storefront-editor-catalog-release', value)
                  previewContextRequest.current += 1
                  setBuild(null)
                  setPreviewSnapshot(null)
                  setRevokedPreviewSnapshotId(null)
                }}
              />
              {selectedRelease ? (
                <Typography.Text type="secondary">
                  {selectedRelease.environment} · {selectedRelease.status} ·{' '}
                  {selectedRelease.products.length} {t('products')} ·{' '}
                  {selectedRelease.collections.length} {t('collections')}
                </Typography.Text>
              ) : null}
            </Space>
          )}
        </Card>
      ) : null}

      <Card
        title={t('Change context')}
        extra={
          <Typography.Text type="secondary">
            {t('Required for every audited action')}
          </Typography.Text>
        }
      >
        <Input.TextArea
          aria-label={t('Change reason')}
          placeholder={t('Describe why this experience is changing')}
          value={changeReason}
          maxLength={500}
          rows={2}
          onChange={(event) => setChangeReason(event.target.value)}
        />
      </Card>

      <section aria-labelledby="experience-structure-heading">
        <Typography.Title id="experience-structure-heading" level={4}>
          {t('Experience structure')}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {t(
            'Sections keep stable IDs. Required capabilities cannot be hidden; ordering uses explicit controls for keyboard, touch, and assistive technology.'
          )}
        </Typography.Paragraph>
        <div className="sr-only" role="status">
          {sectionMoveStatus}
        </div>
        <Tabs
          activeKey={activeTemplate.id}
          onChange={setActiveTemplateId}
          items={templates.map((template) => ({
            key: template.id,
            label: template.pageType,
            children: (
              <div className="space-y-4">
                <Alert
                  type="info"
                  showIcon
                  title={t('Required capabilities')}
                  description={template.requiredCapabilities.join(', ')}
                />
                <ol className="space-y-3">
                  {template.sections.map((section, index) => {
                    const isRequired = requiredSection(template, section)
                    const definitions = settingDefinitionFor(theme, section)
                    return (
                      <li key={section.id}>
                        <Card
                          size="small"
                          title={
                            <Space wrap>
                              <Typography.Text strong>{section.id}</Typography.Text>
                              <Tag>{section.type}</Tag>
                              <Tag>
                                {t('Position')} {index + 1}
                              </Tag>
                              {isRequired ? <Tag color="gold">{t('Required')}</Tag> : null}
                            </Space>
                          }
                          extra={
                            canWrite ? (
                              <SectionMoveButtons
                                count={template.sections.length}
                                index={index}
                                instanceId={section.id}
                                t={t}
                                onMove={(direction) =>
                                  moveSection(template.id, section.id, direction)
                                }
                              />
                            ) : null
                          }
                        >
                          <Space wrap>
                            <span>
                              {t('Visible')}{' '}
                              <Switch
                                aria-label={t('Show {id}', { id: section.id })}
                                checked={section.visible}
                                disabled={!canWrite || isRequired}
                                onChange={(visible) =>
                                  updateSection(template.id, section.id, (current) => {
                                    current.visible = visible
                                  })
                                }
                              />
                            </span>
                            {section.capabilities.map((capability) => (
                              <Tag key={capability}>{capability}</Tag>
                            ))}
                            {canWrite ? (
                              <Button
                                aria-label={t('Reset {id}', { id: section.id })}
                                size="small"
                                onClick={() => resetSection(template.id, section.id)}
                              >
                                {t('Reset instance')}
                              </Button>
                            ) : null}
                          </Space>
                          {definitions.length > 0 ? (
                            <>
                              <Divider />
                              <div className="grid gap-4 md:grid-cols-2">
                                {definitions.map((definition) => {
                                  const value = section.settings[definition.id]
                                  const label = `${section.id} ${definition.id}`
                                  const fieldCopy = (
                                    <>
                                      <Typography.Text>
                                        {definition.label ?? definition.id}
                                      </Typography.Text>
                                      {definition.helpText ? (
                                        <Typography.Paragraph type="secondary" className="!mb-1">
                                          {definition.helpText}
                                        </Typography.Paragraph>
                                      ) : null}
                                    </>
                                  )
                                  if (definition.kind === 'text') {
                                    return (
                                      <label
                                        key={definition.id}
                                        id={experienceFieldId(
                                          template.id,
                                          section.id,
                                          definition.id
                                        )}
                                        tabIndex={-1}
                                      >
                                        {fieldCopy}
                                        <Input.TextArea
                                          aria-label={label}
                                          disabled={!canWrite}
                                          maxLength={definition.maxLength}
                                          rows={2}
                                          value={String(value ?? '')}
                                          onChange={(event) =>
                                            updateSection(template.id, section.id, (current) => {
                                              current.settings[definition.id] = event.target.value
                                            })
                                          }
                                        />
                                      </label>
                                    )
                                  }
                                  if (definition.kind === 'number') {
                                    return (
                                      <label
                                        key={definition.id}
                                        id={experienceFieldId(
                                          template.id,
                                          section.id,
                                          definition.id
                                        )}
                                        tabIndex={-1}
                                      >
                                        {fieldCopy}
                                        <InputNumber
                                          aria-label={label}
                                          className="w-full"
                                          disabled={!canWrite}
                                          min={definition.min}
                                          max={definition.max}
                                          step={definition.step}
                                          value={
                                            typeof value === 'number' ? value : definition.default
                                          }
                                          onChange={(next) =>
                                            updateSection(template.id, section.id, (current) => {
                                              current.settings[definition.id] =
                                                next ?? definition.default
                                            })
                                          }
                                        />
                                      </label>
                                    )
                                  }
                                  if (definition.kind === 'boolean') {
                                    return (
                                      <label
                                        key={definition.id}
                                        id={experienceFieldId(
                                          template.id,
                                          section.id,
                                          definition.id
                                        )}
                                        tabIndex={-1}
                                      >
                                        <Space>
                                          {fieldCopy}
                                          <Switch
                                            aria-label={label}
                                            disabled={!canWrite}
                                            checked={
                                              typeof value === 'boolean'
                                                ? value
                                                : definition.default
                                            }
                                            onChange={(checked) =>
                                              updateSection(template.id, section.id, (current) => {
                                                current.settings[definition.id] = checked
                                              })
                                            }
                                          />
                                        </Space>
                                      </label>
                                    )
                                  }
                                  if (definition.kind === 'select') {
                                    return (
                                      <label
                                        key={definition.id}
                                        id={experienceFieldId(
                                          template.id,
                                          section.id,
                                          definition.id
                                        )}
                                        tabIndex={-1}
                                      >
                                        {fieldCopy}
                                        <Select
                                          aria-label={label}
                                          className="w-full"
                                          disabled={!canWrite}
                                          value={
                                            typeof value === 'string' ? value : definition.default
                                          }
                                          options={definition.options}
                                          onChange={(next) =>
                                            updateSection(template.id, section.id, (current) => {
                                              current.settings[definition.id] = next
                                            })
                                          }
                                        />
                                      </label>
                                    )
                                  }
                                  if (
                                    definition.kind === 'product-reference' ||
                                    definition.kind === 'collection-reference' ||
                                    definition.kind === 'page-reference' ||
                                    definition.kind === 'article-reference' ||
                                    definition.kind === 'policy-reference'
                                  ) {
                                    const referenceKind = definition.kind.replace(
                                      '-reference',
                                      ''
                                    ) as StorefrontResourceReference['kind']
                                    const selectedBinding = bindings.find(
                                      (binding) =>
                                        binding.kind === 'catalog' &&
                                        binding.instanceId === section.id &&
                                        binding.settingId === definition.id
                                    )
                                    const selectedSetting =
                                      typeof value === 'object' &&
                                      value !== null &&
                                      'kind' in value &&
                                      value.kind === referenceKind &&
                                      'id' in value
                                        ? (value as StorefrontResourceReference)
                                        : undefined
                                    const selectedId =
                                      selectedBinding?.kind === 'catalog'
                                        ? selectedBinding.reference.id
                                        : selectedSetting?.id
                                    const resources = editorResources.filter(
                                      ({ kind }) => kind === referenceKind
                                    )
                                    const selectedResource = resources.find(
                                      ({ id }) => id === selectedId
                                    )
                                    const missing =
                                      Boolean(selectedId) &&
                                      !resources.some(({ id }) => id === selectedId)
                                    return (
                                      <div
                                        key={definition.id}
                                        id={experienceFieldId(
                                          template.id,
                                          section.id,
                                          definition.id
                                        )}
                                        className="min-w-0"
                                        tabIndex={-1}
                                      >
                                        <Typography.Text>
                                          {definition.label ?? definition.id}
                                        </Typography.Text>
                                        {definition.helpText ? (
                                          <Typography.Paragraph type="secondary" className="!mb-1">
                                            {definition.helpText}
                                          </Typography.Paragraph>
                                        ) : null}
                                        <StorefrontResourcePicker
                                          key={`${definition.id}:${selectedRelease?.id ?? 'none'}`}
                                          disabled={!canWrite}
                                          kind={referenceKind}
                                          label={label}
                                          missing={missing}
                                          releaseId={selectedRelease?.id}
                                          selected={
                                            selectedResource
                                              ? {
                                                  id: selectedResource.id,
                                                  kind: selectedResource.kind,
                                                  name: selectedResource.label,
                                                  path: selectedResource.path,
                                                }
                                              : undefined
                                          }
                                          value={selectedId}
                                          onChange={(next) => {
                                            if (
                                              referenceKind === 'product' ||
                                              referenceKind === 'collection'
                                            ) {
                                              setCatalogBinding(
                                                section.id,
                                                definition.id,
                                                referenceKind,
                                                next
                                              )
                                            } else {
                                              updateSection(template.id, section.id, (current) => {
                                                if (next) {
                                                  current.settings[definition.id] = {
                                                    id: next,
                                                    kind: referenceKind,
                                                  }
                                                } else {
                                                  delete current.settings[definition.id]
                                                }
                                              })
                                            }
                                          }}
                                        />
                                      </div>
                                    )
                                  }
                                  if (definition.kind === 'asset') {
                                    const assetValue =
                                      typeof value === 'object' &&
                                      value !== null &&
                                      'kind' in value &&
                                      (value.kind === 'theme' ||
                                        value.kind === 'remote' ||
                                        value.kind === 'catalog')
                                        ? (value as AssetReference)
                                        : definition.default
                                    return (
                                      <CatalogMediaPicker
                                        key={definition.id}
                                        defaultValue={definition.default}
                                        disabled={!canWrite || !canReadCatalog}
                                        label={label}
                                        value={assetValue}
                                        onChange={(next) =>
                                          updateSection(template.id, section.id, (current) => {
                                            current.settings[definition.id] = next
                                          })
                                        }
                                      />
                                    )
                                  }
                                  if (definition.kind === 'link') {
                                    const currentLink =
                                      typeof value === 'object' &&
                                      value !== null &&
                                      'label' in value &&
                                      'target' in value &&
                                      'targetBehavior' in value
                                        ? (value as StorefrontLink)
                                        : definition.default
                                    const firstAllowedResource = editorResources.find((resource) =>
                                      definition.allowedTargets.includes(resource.kind)
                                    )
                                    const initialLink: StorefrontLink | undefined =
                                      currentLink ??
                                      (firstAllowedResource
                                        ? {
                                            label: definition.label ?? definition.id,
                                            target: {
                                              kind: 'internal',
                                              reference: {
                                                id: firstAllowedResource.id,
                                                kind: firstAllowedResource.kind,
                                              },
                                            },
                                            targetBehavior: 'same-window',
                                          }
                                        : definition.allowedTargets.includes('external')
                                          ? {
                                              label: definition.label ?? definition.id,
                                              target: { kind: 'external', url: 'https://' },
                                              targetBehavior: 'new-window',
                                            }
                                          : undefined)
                                    return (
                                      <React.Fragment key={definition.id}>
                                        {initialLink ? (
                                          <StorefrontLinkEditor
                                            allowedTargets={[...definition.allowedTargets]}
                                            disabled={!canWrite}
                                            label={label}
                                            resources={editorResources}
                                            value={initialLink}
                                            onChange={(next) =>
                                              updateSection(template.id, section.id, (current) => {
                                                current.settings[definition.id] = next
                                              })
                                            }
                                          />
                                        ) : (
                                          <Alert
                                            type="warning"
                                            showIcon
                                            title={t(
                                              'No approved destination is available for {id}.',
                                              {
                                                id: definition.label ?? definition.id,
                                              }
                                            )}
                                          />
                                        )}
                                      </React.Fragment>
                                    )
                                  }
                                  return null
                                })}
                              </div>
                            </>
                          ) : null}
                          {section.blocks.length > 0 ? (
                            <Collapse
                              className="mt-4"
                              size="small"
                              items={[
                                {
                                  key: 'blocks',
                                  label: t('{count} bounded blocks', {
                                    count: section.blocks.length,
                                  }),
                                  children: section.blocks.map((block) => (
                                    <div key={block.id}>
                                      {block.id} · {block.type}
                                    </div>
                                  )),
                                },
                              ]}
                            />
                          ) : null}
                        </Card>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ),
          }))}
        />
      </section>

      <Card title={t('Validation')}>
        {currentValidation ? (
          <div
            ref={validationSummaryRef}
            aria-labelledby="experience-validation-summary-heading"
            className="w-full rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            tabIndex={currentValidation.status === 'invalid' ? -1 : undefined}
          >
            <Space>
              <Tag color={validationCurrent ? 'success' : 'warning'}>
                {currentValidation.status}
              </Tag>
              <span id="experience-validation-summary-heading">
                {t('Validation')} {currentValidation.id} · {t('draft')} v
                {currentValidation.draftVersion}
              </span>
            </Space>
            <div className="mt-3 space-y-2">
              {currentValidation.issues.map((issue) => {
                const { instanceId, settingId } = resolveValidationFieldPath(issue)
                const template =
                  templates.find(({ id }) => id === issue.templateId) ??
                  templates.find((candidate) =>
                    candidate.sections.some(({ id }) => id === instanceId)
                  )
                const targetId =
                  template && instanceId && settingId
                    ? experienceFieldId(template.id, instanceId, settingId)
                    : undefined
                const location = [template?.pageType, instanceId, settingId]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <Alert
                    key={`${issue.code}-${issue.path ?? issue.templateId ?? ''}-${issue.instanceId ?? ''}`}
                    type="error"
                    showIcon
                    title={issue.code}
                    description={
                      <Space orientation="vertical" size={2}>
                        <span>{issue.message}</span>
                        {targetId ? (
                          <a
                            href={`#${targetId}`}
                            onClick={(event) => {
                              event.preventDefault()
                              const target = document.getElementById(targetId)
                              if (target) {
                                target.focus()
                              } else {
                                setActiveTemplateId(template!.id)
                                window.setTimeout(
                                  () => document.getElementById(targetId)?.focus(),
                                  0
                                )
                              }
                            }}
                          >
                            {t('Review affected field')}: {location}
                          </a>
                        ) : null}
                      </Space>
                    }
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <Typography.Text type="secondary">
            {t('Save and validate the exact draft version before preview or approval.')}
          </Typography.Text>
        )}
      </Card>

      <Card title={t('Package upgrade assessment')}>
        {upgradeCandidates.length === 0 ? (
          <Typography.Text type="secondary">
            {t('No alternative approved version of this theme package is currently compatible.')}
          </Typography.Text>
        ) : (
          <Space orientation="vertical" className="w-full">
            <Space wrap>
              <Select
                aria-label={t('Target theme version')}
                className="min-w-64"
                value={upgradeThemeKey}
                options={upgradeCandidates.map((candidate) => ({
                  label: `${candidate.themeVersion} · schema ${candidate.configurationSchemaVersion}`,
                  value: `${candidate.id}@${candidate.themeVersion}@${candidate.configurationSchemaVersion}`,
                }))}
                onChange={(value) => {
                  setUpgradeThemeKey(value)
                  setMigration(null)
                }}
              />
              <Button
                disabled={!canWrite || dirty || !upgradeTheme || !reasonReady}
                onClick={() =>
                  void runAction(async () => {
                    if (!upgradeTheme) return
                    setMigration(
                      await dryRunStorefrontExperienceMigration(draft, upgradeTheme, changeReason)
                    )
                  })
                }
              >
                {t('Assess upgrade conflicts')}
              </Button>
            </Space>
            {migration ? (
              <>
                <Tag color={migration.conflicts.length === 0 ? 'success' : 'warning'}>
                  {migration.conflicts.length === 0
                    ? t('Migration-ready')
                    : t('{count} conflicts', { count: migration.conflicts.length })}
                </Tag>
                <Typography.Text code>{migration.id}</Typography.Text>
                {migration.conflicts.length === 0 ? (
                  <Button
                    type="primary"
                    disabled={!canApprove || dirty || !reasonReady || busy}
                    onClick={() =>
                      void runAction(async () => {
                        const successor = await createStorefrontExperienceMigrationSuccessor(
                          draft,
                          migration,
                          changeReason
                        )
                        successorFocusTarget.current = successor.id
                        setLoading(true)
                        setMigration(null)
                        void message.success(
                          t('Successor draft {id} created for review.', { id: successor.id })
                        )
                        navigate(`/storefront/themes/${successor.id}`, { replace: true })
                      })
                    }
                  >
                    {t('Create migration successor')}
                  </Button>
                ) : null}
                {migration.conflicts.map((conflict) => (
                  <Alert
                    key={`${conflict.code}-${conflict.templateId ?? ''}-${conflict.instanceId ?? ''}`}
                    type="warning"
                    showIcon
                    title={conflict.code}
                    description={conflict.message}
                  />
                ))}
              </>
            ) : null}
          </Space>
        )}
      </Card>

      <Card
        title={t('Private preview artifact')}
        extra={<Tag color={status.color}>{t(status.label)}</Tag>}
      >
        <Space orientation="vertical" className="w-full">
          {build ? (
            <Descriptions size="small" column={{ xs: 1, lg: 3 }}>
              <Descriptions.Item label={t('Build')}>
                <Typography.Text className="break-all">{build.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('Attempt')}>{build.attempt}</Descriptions.Item>
              <Descriptions.Item label={t('Snapshot')}>
                <Typography.Text className="break-all">{build.snapshotId}</Typography.Text>
              </Descriptions.Item>
              {previewSnapshot?.id === build.snapshotId ? (
                <Descriptions.Item label={t('Content digest')}>
                  <Typography.Text className="break-all">
                    {previewSnapshot.contentDigest}
                  </Typography.Text>
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('Catalog Release')}>
                {build.inputIdentity?.catalogReleaseId ?? t('None')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Experience version')}>
                {build.inputIdentity?.experienceVersion ?? t('Unknown')}
              </Descriptions.Item>
              <Descriptions.Item label={t('Theme version')}>
                {build.inputIdentity?.themeVersion ?? draft.themeVersion}
              </Descriptions.Item>
              {build.failureCode ? (
                <Descriptions.Item label={t('Failure')}>{build.failureCode}</Descriptions.Item>
              ) : null}
              {build.expiresAt ? (
                <Descriptions.Item label={t('Expires')}>{build.expiresAt}</Descriptions.Item>
              ) : null}
            </Descriptions>
          ) : (
            <Typography.Text type="secondary">
              {t('No preview has been requested for this editor session.')}
            </Typography.Text>
          )}
          {previewContextCurrent && previewSnapshot ? (
            <Button
              ref={previewLaunchRef}
              icon={<EyeOutlined aria-hidden />}
              disabled={!previewOrigin || busy || revokedPreviewSnapshotId === previewSnapshot.id}
              onClick={() =>
                void runAction(async () => {
                  if (!previewOrigin)
                    throw new Error(t('The private preview origin is not configured.'))
                  const releaseId = selectedReleaseId
                  if (!previewContextCurrent || selectedReleaseIdRef.current !== releaseId) {
                    throw new Error(t('The deployed preview no longer matches this draft context.'))
                  }
                  const grant = await createStorefrontPreviewGrant(
                    previewSnapshot.id,
                    previewOrigin,
                    changeReason,
                    releaseId || undefined
                  )
                  if (selectedReleaseIdRef.current !== releaseId) return
                  submitPreviewGrant(grant)
                })
              }
            >
              {t('Open authenticated preview')}
            </Button>
          ) : null}
          {previewContextCurrent && previewSnapshot ? (
            <Button
              danger
              disabled={busy || revokedPreviewSnapshotId === previewSnapshot.id}
              onClick={() =>
                void runAction(async () => {
                  const releaseId = selectedReleaseId
                  if (selectedReleaseIdRef.current !== releaseId) return
                  await revokeStorefrontPreviewAccess(previewSnapshot.id, changeReason)
                  if (selectedReleaseIdRef.current !== releaseId) return
                  setRevokedPreviewSnapshotId(previewSnapshot.id)
                })
              }
            >
              {t('Revoke preview access')}
            </Button>
          ) : null}
          {revokedPreviewSnapshotId === previewSnapshot?.id ? (
            <Alert type="success" showIcon title={t('Preview access revoked')} />
          ) : null}
          {!previewOrigin ? (
            <Alert
              type="warning"
              showIcon
              title={t('Private preview origin is not configured')}
              description={t(
                'Provision PUBLIC_PREVIEW_ORIGIN for this admin environment before opening an artifact.'
              )}
            />
          ) : null}
          {build && ['failed', 'expired'].includes(build.status) ? (
            <Button
              icon={<ReloadOutlined aria-hidden />}
              disabled={
                busy ||
                dirty ||
                !validationCurrent ||
                !reasonReady ||
                (requiresCatalogRelease && !selectedReleaseId)
              }
              onClick={() =>
                void runAction(async () => {
                  const releaseId = selectedReleaseId
                  await startPreview(draft, changeReason, releaseId)
                })
              }
            >
              {t('Retry preview')}
            </Button>
          ) : null}
          {['pending', 'building'].includes(build?.status ?? '') ? (
            <Space>
              <Spin size="small" />
              <span>
                {t('Polling the immutable artifact build without locking the draft editor.')}
              </span>
            </Space>
          ) : null}
        </Space>
      </Card>

      {canApprove ? (
        <Card title={t('Approve immutable experience snapshot')}>
          <Space orientation="vertical" className="w-full">
            <Alert
              type="warning"
              showIcon
              title={t('Approval does not activate the production storefront theme')}
              description={t(
                'It records an immutable, audited snapshot for this exact validated draft version.'
              )}
            />
            <Input.TextArea
              aria-label={t('Approval reason')}
              placeholder={t('Why is this exact version approved?')}
              value={approvalReason}
              maxLength={500}
              rows={2}
              onChange={(event) => setApprovalReason(event.target.value)}
            />
            <Button
              type="primary"
              icon={<CheckCircleOutlined aria-hidden />}
              disabled={
                dirty ||
                !validationCurrent ||
                !previewContextCurrent ||
                approvalReason.trim().length < 3 ||
                busy
              }
              onClick={() =>
                void runAction(async () => {
                  const releaseId = selectedReleaseId
                  if (selectedReleaseIdRef.current !== releaseId || !previewContextCurrent) return
                  const snapshot = await approveStorefrontExperienceDraft(
                    draft.id,
                    draft.version,
                    approvalReason,
                    releaseId || undefined
                  )
                  if (selectedReleaseIdRef.current !== releaseId) return
                  setApprovedSnapshot(snapshot)
                  if (operatorRun) {
                    setOperatorRun(null)
                    try {
                      setOperatorRun(await fetchFashionStagingOperatorRun(draft.id))
                    } catch {
                      // The immutable approval remains authoritative; a reload can retry this read.
                    }
                  }
                  void message.success(t('Immutable experience snapshot approved and audited.'))
                })
              }
            >
              {t('Approve exact draft v{version}', { version: draft.version })}
            </Button>
            {approvedSnapshot ? (
              <Alert
                type="success"
                showIcon
                title={t('Immutable snapshot approved')}
                description={t('{id} · source draft v{version} · audit succeeded', {
                  id: approvedSnapshot.id,
                  version: approvedSnapshot.sourceDraftVersion,
                })}
              />
            ) : null}
          </Space>
        </Card>
      ) : null}
    </main>
  )
}
