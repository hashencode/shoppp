import { localizeThemeError } from '../theme-feedback'
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { App, Alert, Button, Card, Select, Space, Spin, Tree } from 'antd'
import type { TreeProps } from 'antd'
import { ArrowLeftOutlined, RedoOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { themePackageSchema, type AdminStorefrontTheme, type ThemePackage } from '@shoppp/contracts'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import { useCurrentTranslate, useI18n } from '../../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../../shared/template-kit/recipes/custom-page-recipe'
import {
  fetchStorefrontEditorDefinition,
  fetchFashionStagingOperatorRun,
  type FashionStagingOperatorRun,
  fetchStorefrontExperienceDraft,
  updateStorefrontExperienceDraft,
  createStorefrontExperienceSuccessor,
  type StorefrontCatalogRelease,
  type StorefrontExperienceDraft,
} from '../../../services/storefront/api'
import { EditorSession } from './editor-session'
import { EditorPreviewPane } from './preview-pane'
import { WorkspaceInspector } from './workspace-inspector'
import { DraftLibraryActions } from './draft-library-actions'
import { EditorUpgradePanel } from './upgrade-panel'
import { useEditorSources } from './use-editor-sources'
import './workspace.css'
import { editorPageLabels, editorRegionName } from './editor-labels'

void React
const newId = () => `instance-${crypto.randomUUID()}`

export const VisualThemeEditorPage = () => {
  const currentT = useCurrentTranslate()
  const { draftId = '' } = useParams(),
    navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const guideSearch = searchParams.get('from') === 'setup-guide' ? '?from=setup-guide' : ''
  const { t } = useI18n(),
    { modal, message } = App.useApp(),
    { role, permissions } = useAuth()
  const canManage = hasPermission(role, 'themes.write', permissions)
  const canPreview =
    hasPermission(role, 'themes.preview', permissions) &&
    hasPermission(role, 'catalog.read', permissions) &&
    hasPermission(role, 'settings.read', permissions)
  const canPrepare =
    canPreview &&
    ['catalog.publish', 'identity.read', 'policies.read', 'content.read', 'navigation.read'].every(
      (permission) => hasPermission(role, permission as 'catalog.publish', permissions)
    )
  const [loaded, setLoaded] = useState<{
    draft: StorefrontExperienceDraft
    package: ThemePackage
    upgradeTargets: AdminStorefrontTheme[]
    session: EditorSession
    operatorRun: FashionStagingOperatorRun | null
    writable?: boolean
  } | null>(null)
  const canWrite = canManage && loaded?.writable !== false
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false)
  const [templateId, setTemplateId] = useState(''),
    [selection, setSelection] = useState('')
  const [path, setPath] = useState('/'),
    [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mode, setMode] = useState<'inspect' | 'browse'>('inspect'),
    [panel, setPanel] = useState('structure')
  const [, redraw] = useReducer((value) => value + 1, 0)
  const generation = useRef(0),
    saveLock = useRef(false)
  const session = loaded?.session,
    current = useRef(loaded)
  useLayoutEffect(() => {
    current.current = loaded
  })
  const runBound = Boolean(
    loaded?.operatorRun && ['awaiting_operator', 'approved'].includes(loaded.operatorRun.status)
  )
  const { releases, releaseId, selectRelease, preparing, sourceError, prepare } = useEditorSources({
    draftId,
    savedReleaseId:
      loaded?.draft.id === draftId
        ? loaded.operatorRun &&
          ['awaiting_operator', 'approved'].includes(loaded.operatorRun.status)
          ? loaded.operatorRun.catalogReleaseId
          : loaded.draft.validations.find(
              (validation) => validation.status === 'valid' && validation.catalogReleaseId
            )?.catalogReleaseId
        : undefined,
    canPreview,
    canPrepare: canPrepare && !runBound,
  })
  const dirty = Boolean(session?.dirty)
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const confirmation = modal.confirm({
      title: t('Discard unsaved design changes?'),
      okText: t('Discard'),
      cancelText: t('Keep editing'),
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
    return () => confirmation.destroy()
  }, [blocker, modal, t])
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (current.current?.session.dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [])
  const load = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setError(null)
    try {
      const [result, operatorRun] = await Promise.all([
        fetchStorefrontEditorDefinition(draftId),
        fetchFashionStagingOperatorRun(draftId),
      ])
      if (request !== generation.current) return
      const preset = result.package.presets.find(({ id }) => id === result.draft.presetId)
      if (!preset) throw new Error('The saved theme preset is unavailable.')
      const session = new EditorSession(result.draft, preset.templates)
      setLoaded({ ...result, session, operatorRun })
      setTemplateId(preset.templates[0]!.id)
      setSelection(preset.templates[0]!.sections[0]?.id ?? '')
      setPath('/')
      setConflict(false)
    } catch (cause) {
      if (request === generation.current) setError(cause)
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [draftId])
  const loadRef = useRef(load)
  useLayoutEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    const timer = window.setTimeout(() => void loadRef.current(), 0)
    return () => {
      clearTimeout(timer)
      generation.current++
    }
  }, [draftId])
  const template = session?.document.templates.find(({ id }) => id === templateId)
  const selectedRelease = releases.find(({ id }) => id === releaseId)
  const resources = useMemo(
    () =>
      selectedRelease
        ? [
            ...selectedRelease.products.map((product) => ({
              id: product.id,
              kind: 'product' as const,
              label: product.name,
              path: `/products/${product.slug}`,
            })),
            ...selectedRelease.collections.map((collection) => ({
              id: collection.id,
              kind: 'collection' as const,
              label: collection.name,
              path: `/collections/${collection.slug}`,
            })),
            ...(selectedRelease.destinations ?? []).map((item) => ({
              id: item.id,
              kind: item.kind,
              label: item.name,
              path: item.path,
            })),
          ]
        : [],
    [selectedRelease]
  )
  const invalid =
    loaded && session
      ? themePackageSchema.safeParse({
          ...loaded.package,
          presets: [
            {
              ...loaded.package.presets.find(({ id }) => id === session.presetId),
              templates: session.document.templates,
            },
          ],
        })
      : null
  const change = (action: (session: EditorSession) => void) => {
    if (!canWrite || !session) return
    try {
      action(session)
      redraw()
    } catch (cause) {
      void message.error(
        cause instanceof Error ? t(cause.message) : t('The design could not be changed.')
      )
    }
  }
  const connectSources = (release: StorefrontCatalogRelease) =>
    change((session) =>
      session.change((doc) => {
        doc.bindings = doc.bindings.filter(({ kind }) => kind !== 'fixture')
        for (const template of doc.templates)
          for (const section of template.sections) {
            const definition = loaded?.package.manifest.componentRegistry.sections.find(
              ({ type }) => type === section.type
            )
            for (const setting of definition?.settings ?? []) {
              if (
                !setting.required ||
                !['product-reference', 'collection-reference'].includes(setting.kind) ||
                doc.bindings.some(
                  (binding) =>
                    binding.kind === 'catalog' &&
                    binding.instanceId === section.id &&
                    binding.settingId === setting.id
                )
              )
                continue
              const kind = setting.kind === 'product-reference' ? 'product' : 'collection'
              const resource = (kind === 'product' ? release.products : release.collections)[0]
              if (!resource)
                throw new Error(
                  currentT('Publish a collection and its products before connecting this design.')
                )
              doc.bindings.push({
                id: `binding-${crypto.randomUUID()}`,
                kind: 'catalog',
                instanceId: section.id,
                settingId: setting.id,
                reference: { kind, id: resource.id },
              })
            }
          }
      })
    )
  const save = async () => {
    if (
      !loaded ||
      !canWrite ||
      saveLock.current ||
      !session?.dirty ||
      conflict ||
      !invalid?.success
    )
      return
    saveLock.current = true
    setSaving(true)
    setError(null)
    const request = generation.current
    try {
      const captured = session.captureSave()
      const result = await updateStorefrontExperienceDraft(
        { ...loaded.draft, version: captured.payload.expectedVersion },
        captured.payload.overrides,
        '',
        captured.payload.bindings
      )
      if (request !== generation.current || current.current?.session !== session) return
      session.acknowledgeSave(captured, result.version)
      setLoaded({ ...loaded, draft: result })
      redraw()
      void message.success(t('Design saved'))
      return result
    } catch (cause) {
      if (request !== generation.current) return
      setError(cause)
      if (typeof cause === 'object' && cause && 'status' in cause && cause.status === 409)
        setConflict(true)
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }
  const chooseTemplate = (id: string) => {
    const template = session?.document.templates.find((template) => template.id === id)
    if (!template) return
    const resource = resources.find(
      (resource) =>
        resource.kind === template.pageType ||
        (template.pageType === 'content' && ['page', 'article', 'policy'].includes(resource.kind))
    )
    setTemplateId(id)
    setSelection(template.sections[0]?.id ?? '')
    setPath(
      template.pageType === 'home'
        ? '/'
        : (resource?.path ??
            (template.pageType === 'collection' ? '/shop' : `/${template.pageType}`))
    )
  }
  const drop: NonNullable<TreeProps['onDrop']> = (info) => {
    if (!info.dropToGap) return
    const source = String(info.dragNode.key),
      target = String(info.node.key)
    change((session) =>
      session.change((doc) => {
        const template = doc.templates.find(({ id }) => id === templateId)!
        const parent = template.sections.find((section) =>
          section.blocks.some(({ id }) => id === source)
        )
        const items = parent ? parent.blocks : template.sections
        const from = items.findIndex(({ id }) => id === source),
          to = items.findIndex(({ id }) => id === target)
        if (from < 0 || to < 0 || from === to) return
        const item = items.splice(from, 1)[0]!
        const after = info.dropPosition - Number(info.node.pos.split('-').at(-1)) > 0
        items.splice(items.findIndex(({ id }) => id === target) + (after ? 1 : 0), 0, item as never)
      })
    )
  }
  if (loading || (loaded !== null && loaded.draft.id !== draftId && !error))
    return (
      <CustomPageRecipe title={t('Store design')}>
        <Spin />
      </CustomPageRecipe>
    )
  if (!loaded || loaded.draft.id !== draftId || !session || !template)
    return (
      <CustomPageRecipe title={t('Store design')}>
        <Alert
          type="error"
          title={t('The design could not be loaded.')}
          description={localizeThemeError(error, t)}
          action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
        />
      </CustomPageRecipe>
    )
  const issues = invalid && !invalid.success ? invalid.error.issues : []
  const requiresSourceConnection =
    session.document.bindings.some(({ kind }) => kind === 'fixture') ||
    session.document.templates.some((template) =>
      template.sections.some((section) =>
        loaded.package.manifest.componentRegistry.sections
          .find(({ type }) => type === section.type)
          ?.settings.some(
            (setting) =>
              setting.required &&
              ['product-reference', 'collection-reference'].includes(setting.kind) &&
              !session.document.bindings.some(
                (binding) =>
                  binding.kind === 'catalog' &&
                  binding.instanceId === section.id &&
                  binding.settingId === setting.id
              )
          )
      )
    )
  return (
    <CustomPageRecipe
      className="theme-editor-page"
      title={
        <Space>
          <Button
            aria-label={t('Back')}
            icon={<ArrowLeftOutlined aria-hidden />}
            onClick={() => navigate(`/storefront/themes${guideSearch}`)}
          />
          {loaded.draft.name ?? t('Store design')}
        </Space>
      }
      extra={
        <Space wrap>
          <Button
            icon={<UndoOutlined aria-hidden />}
            disabled={!canWrite || !session.canUndo}
            onClick={() => change((session) => session.undo())}
          >
            {t('Undo')}
          </Button>
          <Button
            icon={<RedoOutlined aria-hidden />}
            disabled={!canWrite || !session.canRedo}
            onClick={() => change((session) => session.redo())}
          >
            {t('Redo')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined aria-hidden />}
            loading={saving}
            disabled={!canWrite || !dirty || conflict || issues.length > 0}
            onClick={() => void save()}
          >
            {t('Save design')}
          </Button>
        </Space>
      }
    >
      {loaded.operatorRun ? (
        <Alert
          type="info"
          title={t('Design is bound to an operator run.')}
          description={`${loaded.operatorRun.status} · ${loaded.operatorRun.runId} · ${loaded.operatorRun.expiresAt}`}
        />
      ) : null}
      <EditorUpgradePanel
        draft={loaded.draft}
        targets={loaded.upgradeTargets ?? []}
        releaseId={releaseId}
        disabled={!canManage || dirty || saving}
        canApprove={hasPermission(role, 'themes.approve', permissions)}
        onCreated={(draft) => {
          if (!session.dirty) navigate(`/storefront/themes/${draft.id}${guideSearch}`)
          else
            void message.success(
              <Link to={`/storefront/themes/${draft.id}`} target="_blank" rel="noopener">
                {t('Open upgraded draft')}
              </Link>
            )
        }}
      />
      {canManage ? (
        <DraftLibraryActions
          draft={loaded.draft}
          dirty={dirty}
          disabled={saving}
          saveFirst={save}
          onUpdated={async (kind) => {
            if (kind === 'remove') {
              session.discardDirtyMarker()
              navigate(`/storefront/themes${guideSearch}`)
              return
            }
            if (kind === 'copy') return
            try {
              const draft = await fetchStorefrontExperienceDraft(loaded.draft.id)
              if (current.current?.session === session) {
                session.acknowledgeMetadata(draft.version)
                setLoaded({ ...loaded, draft })
              }
            } catch (cause) {
              setError(cause)
            }
          }}
        />
      ) : null}
      {error ? (
        <Alert
          type="error"
          title={t('The design could not be saved.')}
          description={localizeThemeError(error, t)}
          action={
            conflict ? (
              <Space wrap>
                <Button
                  onClick={() =>
                    modal.confirm({ title: t('Discard unsaved design changes?'), onOk: load })
                  }
                >
                  {t('Reload')}
                </Button>
                <Button
                  disabled={saving || !canWrite}
                  onClick={() =>
                    void (async () => {
                      if (saveLock.current) return
                      saveLock.current = true
                      setSaving(true)
                      try {
                        const captured = session.captureSave()
                        const successor = await createStorefrontExperienceSuccessor(
                          await fetchStorefrontExperienceDraft(loaded.draft.id),
                          captured.payload.overrides,
                          '',
                          captured.payload.bindings
                        )
                        if (session.revision === captured.revision) {
                          session.discardDirtyMarker(captured.document)
                          navigate(`/storefront/themes/${successor.id}${guideSearch}`)
                        } else
                          void message.success(
                            <Link
                              to={`/storefront/themes/${successor.id}`}
                              target="_blank"
                              rel="noopener"
                            >
                              {t('Open recovery draft')}
                            </Link>
                          )
                      } catch (cause) {
                        setError(cause)
                      } finally {
                        saveLock.current = false
                        setSaving(false)
                      }
                    })()
                  }
                >
                  {t('Recover as a new draft')}
                </Button>
              </Space>
            ) : (
              <Button onClick={() => void save()}>{t('Retry')}</Button>
            )
          }
        />
      ) : null}
      {issues.length ? (
        <Alert
          type="warning"
          title={t('Complete the highlighted design settings.')}
          description={issues.map((issue) => issue.message).join(' ')}
        />
      ) : null}
      <Card size="small" className="theme-editor-toolbar">
        <Space wrap>
          <Select
            aria-label={t('Page template')}
            value={templateId}
            options={session.document.templates.map((template) => ({
              label: t(editorPageLabels[template.pageType]),
              value: template.id,
            }))}
            onChange={chooseTemplate}
          />
          <Select
            aria-label={t('Preview resource')}
            className="min-w-48"
            value={path}
            options={[
              { label: t('Home'), value: '/' },
              { label: t('Shop'), value: '/shop' },
              { label: t('Cart'), value: '/cart' },
              { label: t('Checkout'), value: '/checkout' },
              ...resources.map((resource) => ({ label: resource.label, value: resource.path })),
            ]}
            onChange={(next) => {
              const resource = resources.find((resource) => resource.path === next)
              const pageType =
                next === '/'
                  ? 'home'
                  : next === '/shop'
                    ? 'collection'
                    : next === '/cart'
                      ? 'cart'
                      : next === '/checkout'
                        ? 'checkout'
                        : resource?.kind === 'product'
                          ? 'product'
                          : resource?.kind === 'collection'
                            ? 'collection'
                            : 'content'
              const target = session.document.templates.find(
                ({ pageType: type }) => type === pageType
              )
              if (target) {
                setTemplateId(target.id)
                setPath(next)
                setSelection(target.sections[0]?.id ?? '')
              }
            }}
          />
          <Select
            aria-label={t('Preview device')}
            value={device}
            options={[
              { label: t('Desktop'), value: 'desktop' },
              { label: t('Mobile'), value: 'mobile' },
            ]}
            onChange={setDevice}
          />
          <Select
            aria-label={t('Preview mode')}
            value={mode}
            options={[
              { label: t('Inspect'), value: 'inspect' },
              { label: t('Browse'), value: 'browse' },
            ]}
            onChange={setMode}
          />
          {canPreview ? (
            <Select
              aria-label={t('Published sources')}
              placeholder={t('Published sources')}
              value={releaseId || undefined}
              disabled={runBound}
              className="min-w-48"
              options={releases.map((release, index) => ({
                label: `${release.status === 'private-preview' ? t('Prepared preview sources') : t('Published sources')} · ${index + 1}`,
                value: release.id,
              }))}
              onChange={selectRelease}
            />
          ) : null}
          {canWrite && canPreview && requiresSourceConnection ? (
            <Button
              disabled={!selectedRelease}
              onClick={() => {
                if (selectedRelease) connectSources(selectedRelease)
              }}
            >
              {t('Connect published resources')}
            </Button>
          ) : null}
          {canPrepare && !runBound ? (
            <Button loading={preparing} onClick={() => void prepare()}>
              {t('Refresh preview sources')}
            </Button>
          ) : null}
        </Space>
      </Card>
      {sourceError ? (
        <Alert
          type="warning"
          title={t('Preview sources are unavailable.')}
          description={sourceError}
          action={
            <Button onClick={() => void prepare()} disabled={!canPrepare || runBound}>
              {t('Retry')}
            </Button>
          }
        />
      ) : null}
      <div className="theme-editor-workspace">
        <aside className="theme-editor-structure">
          <Card title={t('Structure')} size="small">
            <Tree
              selectedKeys={[selection]}
              defaultExpandAll
              blockNode
              draggable={canWrite}
              allowDrop={({ dragNode, dropNode, dropPosition }) =>
                dropPosition !== 0 &&
                template.sections.some(
                  (section) =>
                    (section.id === dragNode.key &&
                      template.sections.some(({ id }) => id === dropNode.key)) ||
                    (section.blocks.some(({ id }) => id === dragNode.key) &&
                      section.blocks.some(({ id }) => id === dropNode.key))
                )
              }
              onDrop={drop}
              treeData={template.sections.map((section) => ({
                key: section.id,
                title: `${section.visible ? '' : '○ '}${t(editorRegionName(section.type))}`,
                children: section.blocks.map((block) => ({
                  key: block.id,
                  title: String(
                    block.settings.title ?? block.settings.label ?? t(editorRegionName(block.type))
                  ),
                })),
              }))}
              onSelect={(keys) => {
                if (keys[0]) {
                  setSelection(String(keys[0]))
                  setPanel('structure')
                }
              }}
            />
            <Space orientation="vertical" className="mt-3 w-full">
              <Button
                block
                onClick={() => {
                  setSelection('__styles')
                  setPanel('structure')
                }}
              >
                {t('Theme styles')}
              </Button>
              <Button
                block
                onClick={() => {
                  setSelection('__header')
                  setPanel('structure')
                }}
              >
                {t('Header and footer')}
              </Button>
              <Select
                aria-label={t('Add section')}
                placeholder={t('Add section')}
                className="w-full"
                value={undefined}
                disabled={!canWrite || session.schemaVersion < 4}
                options={loaded.package.manifest.componentRegistry.sections
                  .filter(
                    (definition) =>
                      definition.authoring?.pageTypes.includes(template.pageType) &&
                      template.sections.filter(({ type }) => type === definition.type).length <
                        definition.authoring.maxInstances
                  )
                  .map((definition) => ({
                    label: t(editorRegionName(definition.type)),
                    value: definition.type,
                  }))}
                onChange={(type) =>
                  change((session) => {
                    const source = session.preset
                      .flatMap((template) => template.sections)
                      .find((section) => section.type === type)
                    if (!source) return
                    const id = newId()
                    session.change((doc) => {
                      const section = structuredClone(source)
                      section.id = id
                      section.required = false
                      section.blocks = section.blocks.map((block) => ({ ...block, id: newId() }))
                      doc.templates.find(({ id }) => id === templateId)!.sections.push(section)
                    })
                    setSelection(id)
                  })
                }
              />
            </Space>
          </Card>
        </aside>
        <main className="theme-editor-preview">
          {canPreview ? (
            <EditorPreviewPane
              draftId={draftId}
              releaseId={releaseId}
              revision={session.revision}
              document={session.document}
              templateId={templateId}
              selectedId={selection === '__header' ? 'shared-header' : selection}
              path={path}
              mode={mode}
              width={device === 'mobile' ? 390 : '100%'}
              onSelect={(id) => {
                setSelection(id === 'shared-header' || id === 'shared-footer' ? '__header' : id)
                setPanel('structure')
              }}
              onNavigate={(next) => {
                setPath(next)
                const resource = resources.find((resource) => resource.path === next)
                const pageType =
                  next === '/'
                    ? 'home'
                    : resource?.kind === 'product'
                      ? 'product'
                      : resource?.kind === 'collection' || next.startsWith('/shop')
                        ? 'collection'
                        : next.startsWith('/cart')
                          ? 'cart'
                          : next.startsWith('/checkout')
                            ? 'checkout'
                            : next.startsWith('/search')
                              ? 'collection'
                              : 'content'
                const target = session.document.templates.find(
                  ({ pageType: type }) => type === pageType
                )
                if (target) setTemplateId(target.id)
              }}
            />
          ) : (
            <Alert
              type="info"
              title={t('Your role cannot open a store preview.')}
            />
          )}
        </main>
        <WorkspaceInspector
          session={session}
          themePackage={loaded.package}
          draft={loaded.draft}
          template={template}
          templateId={templateId}
          selection={selection}
          setSelection={setSelection}
          panel={panel}
          setPanel={setPanel}
          canWrite={canWrite}
          dirty={dirty}
          saving={saving}
          sourceReady={!requiresSourceConnection && Boolean(selectedRelease)}
          releaseId={releaseId}
          menus={selectedRelease?.menus}
          resources={resources}
          issues={issues}
          change={change}
        />
      </div>
    </CustomPageRecipe>
  )
}
