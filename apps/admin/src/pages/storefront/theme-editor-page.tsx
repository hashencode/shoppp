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
  PageTemplate,
  SectionDefinition,
  SectionInstance,
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
  message,
} from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  approveStorefrontExperienceDraft,
  createStorefrontPreviewGrant,
  dryRunStorefrontExperienceMigration,
  fetchStorefrontExperienceDraft,
  fetchStorefrontPreviewBuild,
  fetchStorefrontThemes,
  previewStorefrontExperienceDraft,
  storefrontPreviewOrigin,
  updateStorefrontExperienceDraft,
  validateStorefrontExperienceDraft,
  type StorefrontExperienceDraft,
  type StorefrontExperienceMigration,
  type StorefrontExperienceSnapshot,
  type StorefrontPreviewBuild,
} from '../../services/storefront/api'
import { QueryStateBlock } from '../../shared/components/query-state-block'

void React

type ThemeEditorPageProps = {
  pollIntervalMs?: number
  previewOrigin?: string | null
}

const cloneTemplates = (templates: readonly PageTemplate[]): PageTemplate[] =>
  structuredClone(templates) as PageTemplate[]

const equalValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

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
  form.setAttribute('referrerpolicy', 'no-referrer')
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
}: {
  count: number
  index: number
  instanceId: string
  onMove: (direction: -1 | 1) => void
}) => (
  <Space.Compact>
    <Button
      aria-label={`Move ${instanceId} before`}
      icon={<ArrowUpOutlined aria-hidden />}
      disabled={index === 0}
      onClick={() => onMove(-1)}
    />
    <Button
      aria-label={`Move ${instanceId} after`}
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
  const { draftId } = useParams()
  const navigate = useNavigate()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const canPreview = hasPermission(role, 'themes.preview', permissions)
  const canApprove = hasPermission(role, 'themes.approve', permissions)
  const [draft, setDraft] = useState<StorefrontExperienceDraft | null>(null)
  const [theme, setTheme] = useState<AdminStorefrontTheme | null>(null)
  const [availableThemes, setAvailableThemes] = useState<AdminStorefrontTheme[]>([])
  const [templates, setTemplates] = useState<PageTemplate[]>([])
  const [savedTemplates, setSavedTemplates] = useState<PageTemplate[]>([])
  const [activeTemplateId, setActiveTemplateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [approvalReason, setApprovalReason] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [build, setBuild] = useState<StorefrontPreviewBuild | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<StorefrontExperienceSnapshot | null>(null)
  const [approvedSnapshot, setApprovedSnapshot] = useState<StorefrontExperienceSnapshot | null>(
    null
  )
  const [migration, setMigration] = useState<StorefrontExperienceMigration | null>(null)
  const [upgradeThemeKey, setUpgradeThemeKey] = useState('')
  const loadRequest = useRef(0)
  const dirty = !equalValue(templates, savedTemplates)
  const blocker = useBlocker(dirty)

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    if (!draftId) {
      setError('The experience draft ID is missing.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextDraft, themes] = await Promise.all([
        fetchStorefrontExperienceDraft(draftId),
        fetchStorefrontThemes(),
      ])
      const nextTheme = themes.find(
        ({ id, themeVersion }) =>
          id === nextDraft.themeId && themeVersion === nextDraft.themeVersion
      )
      if (!nextTheme) throw new Error('The exact approved theme package is no longer available.')
      if (request !== loadRequest.current) return
      const nextTemplates = resolveDraftTemplates(nextTheme, nextDraft)
      setDraft(nextDraft)
      setTheme(nextTheme)
      setAvailableThemes(themes)
      setTemplates(nextTemplates)
      setSavedTemplates(cloneTemplates(nextTemplates))
      setActiveTemplateId((current) => current || nextTemplates[0]?.id || '')
      setBuild(null)
      setPreviewSnapshot(null)
      setMigration(null)
      const upgrade = themes.find(
        ({ id, themeVersion }) => id === nextDraft.themeId && themeVersion !== nextDraft.themeVersion
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
  }, [draftId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      loadRequest.current += 1
    }
  }, [load])

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
    const timer = window.setTimeout(async () => {
      try {
        const nextBuild = await fetchStorefrontPreviewBuild(buildId)
        if (!cancelled) {
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
      setAnnouncement(
        `${section.id} moved to position ${target + 1} of ${template.sections.length} on ${template.pageType}.`
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
    setAnnouncement(`${sectionId} reset to the ${draft.presetId} preset.`)
  }

  const save = async (reason: string): Promise<StorefrontExperienceDraft> => {
    if (!draft || !theme) throw new Error('The exact draft package is not loaded.')
    if (!dirty) return draft
    const updated = await updateStorefrontExperienceDraft(
      draft,
      createThemeOverrides(theme, draft, templates),
      reason
    )
    setDraft(updated)
    setSavedTemplates(cloneTemplates(templates))
    return updated
  }

  const validate = async (target: StorefrontExperienceDraft, reason: string) => {
    const validation = await validateStorefrontExperienceDraft(target.id, target.version, reason)
    const validated = { ...target, validation }
    setDraft(validated)
    return validated
  }

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
  const validationCurrent =
    draft?.validation?.status === 'valid' && draft.validation.draftVersion === draft.version

  const startPreview = async (target: StorefrontExperienceDraft, reason: string) => {
    const resolution = await previewStorefrontExperienceDraft(target.id, target.version, reason)
    setPreviewSnapshot(resolution.snapshot)
    setBuild(resolution.build)
  }

  const reloadSavedDraft = () => {
    if (
      dirty &&
      !window.confirm('Discard local theme edits and reload the last saved draft version?')
    ) {
      return
    }
    void load()
  }

  if (loading) {
    return <QueryStateBlock state="loading" title="Loading the exact experience draft…" />
  }
  if (error && (!draft || !theme)) {
    return (
      <QueryStateBlock
        state="error"
        title="Experience editor could not be loaded"
        description={error}
        primaryActionLabel="Reload"
        onPrimaryAction={() => void load()}
        secondaryActionLabel="Back to themes"
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
            Storefront themes
          </Button>
          <Typography.Title level={2} className="!mb-1 !mt-0">
            {draft.experienceId}
          </Typography.Title>
          <Space wrap>
            <Tag color="blue">
              {draft.themeId} {draft.themeVersion}
            </Tag>
            <Tag>Draft v{draft.version}</Tag>
            <Tag color={validationCurrent ? 'success' : 'default'}>
              {validationCurrent ? `Validated v${draft.version}` : 'Validation required'}
            </Tag>
            {dirty ? <Tag color="warning">Unsaved changes</Tag> : <Tag>Saved</Tag>}
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
                    void message.success('Draft saved with a new version.')
                  })
                }
              >
                Save
              </Button>
              <Button
                disabled={dirty || !reasonReady}
                loading={busy}
                onClick={() =>
                  void runAction(async () => {
                    const validated = await validate(draft, changeReason)
                    if (validated.validation?.status === 'valid') {
                      void message.success(`Draft v${validated.version} is valid.`)
                    }
                  })
                }
              >
                Validate saved version
              </Button>
            </>
          ) : null}
          {canPreview ? (
            <Button
              type="primary"
              icon={<EyeOutlined aria-hidden />}
              disabled={!reasonReady}
              loading={busy}
              onClick={() =>
                void runAction(async () => {
                  const saved = await save(changeReason)
                  const validated = await validate(saved, changeReason)
                  if (validated.validation?.status !== 'valid') return
                  await startPreview(validated, changeReason)
                  void message.success(
                    `Preview requested for validated draft v${validated.version}.`
                  )
                })
              }
            >
              Save and preview
            </Button>
          ) : null}
        </Space>
      </header>

      {blocker.state === 'blocked' ? (
        <Alert
          type="warning"
          showIcon
          title="Discard unsaved theme edits?"
          description="The destination will open only after you explicitly discard the local changes."
          action={
            <Space>
              <Button size="small" onClick={() => blocker.reset()}>
                Keep editing
              </Button>
              <Button size="small" danger onClick={() => blocker.proceed()}>
                Discard and leave
              </Button>
            </Space>
          }
        />
      ) : null}
      {error ? (
        <Alert
          type="error"
          showIcon
          title="The last operation did not complete"
          description={error}
          action={
            <Button size="small" icon={<ReloadOutlined aria-hidden />} onClick={reloadSavedDraft}>
              Reload saved draft
            </Button>
          }
        />
      ) : null}
      {!canWrite ? (
        <Alert
          type="info"
          showIcon
          title="Read-only experience"
          description="Your role can inspect the package, capabilities, validation, and versions only."
        />
      ) : null}

      <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
        <Descriptions.Item label="Draft identity">{draft.id}</Descriptions.Item>
        <Descriptions.Item label="Preset">{draft.presetId}</Descriptions.Item>
        <Descriptions.Item label="Schema">{draft.configurationSchemaVersion}</Descriptions.Item>
        <Descriptions.Item label="Last saved">{draft.updatedAt}</Descriptions.Item>
        <Descriptions.Item label="Fixture bindings">{draft.bindings.length}</Descriptions.Item>
        <Descriptions.Item label="Production theme">Unchanged</Descriptions.Item>
      </Descriptions>

      <Card
        title="Change context"
        extra={
          <Typography.Text type="secondary">Required for every audited action</Typography.Text>
        }
      >
        <Input.TextArea
          aria-label="Change reason"
          placeholder="Describe why this experience is changing"
          value={changeReason}
          maxLength={500}
          rows={2}
          onChange={(event) => setChangeReason(event.target.value)}
        />
      </Card>

      <section aria-labelledby="experience-structure-heading">
        <Typography.Title id="experience-structure-heading" level={4}>
          Experience structure
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Sections keep stable IDs. Required capabilities cannot be hidden; ordering uses explicit
          controls for keyboard, touch, and assistive technology.
        </Typography.Paragraph>
        <div className="sr-only" aria-live="polite">
          {announcement}
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
                  title="Required capabilities"
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
                              <Tag>Position {index + 1}</Tag>
                              {isRequired ? <Tag color="gold">Required</Tag> : null}
                            </Space>
                          }
                          extra={
                            canWrite ? (
                              <SectionMoveButtons
                                count={template.sections.length}
                                index={index}
                                instanceId={section.id}
                                onMove={(direction) =>
                                  moveSection(template.id, section.id, direction)
                                }
                              />
                            ) : null
                          }
                        >
                          <Space wrap>
                            <span>
                              Visible{' '}
                              <Switch
                                aria-label={`Show ${section.id}`}
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
                                aria-label={`Reset ${section.id}`}
                                size="small"
                                onClick={() => resetSection(template.id, section.id)}
                              >
                                Reset instance
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
                                  if (definition.kind === 'text') {
                                    return (
                                      <label key={definition.id}>
                                        <Typography.Text>{definition.id}</Typography.Text>
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
                                      <label key={definition.id}>
                                        <Typography.Text>{definition.id}</Typography.Text>
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
                                      <label key={definition.id}>
                                        <Space>
                                          <Typography.Text>{definition.id}</Typography.Text>
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
                                      <label key={definition.id}>
                                        <Typography.Text>{definition.id}</Typography.Text>
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
                                  return (
                                    <Alert
                                      key={definition.id}
                                      type="info"
                                      title={`${definition.id} is managed as a validated ${definition.kind} reference.`}
                                    />
                                  )
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
                                  label: `${section.blocks.length} bounded blocks`,
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

      <Card title="Validation">
        {draft.validation ? (
          <Space orientation="vertical" className="w-full">
            <Space>
              <Tag color={validationCurrent ? 'success' : 'warning'}>{draft.validation.status}</Tag>
              <span>
                Validation {draft.validation.id} · draft v{draft.validation.draftVersion}
              </span>
            </Space>
            {draft.validation.issues.map((issue) => (
              <Alert
                key={`${issue.code}-${issue.templateId ?? ''}-${issue.instanceId ?? ''}`}
                type="error"
                showIcon
                title={issue.code}
                description={issue.message}
              />
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">
            Save and validate the exact draft version before preview or approval.
          </Typography.Text>
        )}
      </Card>

      <Card title="Package upgrade assessment">
        {upgradeCandidates.length === 0 ? (
          <Typography.Text type="secondary">
            No alternative approved version of this theme package is currently compatible.
          </Typography.Text>
        ) : (
          <Space orientation="vertical" className="w-full">
            <Space wrap>
              <Select
                aria-label="Target theme version"
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
                      await dryRunStorefrontExperienceMigration(
                        draft,
                        upgradeTheme,
                        changeReason
                      )
                    )
                  })
                }
              >
                Assess upgrade conflicts
              </Button>
            </Space>
            {migration ? (
              <>
                <Tag color={migration.conflicts.length === 0 ? 'success' : 'warning'}>
                  {migration.conflicts.length === 0
                    ? 'Migration-ready'
                    : `${migration.conflicts.length} conflicts`}
                </Tag>
                <Typography.Text code>{migration.id}</Typography.Text>
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

      <Card title="Private preview artifact" extra={<Tag color={status.color}>{status.label}</Tag>}>
        <Space orientation="vertical" className="w-full">
          {build ? (
            <Descriptions size="small" column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label="Build">{build.id}</Descriptions.Item>
              <Descriptions.Item label="Attempt">{build.attempt}</Descriptions.Item>
              <Descriptions.Item label="Snapshot">{build.snapshotId}</Descriptions.Item>
              {build.failureCode ? (
                <Descriptions.Item label="Failure">{build.failureCode}</Descriptions.Item>
              ) : null}
              {build.expiresAt ? (
                <Descriptions.Item label="Expires">{build.expiresAt}</Descriptions.Item>
              ) : null}
            </Descriptions>
          ) : (
            <Typography.Text type="secondary">
              No preview has been requested for this editor session.
            </Typography.Text>
          )}
          {build?.status === 'deployed' && previewSnapshot?.id === build.snapshotId ? (
            <Button
              icon={<EyeOutlined aria-hidden />}
              disabled={!previewOrigin || busy}
              onClick={() =>
                void runAction(async () => {
                  if (!previewOrigin)
                    throw new Error('The private preview origin is not configured.')
                  const grant = await createStorefrontPreviewGrant(
                    previewSnapshot.id,
                    previewOrigin,
                    changeReason
                  )
                  submitPreviewGrant(grant)
                })
              }
            >
              Open authenticated preview
            </Button>
          ) : null}
          {!previewOrigin ? (
            <Alert
              type="warning"
              showIcon
              title="Private preview origin is not configured"
              description="Provision PUBLIC_PREVIEW_ORIGIN for this admin environment before opening an artifact."
            />
          ) : null}
          {build && ['failed', 'expired'].includes(build.status) ? (
            <Button
              icon={<ReloadOutlined aria-hidden />}
              disabled={dirty || !validationCurrent || !reasonReady}
              onClick={() =>
                void runAction(async () => {
                  await startPreview(draft, changeReason)
                })
              }
            >
              Retry preview
            </Button>
          ) : null}
          {['pending', 'building'].includes(build?.status ?? '') ? (
            <Space>
              <Spin size="small" />
              <span>Polling the immutable artifact build without locking the draft editor.</span>
            </Space>
          ) : null}
        </Space>
      </Card>

      {canApprove ? (
        <Card title="Approve immutable experience snapshot">
          <Space orientation="vertical" className="w-full">
            <Alert
              type="warning"
              showIcon
              title="Approval does not activate the production storefront theme"
              description="It records an immutable, audited snapshot for this exact validated draft version."
            />
            <Input.TextArea
              aria-label="Approval reason"
              placeholder="Why is this exact version approved?"
              value={approvalReason}
              maxLength={500}
              rows={2}
              onChange={(event) => setApprovalReason(event.target.value)}
            />
            <Button
              type="primary"
              icon={<CheckCircleOutlined aria-hidden />}
              disabled={dirty || !validationCurrent || approvalReason.trim().length < 3 || busy}
              onClick={() =>
                void runAction(async () => {
                  const snapshot = await approveStorefrontExperienceDraft(
                    draft.id,
                    draft.version,
                    approvalReason
                  )
                  setApprovedSnapshot(snapshot)
                  void message.success('Immutable experience snapshot approved and audited.')
                })
              }
            >
              Approve exact draft v{draft.version}
            </Button>
            {approvedSnapshot ? (
              <Alert
                type="success"
                showIcon
                title="Immutable snapshot approved"
                description={`${approvedSnapshot.id} · source draft v${approvedSnapshot.sourceDraftVersion} · audit succeeded`}
              />
            ) : null}
          </Space>
        </Card>
      ) : null}
    </main>
  )
}
