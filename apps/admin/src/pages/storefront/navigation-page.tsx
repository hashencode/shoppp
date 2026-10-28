import type { NavigationMenu, NavigationMenuItemInput } from '@shoppp/contracts'
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchNavigationMenu,
  fetchNavigationResources,
  saveNavigationMenu,
  transitionNavigationMenu,
  type NavigationMenuRecord,
  type NavigationPlacement,
} from '../../services/storefront/navigation-api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { FixedPageToolbar } from '../../shared/components/fixed-page-toolbar'
import { FormSubmitActions } from '../../shared/components/form-submit-toolbar'
import { StorefrontResourcePicker } from './storefront-resource-picker'
import { resourceKindMessages } from './theme-feedback'
import {
  NavigationTree,
  normalizeNavigationItems as normalize,
  type NavigationMove,
} from './navigation-tree'
import './navigation-page.css'

void React

export function moveNavigationItem(
  source: NavigationMenu['items'],
  id: string,
  action: NavigationMove
): { focusFallback?: 'add'; focusId?: string; items: NavigationMenu['items'] } {
  const items = normalize(source)
  const item = items.find((candidate) => candidate.id === id)
  if (!item) return { items }
  const siblings = items.filter(({ parentId }) => parentId === item.parentId)
  const index = siblings.findIndex((candidate) => candidate.id === id)
  if (action === 'remove') {
    const remaining = items.filter((candidate) => candidate.id !== id && candidate.parentId !== id)
    const focusId = siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? item.parentId ?? undefined
    return { focusFallback: focusId ? undefined : 'add', focusId, items: normalize(remaining) }
  }
  if (action === 'up' || action === 'down') {
    const other = siblings[index + (action === 'up' ? -1 : 1)]
    if (!other) return { focusId: id, items }
    return {
      focusId: id,
      items: normalize(
        items.map((candidate) =>
          candidate.id === id
            ? { ...candidate, position: other.position }
            : candidate.id === other.id
              ? { ...candidate, position: item.position }
              : candidate
        )
      ),
    }
  }
  if (action === 'indent') {
    if (item.parentId || index === 0 || items.some((candidate) => candidate.parentId === id))
      return { focusId: id, items }
    const parent = siblings[index - 1]!
    return {
      focusId: id,
      items: normalize([
        ...items.filter(({ id: candidateId }) => candidateId !== id),
        {
          ...item,
          parentId: parent.id,
          position: items.filter(({ parentId }) => parentId === parent.id).length,
        },
      ]),
    }
  }
  if (!item.parentId) return { focusId: id, items }
  const parent = items.find((candidate) => candidate.id === item.parentId)
  if (!parent) return { focusId: id, items }
  const roots = items.filter(({ parentId }) => parentId === null)
  const nextRoots = roots.flatMap((root) =>
    root.id === parent.id ? [root, { ...item, parentId: null }] : [root]
  )
  return {
    focusId: id,
    items: normalize([
      ...nextRoots.map((root, position) => ({ ...root, position })),
      ...items.filter(({ id: candidateId, parentId }) => candidateId !== id && parentId !== null),
    ]),
  }
}

const emptyMenu = (): NavigationMenu['items'] => []

const newItem = (): NavigationMenuItemInput => ({
  id: `nav.${crypto.randomUUID()}`,
  label: '',
  parentId: null,
  position: 0,
  target: { kind: 'route', path: '/' },
})

type MenuStatus = NavigationMenuRecord['status'] | 'unsaved'
type Transition = { action: 'archive' | 'publish'; version: number }

const MenuStatusTag = ({ status }: { status: MenuStatus }) => {
  const { t } = useI18n()
  return (
    <Tag color={status === 'published' ? 'success' : status === 'draft' ? 'blue' : undefined}>
      {t(
        status === 'published'
          ? 'Published'
          : status === 'archived'
            ? 'Archived'
            : status === 'draft'
              ? 'Draft'
              : 'Unsaved'
      )}
    </Tag>
  )
}

export const MenuEditor = ({
  placement,
  onStatusChange,
}: {
  placement: NavigationPlacement
  onStatusChange?: (placement: NavigationPlacement, status: MenuStatus) => void
}) => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const { token } = theme.useToken()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'navigation.write', permissions)
  const canPublish = hasPermission(role, 'navigation.publish', permissions)
  const resourceKinds = (
    [
      ['page', 'content.read'],
      ['article', 'content.read'],
      ['policy', 'policies.read'],
      ['collection', 'catalog.read'],
      ['product', 'catalog.read'],
    ] as const
  )
    .filter(([, permission]) => hasPermission(role, permission, permissions))
    .map(([kind]) => kind)
  const [record, setRecord] = useState<NavigationMenuRecord | null>(null)
  const [items, setItems] = useState<NavigationMenu['items']>(emptyMenu)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [pendingTransition, setPendingTransition] = useState<Transition | null>(null)
  const [transitionOpen, setTransitionOpen] = useState(false)
  const [transitionForm] = Form.useForm<{ reason: string }>()
  const [transitionError, setTransitionError] = useState<ApiError | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const mutationLock = useRef(false)
  const [error, setError] = useState<ApiError | null>(null)
  const isDirty = JSON.stringify(items) !== JSON.stringify(record?.items ?? [])
  const itemActionRef = useRef<HTMLButtonElement>(null)
  const addItemRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchNavigationMenu(placement)
      setRecord(next)
      setItems(next?.items ?? emptyMenu())
      setSelectedId(next?.items[0]?.id ?? null)
      setExpandedKeys(
        next?.items.filter((item) => item.parentId === null).map((item) => item.id) ?? []
      )
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      setLoading(false)
    }
  }, [placement])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    onStatusChange?.(placement, record?.status ?? 'unsaved')
  }, [onStatusChange, placement, record?.status])

  const move = (id: string, action: NavigationMove) => {
    if (!canWrite || saving) return
    const next = moveNavigationItem(items, id, action)
    setItems(next.items)
    setSelectedId(next.focusId ?? null)
    const parentId = next.items.find((item) => item.id === next.focusId)?.parentId
    if (parentId) setExpandedKeys((current) => [...new Set([...current, parentId])])
    if (action === 'remove' && next.focusId) {
      window.requestAnimationFrame(() => itemActionRef.current?.focus())
    } else if (action === 'remove' && next.focusFallback === 'add') {
      window.requestAnimationFrame(() => addItemRef.current?.focus())
    }
  }

  const add = (parentId: string | null) => {
    if (!canWrite || saving) return
    const added = {
      ...newItem(),
      parentId,
      position: items.filter((item) => item.parentId === parentId).length,
    }
    setItems((current) => normalize([...current, added]))
    setSelectedId(added.id)
    if (parentId) setExpandedKeys((current) => [...new Set([...current, parentId])])
  }

  const update = (id: string, patch: Partial<NavigationMenuItemInput>) => {
    if (!canWrite || saving) return
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const reset = () => {
    if (!canWrite || saving) return
    setItems(record?.items ?? emptyMenu())
    setSelectedId(record?.items[0]?.id ?? null)
    setExpandedKeys(
      record?.items.filter((item) => item.parentId === null).map((item) => item.id) ?? []
    )
    setDraftNote('')
    setError(null)
  }

  const persist = async () => {
    if (!canWrite || saving || mutationLock.current) return
    mutationLock.current = true
    setSaving(true)
    setError(null)
    try {
      const next = await saveNavigationMenu(placement, {
        ...(record ? { expectedVersion: record.version } : {}),
        items,
        reason: draftNote,
      })
      setRecord(next)
      setItems(next.items)
      const selected = items.find((item) => item.id === selectedId)
      const selectedParent = items.find((item) => item.id === selected?.parentId)
      const savedParent = selectedParent
        ? next.items.find(
            (item) => item.parentId === null && item.position === selectedParent.position
          )
        : undefined
      const savedSelection =
        next.items.find((item) => item.id === selectedId) ??
        (selected
          ? next.items.find(
              (item) =>
                item.parentId === (savedParent?.id ?? null) && item.position === selected.position
            )
          : undefined)
      setSelectedId(savedSelection?.id ?? next.items[0]?.id ?? null)
      setExpandedKeys(next.items.filter((item) => item.parentId === null).map((item) => item.id))
      setDraftNote('')
      void message.success(t('Navigation draft saved'))
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }

  const transition = async ({ reason }: { reason: string }) => {
    if (
      !canPublish ||
      !record ||
      saving ||
      isDirty ||
      !transitionOpen ||
      !pendingTransition ||
      pendingTransition.version !== record.version ||
      (pendingTransition.action === 'publish'
        ? record.status !== 'draft'
        : record.status === 'archived') ||
      reason.trim().length < 3 ||
      reason.trim().length > 500 ||
      mutationLock.current
    )
      return
    mutationLock.current = true
    setSaving(true)
    setTransitionError(null)
    try {
      const next = await transitionNavigationMenu(placement, pendingTransition.action, {
        confirm: true,
        expectedVersion: pendingTransition.version,
        reason: reason.trim(),
      })
      setRecord(next)
      setItems(next.items)
      setTransitionOpen(false)
      transitionForm.resetFields()
      void message.success(
        t(
          pendingTransition.action === 'publish'
            ? 'Menu published for future storefront versions.'
            : 'Navigation archived'
        )
      )
    } catch (cause) {
      setTransitionError(normalizeApiError(cause))
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }

  const openTransition = (action: Transition['action']) => {
    if (
      !canPublish ||
      !record ||
      saving ||
      isDirty ||
      mutationLock.current ||
      (action === 'publish' ? record.status !== 'draft' : record.status === 'archived')
    )
      return
    transitionForm.resetFields()
    setTransitionError(null)
    setPendingTransition({ action, version: record.version })
    setTransitionOpen(true)
  }

  if (loading) return <Alert className="m-6" type="info" title={t('Loading Navigation menu…')} />
  if (error && !record && items.length === 0) {
    return (
      <Alert
        className="m-6"
        type="error"
        title={t('Navigation could not be loaded')}
        description={localizeApiError(error, t)}
        action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
      />
    )
  }
  const item = items.find((candidate) => candidate.id === selectedId)
  const parent = items.find((candidate) => candidate.id === item?.parentId)

  return (
    <>
      <div className={`${FORM_CARD_BODY_WIDTH_CLASS_NAME.wide} navigation-workspace`}>
        {!onStatusChange ? <MenuStatusTag status={record?.status ?? 'unsaved'} /> : null}
        {error ? (
          <Alert className="mb-6" type="error" showIcon title={localizeApiError(error, t)} />
        ) : null}
        <div
          className="navigation-layout-container"
          style={{ '--navigation-divider-color': token.colorBorderSecondary } as CSSProperties}
        >
          <div className="navigation-layout">
            <NavigationTree
              items={items}
              selectedId={selectedId}
              expandedKeys={expandedKeys}
              canWrite={canWrite}
              busy={saving}
              addRef={addItemRef}
              actionRef={itemActionRef}
              onAdd={add}
              onMove={move}
              onSelect={setSelectedId}
              onExpand={setExpandedKeys}
              onReorder={(next, id) => {
                if (!canWrite || saving) return
                setItems(next)
                setSelectedId(id)
                const parentId = next.find((entry) => entry.id === id)?.parentId
                if (parentId) setExpandedKeys((current) => [...new Set([...current, parentId])])
              }}
            />
            <section className="navigation-editor space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <Typography.Title level={5} className="!mb-0">
                    {t('Edit menu item')}
                  </Typography.Title>
                  {item ? (
                    <Typography.Text type="secondary">
                      {parent ? (parent.label || t('Untitled item')) + ' / ' : ''}
                      {item.label || t('Untitled item')}
                    </Typography.Text>
                  ) : null}
                </div>
              </div>
              {item ? (
                <Form key={item.id} layout="vertical" disabled={!canWrite || saving}>
                  <Form.Item label={t('Item label')}>
                    <Input
                      aria-label={t('Item label')}
                      value={item.label}
                      maxLength={120}
                      onChange={(event) => update(item.id, { label: event.target.value })}
                    />
                  </Form.Item>
                  <Form.Item label={t('Destination type')}>
                    <Select
                      aria-label={t('Destination type')}
                      value={item.target.kind}
                      options={[
                        { label: t('System route'), value: 'route' },
                        {
                          disabled: resourceKinds.length === 0,
                          label: t('Internal resource'),
                          value: 'internal',
                        },
                        { label: t('External HTTPS URL'), value: 'external' },
                      ]}
                      onChange={(kind) => {
                        if (kind === 'internal' && !resourceKinds[0]) return
                        update(item.id, {
                          target:
                            kind === 'route'
                              ? { kind, path: '/' }
                              : kind === 'external'
                                ? { kind, url: 'https://example.com' }
                                : {
                                    kind,
                                    reference: {
                                      id: resourceKinds[0] + '.placeholder',
                                      kind: resourceKinds[0],
                                    } as never,
                                  },
                        })
                      }}
                    />
                  </Form.Item>
                  {item.target.kind === 'route' ? (
                    <Form.Item label={t('Route path')}>
                      <Input
                        aria-label={t('Route path')}
                        value={item.target.path}
                        onChange={(event) =>
                          update(item.id, { target: { kind: 'route', path: event.target.value } })
                        }
                      />
                    </Form.Item>
                  ) : item.target.kind === 'external' ? (
                    <Form.Item label={t('HTTPS URL')}>
                      <Input
                        aria-label={t('HTTPS URL')}
                        value={item.target.url}
                        onChange={(event) =>
                          update(item.id, {
                            target: { kind: 'external', url: event.target.value },
                          })
                        }
                      />
                    </Form.Item>
                  ) : (
                    <>
                      <Form.Item label={t('Resource type')}>
                        <Select
                          aria-label={t('Resource type')}
                          value={item.target.reference.kind}
                          options={resourceKinds
                            .concat(
                              resourceKinds.includes(item.target.reference.kind)
                                ? []
                                : [item.target.reference.kind]
                            )
                            .map((kind) => ({
                              disabled: !resourceKinds.includes(kind),
                              label: t(resourceKindMessages[kind]),
                              value: kind,
                            }))}
                          onChange={(kind) =>
                            update(item.id, {
                              target: {
                                kind: 'internal',
                                reference: { id: kind + '.placeholder', kind } as never,
                              },
                            })
                          }
                        />
                      </Form.Item>
                      <Form.Item>
                        {resourceKinds.includes(item.target.reference.kind) ? (
                          <StorefrontResourcePicker
                            disabled={!canWrite || saving}
                            kind={item.target.reference.kind}
                            label={t('Internal resource')}
                            loadResources={fetchNavigationResources}
                            missing={false}
                            onChange={(id) => {
                              const reference =
                                item.target.kind === 'internal' ? item.target.reference : null
                              if (reference)
                                update(item.id, {
                                  target: {
                                    kind: 'internal',
                                    reference: {
                                      ...reference,
                                      id: id ?? reference.kind + '.placeholder',
                                    } as never,
                                  },
                                })
                            }}
                            selected={{
                              id: item.target.reference.id,
                              kind: item.target.reference.kind,
                              name: item.target.reference.id,
                              path: item.target.reference.id,
                            }}
                            value={item.target.reference.id}
                          />
                        ) : (
                          <Alert
                            type="warning"
                            showIcon
                            title={t('You do not have permission to browse this resource type.')}
                          />
                        )}
                      </Form.Item>
                    </>
                  )}
                </Form>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('Select a menu item to edit its details.')}
                />
              )}
              {canWrite || canPublish ? <Divider /> : null}
              <Form layout="vertical">
                {canWrite ? (
                  <Form.Item label={t('Notes (optional)')}>
                    <Input.TextArea
                      aria-label={t('Notes (optional)')}
                      rows={2}
                      disabled={saving}
                      value={draftNote}
                      maxLength={500}
                      onChange={(event) => setDraftNote(event.target.value)}
                    />
                  </Form.Item>
                ) : null}
              </Form>
              {isDirty && canPublish ? (
                <Typography.Paragraph type="secondary">
                  {t('Save this draft before publishing or archiving.')}
                </Typography.Paragraph>
              ) : null}
              {record ? (
                <details>
                  <summary>{t('Navigation version details')}</summary>
                  <Space wrap className="mt-2">
                    <Tag>{t('Saved v{version}', { version: record.version })}</Tag>
                    <Tag>
                      {t(
                        record.inclusion.candidate
                          ? 'Candidate included'
                          : record.inclusion.candidateStale
                            ? 'Candidate stale: menu order or targets changed'
                            : 'Not in candidate'
                      )}
                    </Tag>
                    {record.inclusion.live ? (
                      <span>
                        {t('This version was included in a deployed storefront version.')}
                      </span>
                    ) : record.inclusion.liveStale ? (
                      <span>
                        {t('A deployed storefront version used an earlier source version.')}
                      </span>
                    ) : null}
                  </Space>
                </details>
              ) : null}
              {record?.inclusion.staleCauses.length ? (
                <Space wrap>
                  {record.inclusion.staleCauses.map((cause) => (
                    <Tag key={cause} color="error">
                      {t('Target stale: {item}', { item: cause.slice('target:'.length) })}
                    </Tag>
                  ))}
                </Space>
              ) : null}
            </section>
          </div>
        </div>
      </div>
      {canWrite || (canPublish && record && record.status !== 'archived') ? (
        <FixedPageToolbar>
          <div className="flex flex-wrap items-start justify-center gap-3">
            {canWrite ? (
              <FormSubmitActions
                submitLabel={t('Save draft')}
                submitLoading={saving}
                submitDisabled={saving}
                onSubmit={() => void persist()}
                resetLabel={t('Reset changes')}
                resetDisabled={saving}
                onReset={reset}
              />
            ) : null}
            {canPublish && record?.status === 'draft' ? (
              <Button disabled={isDirty || saving} onClick={() => openTransition('publish')}>
                {t('Publish')}
              </Button>
            ) : null}
            {canPublish && record && record.status !== 'archived' ? (
              <Button danger disabled={isDirty || saving} onClick={() => openTransition('archive')}>
                {t('Archive')}
              </Button>
            ) : null}
          </div>
        </FixedPageToolbar>
      ) : null}
      <Modal
        open={transitionOpen}
        forceRender
        title={t(
          pendingTransition?.action === 'archive'
            ? 'Archive this Navigation menu?'
            : 'Publish this exact Navigation version?'
        )}
        okText={t(pendingTransition?.action === 'archive' ? 'Archive' : 'Publish')}
        cancelText={t('Cancel')}
        confirmLoading={saving && transitionOpen}
        closable={!saving}
        mask={{ closable: !saving }}
        keyboard={!saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{
          danger: pendingTransition?.action === 'archive',
          disabled: saving || isDirty,
        }}
        onOk={() => transitionForm.submit()}
        onCancel={() => {
          if (saving || mutationLock.current) return
          setTransitionOpen(false)
          setTransitionError(null)
          transitionForm.resetFields()
        }}
      >
        {pendingTransition?.action === 'publish' ? (
          <Typography.Paragraph>
            {t(
              'This menu becomes available to future storefront versions. The current storefront is unchanged.'
            )}
          </Typography.Paragraph>
        ) : null}
        {transitionError ? (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={localizeApiError(transitionError, t)}
          />
        ) : null}
        <Form
          name={`navigation-${placement}-transition`}
          form={transitionForm}
          layout="vertical"
          disabled={saving}
          onFinish={(values) => void transition(values)}
        >
          <Form.Item
            name="reason"
            label={t(
              pendingTransition?.action === 'archive' ? 'Archive reason' : 'Publication reason'
            )}
            rules={[
              { required: true, whitespace: true },
              { transform: (value: string) => value?.trim(), min: 3, max: 500 },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export const NavigationPage = () => {
  const { t } = useI18n()
  const [activePlacement, setActivePlacement] = useState<NavigationPlacement>('header')
  const [visitedPlacements, setVisitedPlacements] = useState<NavigationPlacement[]>(['header'])
  const [statuses, setStatuses] = useState<Record<NavigationPlacement, MenuStatus>>({
    header: 'unsaved',
    footer: 'unsaved',
  })
  const onStatusChange = useCallback((placement: NavigationPlacement, status: MenuStatus) => {
    setStatuses((current) =>
      current[placement] === status ? current : { ...current, [placement]: status }
    )
  }, [])
  return (
    <CustomPageRecipe title={t('Navigation')}>
      <Card
        className="navigation-card"
        styles={{ body: { padding: 0 } }}
        tabList={[
          { key: 'header', tab: t('Header menu') },
          { key: 'footer', tab: t('Footer menu') },
        ]}
        activeTabKey={activePlacement}
        onTabChange={(key) => {
          const placement = key as NavigationPlacement
          setActivePlacement(placement)
          setVisitedPlacements((current) =>
            current.includes(placement) ? current : [...current, placement]
          )
        }}
        tabBarExtraContent={<MenuStatusTag status={statuses[activePlacement]} />}
      >
        {visitedPlacements.map((placement) => (
          <div key={placement} hidden={placement !== activePlacement}>
            <MenuEditor placement={placement} onStatusChange={onStatusChange} />
          </div>
        ))}
      </Card>
    </CustomPageRecipe>
  )
}
