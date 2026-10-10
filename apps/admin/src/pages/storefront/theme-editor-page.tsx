import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type {
  AdminStorefrontTheme,
  AssetReference,
  BlockDefinition,
  ExperienceResourceBinding,
  PageTemplate,
  SectionDefinition,
  SectionInstance,
  StorefrontLink,
  StorefrontResourceReference,
  ThemeOverride,
  ThemeOverrideOperation,
  StorefrontExperienceBlockCommand,
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
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  approveStorefrontExperienceDraft,
  applyStorefrontExperienceBlockCommand,
  createStorefrontExperienceSuccessor,
  createStorefrontExperienceMigrationSuccessor,
  createStorefrontPreviewGrant,
  dryRunStorefrontExperienceMigration,
  fetchStorefrontExperienceDraft,
  fetchFashionStagingOperatorRun,
  fetchStorefrontCatalogCandidate,
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
import { buildCatalogPreviewCandidate } from '../../services/catalog/api'
import { QueryStateBlock } from '../../shared/components/query-state-block'
import { SortActionGroup } from '../../shared/components/sort-action-group'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import {
  LocalThemeError,
  localThemeMessages,
  localizeThemeError,
  themeErrorCode,
  themeDiagnosticMessage,
  validationStatusMessage,
  type ThemeMessage,
} from './theme-feedback'
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
type SectionVisibilityError = {
  sectionId: string
  templateId: string
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
      } else if (operation.kind === 'add-block') {
        const section = template.sections.find(({ id }) => id === operation.sectionId)
        if (section && !section.blocks.some(({ id }) => id === operation.block.id)) {
          section.blocks.push(structuredClone(operation.block))
        }
      } else if (operation.kind === 'remove-block') {
        for (const section of template.sections) {
          section.blocks = section.blocks.filter(({ id }) => id !== operation.instanceId)
        }
      } else if (operation.kind === 'reorder-blocks') {
        const section = template.sections.find(({ id }) => id === operation.sectionId)
        if (section) {
          const byId = new Map(section.blocks.map((block) => [block.id, block]))
          section.blocks = operation.instanceIds
            .map((id) => byId.get(id))
            .filter((block): block is SectionInstance['blocks'][number] => Boolean(block))
        }
      } else {
        const section = template.sections.find(
          ({ id, blocks }) =>
            id === operation.instanceId || blocks.some((block) => block.id === operation.instanceId)
        )
        const instance =
          section?.id === operation.instanceId
            ? section
            : section?.blocks.find(({ id }) => id === operation.instanceId)
        const presetSection = presetTemplate?.sections.find(
          ({ id, blocks }) =>
            id === operation.instanceId || blocks.some((block) => block.id === operation.instanceId)
        )
        const presetInstance =
          presetSection?.id === operation.instanceId
            ? presetSection
            : presetSection?.blocks.find(({ id }) => id === operation.instanceId)
        if (!instance) continue
        if (operation.kind === 'set-visibility') {
          instance.visible = operation.visible
        }
        if (operation.kind === 'set-setting') {
          instance.settings[operation.settingId] = structuredClone(operation.value)
        }
        if (operation.kind === 'reset-setting') {
          if (presetInstance && operation.settingId in presetInstance.settings) {
            instance.settings[operation.settingId] = structuredClone(
              presetInstance.settings[operation.settingId]
            )
          } else {
            delete instance.settings[operation.settingId]
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
      const baseBlocks = new Map(baseSection.blocks.map((block) => [block.id, block]))
      const currentBlocks = new Map(section.blocks.map((block) => [block.id, block]))
      for (const baseBlock of baseSection.blocks) {
        if (!currentBlocks.has(baseBlock.id)) {
          operations.push({ instanceId: baseBlock.id, kind: 'remove-block' })
        }
      }
      for (const block of section.blocks) {
        const baseBlock = baseBlocks.get(block.id)
        if (!baseBlock) {
          operations.push({
            block: structuredClone(block),
            kind: 'add-block',
            sectionId: section.id,
          })
          continue
        }
        if (block.visible !== baseBlock.visible) {
          operations.push({
            instanceId: block.id,
            kind: 'set-visibility',
            visible: block.visible,
          })
        }
        for (const settingId of new Set([
          ...Object.keys(baseBlock.settings),
          ...Object.keys(block.settings),
        ])) {
          if (equalValue(block.settings[settingId], baseBlock.settings[settingId])) continue
          if (block.settings[settingId] === undefined) {
            operations.push({ instanceId: block.id, kind: 'reset-setting', settingId })
          } else {
            operations.push({
              instanceId: block.id,
              kind: 'set-setting',
              settingId,
              value: structuredClone(block.settings[settingId]),
            })
          }
        }
      }
      const blockOrder = section.blocks.map(({ id }) => id)
      if (
        !equalValue(
          blockOrder,
          baseSection.blocks.map(({ id }) => id)
        )
      ) {
        operations.push({ instanceIds: blockOrder, kind: 'reorder-blocks', sectionId: section.id })
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
      return { color: 'success', label: 'Ready to preview' }
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

const blockDefinitionFor = (
  theme: AdminStorefrontTheme,
  blockType: string
): BlockDefinition | undefined =>
  theme.componentRegistry.blocks.find(({ type }) => type === blockType)

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
  const [searchParams] = useSearchParams()
  const guideSearch = searchParams.get('from') === 'setup-guide' ? '?from=setup-guide' : ''
  const { t } = useI18n()
  const currentT = useCurrentTranslate()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const canPreview = hasPermission(role, 'themes.preview', permissions)
  const canReadCatalog = hasPermission(role, 'catalog.read', permissions)
  const canReadCandidate = (
    [
      'catalog.read',
      'identity.read',
      'policies.read',
      'content.read',
      'navigation.read',
      'settings.read',
    ] as const
  ).every((permission) => hasPermission(role, permission, permissions))
  const canPrepareCandidate =
    canReadCandidate && hasPermission(role, 'catalog.publish', permissions)
  const canReadIdentity = hasPermission(role, 'identity.read', permissions)
  const canReadPolicies = hasPermission(role, 'policies.read', permissions)
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
  const [catalogReleasesError, setCatalogReleasesError] = useState<Error | null>(null)
  const [candidateHandoffWarning, setCandidateHandoffWarning] = useState<Error | null>(null)
  const [catalogReleasesRetry, setCatalogReleasesRetry] = useState(0)
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    () => window.sessionStorage.getItem('storefront-editor-catalog-release') ?? ''
  )
  const selectedReleaseIdRef = useRef(selectedReleaseId)
  const [activeTemplateId, setActiveTemplateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [previewActionFailed, setPreviewActionFailed] = useState(false)
  const [changeReason, setChangeReason] = useState('')
  const [migrationApprovalReason, setMigrationApprovalReason] = useState('')
  const [approvalReason, setApprovalReason] = useState('')
  const [sectionMoveStatus, setSectionMoveStatus] = useState<ThemeMessage | null>(null)
  const [sectionVisibilityError, setSectionVisibilityError] =
    useState<SectionVisibilityError | null>(null)
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
  const requestedPreviewContext = useRef<{
    draftId: string
    version: number
    releaseId: string
  } | null>(null)
  const previewActionBusy = useRef(false)
  const conflictActionRef = useRef<HTMLButtonElement>(null)
  const previewLaunchRef = useRef<HTMLButtonElement>(null)
  const draftHeadingRef = useRef<HTMLHeadingElement>(null)
  const successorFocusTarget = useRef<string | null>(null)
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const blockFocusTarget = useRef<string | null>(null)
  const sectionVisibilityErrorRef = useRef<HTMLDivElement>(null)
  const dirty = useMemo(
    () => !equalValue(templates, savedTemplates) || !equalValue(bindings, savedBindings),
    [bindings, savedBindings, savedTemplates, templates]
  )
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!draft?.id || draft.id === draftId || dirty) return
    navigate(`/storefront/themes/${draft.id}${guideSearch}`, { replace: true })
  }, [draft?.id, draftId, dirty, guideSearch, navigate])

  useEffect(() => {
    if (!conflict) return
    const frame = window.requestAnimationFrame(() => conflictActionRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [conflict])

  useEffect(() => {
    if (!sectionVisibilityError) return
    const frame = window.requestAnimationFrame(() => sectionVisibilityErrorRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [sectionVisibilityError])

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

  useEffect(() => {
    const target = blockFocusTarget.current
    if (!target) return
    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-block-focus="${CSS.escape(target)}"]`
      )
      if (!element) return
      element.focus()
      blockFocusTarget.current = null
    }, 500)
    return () => window.clearTimeout(timer)
  }, [templates])

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    if (!draftId) {
      setError(new LocalThemeError(localThemeMessages.missingDraft))
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
      if (!nextTheme) throw new LocalThemeError(localThemeMessages.missingTheme)
      if (request !== loadRequest.current) return
      const nextTemplates = resolveDraftTemplates(nextTheme, nextDraft)
      setDraft(nextDraft)
      setOperatorRun(nextOperatorRun)
      setTheme(nextTheme)
      setAvailableThemes(themes)
      setTemplates(nextTemplates)
      setSectionVisibilityError(null)
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
      requestedPreviewContext.current = null
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
      setError(cause instanceof LocalThemeError ? cause : normalizeApiError(cause))
    } finally {
      if (request === loadRequest.current) setLoading(false)
    }
  }, [draftId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      loadRequest.current += 1
    }
  }, [load])

  useEffect(() => {
    if (draft?.themeId !== 'fashion-store') return
    const privateId = window.sessionStorage.getItem('storefront-editor-private-candidate')
    const privateAccessLost = Boolean(privateId && !canReadCandidate)
    if (privateAccessLost) {
      window.sessionStorage.removeItem('storefront-editor-private-candidate')
      window.sessionStorage.removeItem('storefront-editor-catalog-release')
      selectedReleaseIdRef.current = ''
      setSelectedReleaseId('')
      previewContextRequest.current += 1
      setBuild(null)
      setPreviewSnapshot(null)
      setCandidateHandoffWarning(new LocalThemeError(localThemeMessages.candidateAccess))
    }
    if (!canPreview || !canReadCatalog) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setCatalogReleasesLoading(true)
      setCatalogReleasesError(null)
      if (!privateAccessLost) setCandidateHandoffWarning(null)
      const handedOffCandidate = window.sessionStorage.getItem('storefront-editor-catalog-release')
      const privateCandidateHandoff = window.sessionStorage.getItem(
        'storefront-editor-private-candidate'
      )
      let invalidPrivateCandidate = privateAccessLost
      void fetchStorefrontCatalogReleases()
        .then(async (deployed) => {
          if (
            !handedOffCandidate ||
            privateCandidateHandoff !== handedOffCandidate ||
            !canReadCandidate
          ) {
            return deployed
          }
          if (deployed.some(({ id }) => id === handedOffCandidate)) {
            window.sessionStorage.removeItem('storefront-editor-private-candidate')
            return deployed
          }
          try {
            const candidate = await fetchStorefrontCatalogCandidate(handedOffCandidate)
            return [candidate, ...deployed]
          } catch (cause) {
            if (cancelled) return deployed
            invalidPrivateCandidate = true
            selectedReleaseIdRef.current = ''
            setSelectedReleaseId('')
            previewContextRequest.current += 1
            setBuild(null)
            setPreviewSnapshot(null)
            window.sessionStorage.removeItem('storefront-editor-private-candidate')
            window.sessionStorage.removeItem('storefront-editor-catalog-release')
            if (!cancelled) setCandidateHandoffWarning(normalizeApiError(cause))
            return deployed
          }
        })
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
              (invalidPrivateCandidate
                ? ''
                : releases.some(({ id }) => id === current)
                  ? current
                  : (releases[0]?.id ?? ''))
            selectedReleaseIdRef.current = next
            return next
          })
        })
        .catch((cause) => {
          if (!cancelled) setCatalogReleasesError(normalizeApiError(cause))
        })
        .finally(() => {
          if (!cancelled) setCatalogReleasesLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    canPreview,
    canReadCatalog,
    canReadCandidate,
    catalogReleasesRetry,
    draft?.themeId,
    operatorRun,
  ])

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
        if (!cancelled) setError(normalizeApiError(cause))
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
    if (loading || !hydratedDraftId || !hydratedDraftVersion || !canPreview) return
    if (selectedRelease?.status === 'private-preview' && !canReadCandidate) return
    if (requiresCatalogRelease && (!canReadCatalog || !selectedReleaseAvailable)) return
    const releaseId = requiresCatalogRelease ? selectedReleaseId : ''
    const requested = requestedPreviewContext.current
    if (
      requested?.draftId === hydratedDraftId &&
      requested.version === hydratedDraftVersion &&
      requested.releaseId === releaseId
    )
      return
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
          setError(normalizeApiError(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    loading,
    canPreview,
    canReadCatalog,
    canReadCandidate,
    selectedRelease?.status,
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

  const setSectionVisibility = (templateId: string, sectionId: string, visible: boolean) => {
    const template = templates.find(({ id }) => id === templateId)
    if (!template) return
    const hideableSections = template.sections.filter(
      (section) => !requiredSection(template, section)
    )
    const hidesFinalContent =
      template.pageType === 'home' &&
      !visible &&
      hideableSections.some(({ id }) => id === sectionId) &&
      hideableSections.every((section) => section.id === sectionId || !section.visible)
    if (hidesFinalContent) {
      setSectionVisibilityError({ sectionId, templateId })
      return
    }
    setSectionVisibilityError(null)
    updateSection(templateId, sectionId, (section) => {
      section.visible = visible
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
      setSectionMoveStatus({
        message: '{id} moved to position {position} of {count} on {pageType}.',
        values: {
          id: section.id,
          position: target + 1,
          count: template.sections.length,
          pageType: template.pageType,
        },
      })
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
    setSectionVisibilityError(null)
    updateSection(templateId, sectionId, (section) => {
      section.settings = structuredClone(original.settings)
      section.visible = original.visible
    })
  }

  const runBlockCommand = async (command: StorefrontExperienceBlockCommand) => {
    if (!draft || !theme || !canWrite || dirty) return
    setBusy(true)
    if (command.kind === 'remove') {
      const section = templates
        .flatMap(({ sections }) => sections)
        .find(({ blocks }) => blocks.some(({ id }) => id === command.blockId))
      const index = section?.blocks.findIndex(({ id }) => id === command.blockId) ?? -1
      blockFocusTarget.current = section
        ? (section.blocks[index + 1]?.id ??
          section.blocks[index - 1]?.id ??
          `section:${section.id}`)
        : null
    }
    try {
      const updated = await applyStorefrontExperienceBlockCommand(
        draft,
        command,
        changeReason,
        selectedReleaseId || undefined
      )
      const nextTemplates = resolveDraftTemplates(theme, updated)
      setDraft(updated)
      setTemplates(nextTemplates)
      setSavedTemplates(cloneTemplates(nextTemplates))
      setBindings(structuredClone(updated.bindings))
      setSavedBindings(structuredClone(updated.bindings))
      setChangeReason('')
      message.success(currentT('Block command saved.'))
    } catch (cause) {
      blockFocusTarget.current = null
      const apiError = normalizeApiError(cause)
      if (apiError.status === 409) setConflict({ bindings, draft, overrides: draft.overrides })
      setError(apiError)
    } finally {
      setBusy(false)
    }
  }

  const save = async (reason: string): Promise<StorefrontExperienceDraft> => {
    if (!draft || !theme) throw new LocalThemeError(localThemeMessages.unloadedDraft)
    if (!dirty) return draft
    if (!canWrite) throw new LocalThemeError(localThemeMessages.readOnlyValidation)
    const request = loadRequest.current
    const overrides = createThemeOverrides(theme, draft, templates)
    let updated: StorefrontExperienceDraft
    try {
      updated = await updateStorefrontExperienceDraft(draft, overrides, reason, bindings)
    } catch (cause) {
      const apiError = normalizeApiError(cause)
      if (request === loadRequest.current && apiError.status === 409) {
        setConflict({
          bindings: structuredClone(bindings),
          draft: structuredClone(draft),
          overrides: structuredClone(overrides),
        })
      }
      throw apiError
    }
    if (request !== loadRequest.current) return updated
    setDraft(updated)
    setSavedTemplates(cloneTemplates(templates))
    setBindings(structuredClone(updated.bindings))
    setSavedBindings(structuredClone(updated.bindings))
    return updated
  }

  const validate = async (target: StorefrontExperienceDraft, reason: string, releaseId: string) => {
    if (!canWrite || selectedReleaseIdRef.current !== releaseId) return null
    const request = loadRequest.current
    const validation = await validateStorefrontExperienceDraft(
      target.id,
      target.version,
      reason,
      releaseId || undefined
    )
    if (request !== loadRequest.current || selectedReleaseIdRef.current !== releaseId) return null
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

  const runAction = async (action: () => Promise<void>, retryPreviewOnFailure = false) => {
    setBusy(true)
    setError(null)
    setPreviewActionFailed(false)
    try {
      await action()
    } catch (cause) {
      setPreviewActionFailed(retryPreviewOnFailure)
      setError(cause instanceof LocalThemeError ? cause : normalizeApiError(cause))
    } finally {
      setBusy(false)
    }
  }

  const sourceFailureCode = themeErrorCode(error)
  const sourceRecovery =
    sourceFailureCode === 'catalog_identity_unpublished' && canReadIdentity
      ? { path: '/settings/identity', label: t('Open store details') }
      : sourceFailureCode === 'catalog_products_unpublished' && canReadCatalog
        ? { path: '/catalog/products', label: t('Open products') }
        : sourceFailureCode === 'catalog_required_policies_unpublished' && canReadPolicies
          ? { path: '/settings/policies', label: t('Open policies') }
          : null
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
      throw new LocalThemeError(localThemeMessages.missingRelease)
    }
    const request = ++previewContextRequest.current
    const resolution = await previewStorefrontExperienceDraft(
      target.id,
      target.version,
      reason,
      releaseId || undefined
    )
    if (request !== previewContextRequest.current || selectedReleaseIdRef.current !== releaseId)
      return false
    setPreviewSnapshot(resolution.snapshot)
    setRevokedPreviewSnapshotId(null)
    setBuild(resolution.build)
    return true
  }

  const previewStore = async () => {
    if (!canPreview || previewActionBusy.current) return
    previewActionBusy.current = true
    try {
      await runAction(async () => {
        const request = loadRequest.current
        let saved: StorefrontExperienceDraft
        try {
          saved = await save(changeReason)
        } catch (cause) {
          if (request !== loadRequest.current) return
          throw cause
        }
        if (request !== loadRequest.current) return
        let releaseId = selectedReleaseIdRef.current
        const frozenRun =
          operatorRun && ['awaiting_operator', 'approved'].includes(operatorRun.status)
        if (requiresCatalogRelease && canWrite && canPrepareCandidate && !frozenRun) {
          const candidate = await buildCatalogPreviewCandidate(changeReason)
          if (request !== loadRequest.current) return
          if (candidate.status !== 'succeeded' || candidate.purpose !== 'private-preview')
            throw new LocalThemeError(localThemeMessages.candidateNotReady)
          const exact = await fetchStorefrontCatalogCandidate(candidate.id)
          if (request !== loadRequest.current) return
          if (
            exact.manifestDigest !== candidate.manifestDigest ||
            exact.sourceDigest !== candidate.sourceDigest
          )
            throw new LocalThemeError(localThemeMessages.candidateNotReady)
          releaseId = exact.id
          requestedPreviewContext.current = { draftId: saved.id, version: saved.version, releaseId }
          selectedReleaseIdRef.current = releaseId
          setSelectedReleaseId(releaseId)
          setCatalogReleases((releases) => [
            exact,
            ...releases.filter(({ id }) => id !== releaseId),
          ])
          window.sessionStorage.setItem('storefront-editor-catalog-release', releaseId)
          window.sessionStorage.setItem('storefront-editor-private-candidate', releaseId)
          setCandidateHandoffWarning(null)
          previewContextRequest.current += 1
          setBuild(null)
          setPreviewSnapshot(null)
          setRevokedPreviewSnapshotId(null)
        }
        if (requiresCatalogRelease && (!canReadCatalog || !releaseId))
          throw new LocalThemeError(localThemeMessages.unavailableSources)
        requestedPreviewContext.current = { draftId: saved.id, version: saved.version, releaseId }
        const validated = canWrite ? await validate(saved, changeReason, releaseId) : saved
        const binding = validated && selectedValidation(validated, releaseId)
        if (!binding || binding.status !== 'valid' || binding.draftVersion !== saved.version) {
          if (!canWrite) throw new LocalThemeError(localThemeMessages.readOnlyValidation)
          return
        }
        if (await startPreview(validated, changeReason, releaseId))
          void message.success(currentT('Store preview requested.'))
      }, true)
    } finally {
      previewActionBusy.current = false
    }
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
        description={localizeThemeError(error, t)}
        primaryActionLabel={t('Reload')}
        onPrimaryAction={() => void load()}
        secondaryActionLabel={t('Back to themes')}
        onSecondaryAction={() => navigate(`/storefront/themes${guideSearch}`)}
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
            onClick={() => navigate(`/storefront/themes${guideSearch}`)}
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
                disabled={!dirty}
                loading={busy}
                onClick={() =>
                  void runAction(async () => {
                    await save(changeReason)
                    void message.success(
                      currentT('Design draft saved. The storefront is unchanged.')
                    )
                  })
                }
              >
                {t('Save')}
              </Button>
            </>
          ) : null}
          {canPreview ? (
            <Button
              type="primary"
              icon={<EyeOutlined aria-hidden />}
              disabled={busy || (requiresCatalogRelease && !canReadCatalog)}
              loading={busy}
              onClick={() => void previewStore()}
            >
              {t('Preview store')}
            </Button>
          ) : null}
        </Space>
      </header>
      {canPreview ? (
        <Typography.Paragraph type="secondary">
          {t(
            'Preview uses the saved design and published sources; content and new product drafts are excluded. Cart, checkout, and orders use the current environment and its transaction rules.'
          )}
        </Typography.Paragraph>
      ) : null}

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
                      currentT('Successor draft {id} created for review.', { id: successor.id })
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
          description={
            <Space orientation="vertical" className="w-full">
              <span>{localizeThemeError(error, t)}</span>
              {previewActionFailed && sourceFailureCode ? (
                <Collapse
                  items={[
                    {
                      key: 'preview-error-details',
                      label: t('Preview error details'),
                      children: (
                        <Descriptions size="small" column={1}>
                          <Descriptions.Item label={t('Error code')}>
                            {sourceFailureCode}
                          </Descriptions.Item>
                        </Descriptions>
                      ),
                    },
                  ]}
                />
              ) : null}
            </Space>
          }
          action={
            <Space wrap>
              {sourceRecovery ? (
                <Link to={`${sourceRecovery.path}${guideSearch}`}>{sourceRecovery.label}</Link>
              ) : null}
              {previewActionFailed ? (
                <Button size="small" disabled={busy} onClick={() => void previewStore()}>
                  {t('Retry preview')}
                </Button>
              ) : (
                <Button
                  size="small"
                  icon={<ReloadOutlined aria-hidden />}
                  onClick={reloadSavedDraft}
                >
                  {t('Reload saved draft')}
                </Button>
              )}
            </Space>
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
                {Object.hasOwn(operatorRunStatusMessages, operatorRun.status)
                  ? t(operatorRunStatusMessages[operatorRun.status])
                  : operatorRun.status}
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

      {candidateHandoffWarning ? (
        <Alert
          type="warning"
          showIcon
          title={t('Private Catalog candidate is no longer available')}
          description={localizeThemeError(candidateHandoffWarning, t)}
        />
      ) : null}
      <Collapse
        items={[
          {
            key: 'preview-details',
            label: t('Preview details'),
            forceRender: true,
            children: (
              <>
                {canWrite ? (
                  <>
                    {' '}
                    <Button
                      disabled={dirty}
                      loading={busy}
                      onClick={() =>
                        void runAction(async () => {
                          const releaseId = selectedReleaseId
                          const validated = await validate(draft, changeReason, releaseId)
                          if (
                            validated &&
                            selectedValidation(validated, releaseId)?.status === 'valid'
                          ) {
                            void message.success(
                              currentT('Draft v{version} is valid.', { version: validated.version })
                            )
                          }
                        })
                      }
                    >
                      {t('Validate saved version')}
                    </Button>
                  </>
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
                  <Descriptions.Item label={t('Resource bindings')}>
                    {bindings.length}
                  </Descriptions.Item>
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
                        description={localizeThemeError(catalogReleasesError, t)}
                        action={
                          <Button
                            size="small"
                            onClick={() => setCatalogReleasesRetry((value) => value + 1)}
                          >
                            {t('Retry Catalog Releases')}
                          </Button>
                        }
                      />
                    ) : catalogReleases.length === 0 ? (
                      <Alert
                        type="info"
                        showIcon
                        title={t(
                          'No deployed canonical Catalog Release is available in this environment.'
                        )}
                      />
                    ) : (
                      <Space orientation="vertical" className="w-full">
                        <Select
                          aria-label={t('Catalog Release')}
                          className="w-full"
                          disabled={
                            busy ||
                            Boolean(
                              operatorRun &&
                              ['awaiting_operator', 'approved'].includes(operatorRun.status)
                            )
                          }
                          value={selectedReleaseId || undefined}
                          options={catalogReleases.map((release) => ({
                            label: `${release.id} · ${release.environment} · ${release.deployedAt ?? release.approvedAt}`,
                            value: release.id,
                          }))}
                          onChange={(value) => {
                            window.sessionStorage.removeItem('storefront-editor-private-candidate')
                            requestedPreviewContext.current = null
                            selectedReleaseIdRef.current = value
                            setSelectedReleaseId(value)
                            window.sessionStorage.setItem(
                              'storefront-editor-catalog-release',
                              value
                            )
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
              </>
            ),
          },
        ]}
      />

      <Card
        title={t('Notes (optional)')}
        extra={
          <Typography.Text type="secondary">
            {t('Optional for draft and preview actions')}
          </Typography.Text>
        }
      >
        <Input.TextArea
          aria-label={t('Notes (optional)')}
          data-testid="change-reason"
          placeholder={t('Notes (optional)')}
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
        <div className="sr-only" role="status">
          {sectionMoveStatus ? t(sectionMoveStatus.message, sectionMoveStatus.values) : null}
        </div>
        <Tabs
          activeKey={activeTemplate.id}
          onChange={setActiveTemplateId}
          items={templates.map((template) => ({
            key: template.id,
            label: template.pageType,
            children: (
              <div className="space-y-4">
                <ol className="space-y-3">
                  {template.sections.map((section, index) => {
                    const isRequired = requiredSection(template, section)
                    const sectionDefinition = theme.componentRegistry.sections.find(
                      ({ type }) => type === section.type
                    )
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
                          {sectionVisibilityError?.templateId === template.id &&
                          sectionVisibilityError.sectionId === section.id ? (
                            <div ref={sectionVisibilityErrorRef} className="mb-3" tabIndex={-1}>
                              <Alert
                                type="error"
                                showIcon
                                title={t('At least one Home content Section must remain visible.')}
                              />
                            </div>
                          ) : null}
                          <Space wrap>
                            <span>
                              {t('Visible')}{' '}
                              <Switch
                                aria-label={t('Show {id}', { id: section.id })}
                                checked={section.visible}
                                disabled={!canWrite || isRequired}
                                onChange={(visible) =>
                                  setSectionVisibility(template.id, section.id, visible)
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
                          {section.blocks.length > 0 ||
                          (sectionDefinition?.allowedBlockTypes.length ?? 0) > 0 ? (
                            <div
                              data-block-focus={`section:${section.id}`}
                              data-testid={`blocks-${section.id}`}
                              tabIndex={-1}
                            >
                              <Collapse
                                className="mt-4"
                                size="small"
                                items={[
                                  {
                                    key: 'blocks',
                                    label: t('{count} bounded blocks', {
                                      count: section.blocks.length,
                                    }),
                                    children: (
                                      <div className="space-y-3">
                                        {(sectionDefinition?.allowedBlockTypes ?? []).map(
                                          (blockType) => {
                                            const blockDefinition = blockDefinitionFor(
                                              theme,
                                              blockType
                                            )
                                            if (!blockDefinition) return null
                                            const defaults = Object.fromEntries(
                                              blockDefinition.settings.flatMap((setting) =>
                                                'default' in setting &&
                                                setting.default !== undefined
                                                  ? [[setting.id, structuredClone(setting.default)]]
                                                  : []
                                              )
                                            ) as Extract<
                                              StorefrontExperienceBlockCommand,
                                              { kind: 'add' }
                                            >['settings']
                                            return (
                                              <Button
                                                key={blockType}
                                                data-block-focus={`add:${section.id}`}
                                                icon={<PlusOutlined aria-hidden />}
                                                disabled={!canWrite || busy || dirty}
                                                onClick={() =>
                                                  void runBlockCommand({
                                                    kind: 'add',
                                                    templateId: template.id,
                                                    sectionId: section.id,
                                                    blockType,
                                                    settings: defaults,
                                                  })
                                                }
                                              >
                                                {t('Add {id}', { id: blockType })}
                                              </Button>
                                            )
                                          }
                                        )}
                                        {section.blocks.map((block, blockIndex) => {
                                          const blockDefinition = blockDefinitionFor(
                                            theme,
                                            block.type
                                          )
                                          const orderedIds = section.blocks.map(({ id }) => id)
                                          const blockControlsDisabled = !canWrite || busy || dirty
                                          const move = (direction: -1 | 1) => {
                                            const target = blockIndex + direction
                                            if (target < 0 || target >= orderedIds.length) return
                                            const next = [...orderedIds]
                                            ;[next[blockIndex], next[target]] = [
                                              next[target]!,
                                              next[blockIndex]!,
                                            ]
                                            void runBlockCommand({
                                              kind: 'reorder',
                                              templateId: template.id,
                                              sectionId: section.id,
                                              blockIds: next,
                                            })
                                          }
                                          return (
                                            <Card
                                              key={block.id}
                                              data-block-focus={block.id}
                                              tabIndex={-1}
                                              size="small"
                                              title={`${block.id} · ${block.type}`}
                                            >
                                              <Space wrap>
                                                <SortActionGroup
                                                  count={section.blocks.length}
                                                  index={blockIndex}
                                                  disabled={blockControlsDisabled}
                                                  moveUpLabel={t('Move {id} before', {
                                                    id: block.id,
                                                  })}
                                                  moveDownLabel={t('Move {id} after', {
                                                    id: block.id,
                                                  })}
                                                  removeLabel={t('Remove {id}', { id: block.id })}
                                                  removeConfirmTitle={t('Remove this Block?')}
                                                  onMoveUp={() => move(-1)}
                                                  onMoveDown={() => move(1)}
                                                  onRemove={() =>
                                                    void runBlockCommand({
                                                      kind: 'remove',
                                                      templateId: template.id,
                                                      blockId: block.id,
                                                    })
                                                  }
                                                />
                                                <Switch
                                                  aria-label={t('Show {id}', { id: block.id })}
                                                  checked={block.visible}
                                                  disabled={blockControlsDisabled}
                                                  onChange={(visible) =>
                                                    void runBlockCommand({
                                                      kind: 'set-visibility',
                                                      templateId: template.id,
                                                      blockId: block.id,
                                                      visible,
                                                    })
                                                  }
                                                />
                                                <Button
                                                  icon={<CopyOutlined aria-hidden />}
                                                  disabled={blockControlsDisabled}
                                                  onClick={() =>
                                                    void runBlockCommand({
                                                      kind: 'duplicate',
                                                      templateId: template.id,
                                                      blockId: block.id,
                                                    })
                                                  }
                                                >
                                                  {t('Duplicate')}
                                                </Button>
                                              </Space>
                                              <div className="mt-3 space-y-3">
                                                {blockDefinition?.settings.map((setting) => {
                                                  const value = block.settings[setting.id]
                                                  const label = `${block.id} ${setting.label ?? setting.id}`
                                                  if (setting.kind === 'text')
                                                    return (
                                                      <Input
                                                        key={`${block.id}-${setting.id}-${draft.version}`}
                                                        aria-label={label}
                                                        defaultValue={
                                                          typeof value === 'string' ? value : ''
                                                        }
                                                        disabled={blockControlsDisabled}
                                                        onBlur={(event) => {
                                                          if (event.target.value !== value)
                                                            void runBlockCommand({
                                                              kind: 'set-setting',
                                                              templateId: template.id,
                                                              blockId: block.id,
                                                              settingId: setting.id,
                                                              value: event.target.value,
                                                            })
                                                        }}
                                                      />
                                                    )
                                                  if (setting.kind === 'select')
                                                    return (
                                                      <Select
                                                        key={setting.id}
                                                        aria-label={label}
                                                        className="w-full"
                                                        value={
                                                          typeof value === 'string'
                                                            ? value
                                                            : undefined
                                                        }
                                                        options={setting.options.map((option) => ({
                                                          label: option.label,
                                                          value: option.value,
                                                        }))}
                                                        disabled={blockControlsDisabled}
                                                        onChange={(next) =>
                                                          void runBlockCommand({
                                                            kind: 'set-setting',
                                                            templateId: template.id,
                                                            blockId: block.id,
                                                            settingId: setting.id,
                                                            value: next,
                                                          })
                                                        }
                                                      />
                                                    )
                                                  if (
                                                    setting.kind === 'product-reference' ||
                                                    setting.kind === 'collection-reference' ||
                                                    setting.kind === 'page-reference' ||
                                                    setting.kind === 'article-reference' ||
                                                    setting.kind === 'policy-reference'
                                                  ) {
                                                    const referenceKind = setting.kind.replace(
                                                      '-reference',
                                                      ''
                                                    ) as StorefrontResourceReference['kind']
                                                    const selected =
                                                      typeof value === 'object' &&
                                                      value !== null &&
                                                      'kind' in value &&
                                                      value.kind === referenceKind &&
                                                      'id' in value
                                                        ? (value as StorefrontResourceReference)
                                                        : undefined
                                                    const resources = editorResources.filter(
                                                      ({ kind }) => kind === referenceKind
                                                    )
                                                    const selectedResource = resources.find(
                                                      ({ id }) => id === selected?.id
                                                    )
                                                    return (
                                                      <StorefrontResourcePicker
                                                        key={setting.id}
                                                        disabled={blockControlsDisabled}
                                                        kind={referenceKind}
                                                        label={label}
                                                        missing={
                                                          Boolean(selected?.id) && !selectedResource
                                                        }
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
                                                        value={selected?.id}
                                                        onChange={(next) => {
                                                          if (!next) return
                                                          void runBlockCommand({
                                                            blockId: block.id,
                                                            kind: 'set-setting',
                                                            settingId: setting.id,
                                                            templateId: template.id,
                                                            value: {
                                                              id: next,
                                                              kind: referenceKind,
                                                            },
                                                          })
                                                        }}
                                                      />
                                                    )
                                                  }
                                                  if (setting.kind === 'asset') {
                                                    const assetValue =
                                                      typeof value === 'object' &&
                                                      value !== null &&
                                                      'kind' in value &&
                                                      (value.kind === 'theme' ||
                                                        value.kind === 'remote' ||
                                                        value.kind === 'catalog')
                                                        ? (value as AssetReference)
                                                        : setting.default
                                                    const themeOptions = setting.themeOptions ?? []
                                                    return (
                                                      <Select
                                                        key={setting.id}
                                                        disabled={blockControlsDisabled}
                                                        aria-label={label}
                                                        options={themeOptions.map((option) => ({
                                                          label: option.label,
                                                          value: option.value.path,
                                                        }))}
                                                        value={
                                                          assetValue.kind === 'theme'
                                                            ? assetValue.path
                                                            : undefined
                                                        }
                                                        onChange={(path) => {
                                                          const next = themeOptions.find(
                                                            (option) => option.value.path === path
                                                          )?.value
                                                          if (!next) return
                                                          void runBlockCommand({
                                                            blockId: block.id,
                                                            kind: 'set-setting',
                                                            settingId: setting.id,
                                                            templateId: template.id,
                                                            value: next,
                                                          })
                                                        }}
                                                      />
                                                    )
                                                  }
                                                  return null
                                                })}
                                              </div>
                                            </Card>
                                          )
                                        })}
                                      </div>
                                    ),
                                  },
                                ]}
                              />
                            </div>
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
                {validationStatusMessage(currentValidation.status, t)}
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
                    title={themeDiagnosticMessage('validation', issue.code, t)}
                    description={
                      <Space orientation="vertical" size={2}>
                        <span>
                          {[issue.templateId, issue.instanceId, issue.path]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
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
                  label: t('{version} · schema {schema}', {
                    version: candidate.themeVersion,
                    schema: candidate.configurationSchemaVersion,
                  }),
                  value: `${candidate.id}@${candidate.themeVersion}@${candidate.configurationSchemaVersion}`,
                }))}
                onChange={(value) => {
                  setUpgradeThemeKey(value)
                  setMigration(null)
                }}
              />
              <Button
                disabled={!canWrite || dirty || !upgradeTheme}
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
                  <Space orientation="vertical" className="w-full">
                    <Input.TextArea
                      aria-label={t('Migration approval reason')}
                      placeholder={t('Migration approval reason')}
                      value={migrationApprovalReason}
                      maxLength={500}
                      onChange={(event) => setMigrationApprovalReason(event.target.value)}
                    />
                    <Button
                      type="primary"
                      disabled={
                        !canApprove || dirty || migrationApprovalReason.trim().length < 3 || busy
                      }
                      onClick={() =>
                        void runAction(async () => {
                          const successor = await createStorefrontExperienceMigrationSuccessor(
                            draft,
                            migration,
                            migrationApprovalReason
                          )
                          successorFocusTarget.current = successor.id
                          setLoading(true)
                          setMigration(null)
                          void message.success(
                            currentT('Successor draft {id} created for review.', {
                              id: successor.id,
                            })
                          )
                          navigate(`/storefront/themes/${successor.id}${guideSearch}`, {
                            replace: true,
                          })
                        })
                      }
                    >
                      {t('Create migration successor')}
                    </Button>
                  </Space>
                ) : null}
                {migration.conflicts.map((conflict) => (
                  <Alert
                    key={`${conflict.code}-${conflict.templateId ?? ''}-${conflict.instanceId ?? ''}`}
                    type="warning"
                    showIcon
                    title={themeDiagnosticMessage('migration', conflict.code, t)}
                    description={[
                      conflict.templateId,
                      conflict.instanceId,
                      conflict.settingId,
                      conflict.operationIndex,
                    ]
                      .filter((value) => value !== undefined)
                      .join(' · ')}
                  />
                ))}
              </>
            ) : null}
          </Space>
        )}
      </Card>

      <Card title={t('Store preview')} extra={<Tag color={status.color}>{t(status.label)}</Tag>}>
        <Space orientation="vertical" className="w-full">
          {build ? (
            <Collapse
              items={[
                {
                  key: 'build-details',
                  label: t('Preview build details'),
                  forceRender: true,
                  children: (
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
                      {build.expiresAt ? (
                        <Descriptions.Item label={t('Expires')}>
                          {build.expiresAt}
                        </Descriptions.Item>
                      ) : null}
                    </Descriptions>
                  ),
                },
              ]}
            />
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
                    throw new LocalThemeError(localThemeMessages.missingPreviewOrigin)
                  const releaseId = selectedReleaseId
                  if (!previewContextCurrent || selectedReleaseIdRef.current !== releaseId) {
                    throw new LocalThemeError(localThemeMessages.stalePreview)
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
              title={t('Preview cannot be opened')}
              description={t('Ask an administrator to configure the preview address.')}
            />
          ) : null}
          {build?.failureCode ? (
            <Alert
              type="error"
              showIcon
              title={t('Preview failed')}
              description={themeDiagnosticMessage('preview', build.failureCode, t)}
            />
          ) : null}
          {build && ['failed', 'expired'].includes(build.status) ? (
            <Button
              icon={<ReloadOutlined aria-hidden />}
              disabled={
                busy ||
                dirty ||
                !validationCurrent ||
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
              <span>{t('Generating the preview. You can continue editing.')}</span>
            </Space>
          ) : null}
        </Space>
      </Card>

      {canApprove ? (
        <Card title={t('Approve draft')}>
          <Space orientation="vertical" className="w-full">
            <Typography.Text type="secondary">
              {t(
                'Approval freezes this design for formal release. It does not update the storefront.'
              )}
            </Typography.Text>
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
                  void message.success(
                    currentT('Design approved. Formal release is still required.')
                  )
                })
              }
            >
              {t('Approve exact draft v{version}', { version: draft.version })}
            </Button>
            {approvedSnapshot ? (
              <>
                <Alert type="success" showIcon title={t('Approved, awaiting formal release')} />
                <Collapse
                  items={[
                    {
                      key: 'approval-details',
                      label: t('Approval details'),
                      forceRender: true,
                      children: t('{id} · source draft v{version} · audit succeeded', {
                        id: approvedSnapshot.id,
                        version: approvedSnapshot.sourceDraftVersion,
                      }),
                    },
                  ]}
                />
              </>
            ) : null}
          </Space>
        </Card>
      ) : null}
    </main>
  )
}
