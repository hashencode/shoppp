import type { NavigationMenu, NavigationMenuItemInput } from '@shoppp/contracts'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Input, Popconfirm, Select, Space, Tabs, Tag } from 'antd'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { StorefrontResourcePicker } from './storefront-resource-picker'

void React

type Move = 'down' | 'indent' | 'outdent' | 'remove' | 'up'

const normalize = (items: NavigationMenu['items']): NavigationMenu['items'] => {
  const roots = items
    .filter(({ parentId }) => parentId === null)
    .sort((a, b) => a.position - b.position)
  const children = new Map<string, NavigationMenu['items']>()
  for (const item of items) {
    if (item.parentId)
      children.set(
        item.parentId,
        [...(children.get(item.parentId) ?? []), item].sort((a, b) => a.position - b.position)
      )
  }
  return roots.flatMap((root, rootPosition) => [
    { ...root, position: rootPosition },
    ...(children.get(root.id) ?? []).map((child, position) => ({ ...child, position })),
  ])
}

export function moveNavigationItem(
  source: NavigationMenu['items'],
  id: string,
  action: Move
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
    if (item.parentId || index === 0) return { focusId: id, items }
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

export const MenuEditor = ({ placement }: { placement: NavigationPlacement }) => {
  const { message } = App.useApp()
  const { t } = useI18n()
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
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const isDirty = JSON.stringify(items) !== JSON.stringify(record?.items ?? [])
  const actionRefs = useRef(new Map<string, HTMLElement>())
  const addItemRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchNavigationMenu(placement)
      setRecord(next)
      setItems(next?.items ?? emptyMenu())
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

  const move = (id: string, action: Move) => {
    const next = moveNavigationItem(items, id, action)
    setItems(next.items)
    if (next.focusId) {
      window.requestAnimationFrame(() => actionRefs.current.get(`${next.focusId}:remove`)?.focus())
    } else if (next.focusFallback === 'add') {
      window.requestAnimationFrame(() => addItemRef.current?.focus())
    }
  }

  const update = (id: string, patch: Partial<NavigationMenuItemInput>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const persist = async () => {
    if (!canWrite || saving || reason.trim().length < 3) return
    setSaving(true)
    setError(null)
    try {
      const next = await saveNavigationMenu(placement, {
        ...(record ? { expectedVersion: record.version } : {}),
        items,
        reason,
      })
      setRecord(next)
      setItems(next.items)
      setReason('')
      void message.success(t('Navigation draft saved'))
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      setSaving(false)
    }
  }

  const transition = async (action: 'archive' | 'publish') => {
    if (!record || saving || isDirty || reason.trim().length < 3) return
    setSaving(true)
    setError(null)
    try {
      const next = await transitionNavigationMenu(placement, action, {
        confirm: true,
        expectedVersion: record.version,
        reason,
      })
      setRecord(next)
      setItems(next.items)
      setReason('')
      void message.success(t(action === 'publish' ? 'Navigation published' : 'Navigation archived'))
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Alert type="info" title={t('Loading Navigation menu…')} />
  if (error && !record && items.length === 0) {
    return (
      <Alert
        type="error"
        title={t('Navigation could not be loaded')}
        description={localizeApiError(error, t)}
        action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
      />
    )
  }
  const roots = items.filter(({ parentId }) => parentId === null)
  return (
    <Space orientation="vertical" className="w-full" size="large">
      {error ? <Alert type="error" title={localizeApiError(error, t)} /> : null}
      <Space wrap>
        <Tag>
          {record
            ? t(
                record.status === 'published'
                  ? 'Published'
                  : record.status === 'archived'
                    ? 'Archived'
                    : 'Draft'
              )
            : t('Unsaved')}
        </Tag>
        {record ? <Tag>{t('Saved v{version}', { version: record.version })}</Tag> : null}
        {record ? (
          <Tag color={record.inclusion.candidate ? 'blue' : 'default'}>
            {t(
              record.inclusion.candidate
                ? 'Candidate included'
                : record.inclusion.candidateStale
                  ? 'Candidate stale: menu order or targets changed'
                  : 'Not in candidate'
            )}
          </Tag>
        ) : null}
        {record ? (
          <Tag color={record.inclusion.live ? 'green' : 'default'}>
            {t(
              record.inclusion.live
                ? 'Live included'
                : record.inclusion.liveStale
                  ? 'Live stale: menu order or targets changed'
                  : 'Not live'
            )}
          </Tag>
        ) : null}
        {record?.inclusion.staleCauses.map((cause) => (
          <Tag key={cause} color="error">
            {t('Target stale: {item}', { item: cause.slice('target:'.length) })}
          </Tag>
        ))}
      </Space>
      {items.length === 0 ? (
        <Alert
          type="info"
          title={t('No optional menu items')}
          description={t('Add an item to show this optional Navigation region.')}
        />
      ) : null}
      {items.map((item) => {
        const siblings = items.filter(({ parentId }) => parentId === item.parentId)
        const siblingIndex = siblings.findIndex(({ id }) => id === item.id)
        return (
          <Card
            key={item.id}
            size="small"
            className={item.parentId ? 'ms-8' : undefined}
            title={item.label || t('Untitled item')}
          >
            <Space orientation="vertical" className="w-full">
              <Input
                aria-label={t('Item label')}
                disabled={!canWrite}
                value={item.label}
                maxLength={120}
                onChange={(event) => update(item.id, { label: event.target.value })}
              />
              <Select
                aria-label={t('Destination type')}
                className="w-full"
                disabled={!canWrite}
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
                                id: `${resourceKinds[0]}.placeholder`,
                                kind: resourceKinds[0],
                              } as never,
                            },
                  })
                }}
              />
              {item.target.kind === 'route' ? (
                <Input
                  aria-label={t('Route path')}
                  disabled={!canWrite}
                  value={item.target.path}
                  onChange={(event) =>
                    update(item.id, { target: { kind: 'route', path: event.target.value } })
                  }
                />
              ) : item.target.kind === 'external' ? (
                <Input
                  aria-label={t('HTTPS URL')}
                  disabled={!canWrite}
                  value={item.target.url}
                  onChange={(event) =>
                    update(item.id, { target: { kind: 'external', url: event.target.value } })
                  }
                />
              ) : (
                <Space orientation="vertical" className="w-full">
                  <Select
                    aria-label={t('Resource type')}
                    disabled={!canWrite}
                    value={item.target.reference.kind}
                    options={resourceKinds
                      .concat(
                        resourceKinds.includes(item.target.reference.kind)
                          ? []
                          : [item.target.reference.kind]
                      )
                      .map((kind) => ({
                        disabled: !resourceKinds.includes(kind),
                        label: t(kind),
                        value: kind,
                      }))}
                    onChange={(kind) =>
                      update(item.id, {
                        target: {
                          kind: 'internal',
                          reference: { id: `${kind}.placeholder`, kind } as never,
                        },
                      })
                    }
                  />
                  {resourceKinds.includes(item.target.reference.kind) ? (
                    <StorefrontResourcePicker
                      disabled={!canWrite}
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
                                id: id ?? `${reference.kind}.placeholder`,
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
                      title={t('You do not have permission to browse this resource type.')}
                    />
                  )}
                </Space>
              )}
              <Space wrap>
                {(
                  [
                    ['up', ArrowUpOutlined, siblingIndex === 0],
                    ['down', ArrowDownOutlined, siblingIndex === siblings.length - 1],
                    ['indent', ArrowRightOutlined, Boolean(item.parentId) || siblingIndex === 0],
                    ['outdent', ArrowLeftOutlined, !item.parentId],
                    ['remove', DeleteOutlined, false],
                  ] as const
                ).map(([action, Icon, boundary]) => (
                  <Button
                    key={action}
                    ref={(element) => {
                      if (element) actionRefs.current.set(`${item.id}:${action}`, element)
                    }}
                    aria-label={t(`${action} item`)}
                    icon={<Icon />}
                    disabled={!canWrite || boundary}
                    onClick={() => move(item.id, action)}
                  />
                ))}
              </Space>
            </Space>
          </Card>
        )
      })}
      {canWrite ? (
        <Button
          ref={addItemRef}
          onClick={() =>
            setItems((current) => normalize([...current, { ...newItem(), position: roots.length }]))
          }
        >
          {t('Add menu item')}
        </Button>
      ) : null}
      {canWrite || canPublish ? (
        <Input
          aria-label={t('Change reason')}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('Explain this Navigation change')}
        />
      ) : null}
      <Space wrap>
        {canWrite ? (
          <Button
            type="primary"
            loading={saving}
            disabled={reason.trim().length < 3}
            onClick={() => void persist()}
          >
            {t('Save draft')}
          </Button>
        ) : null}
        {canPublish && record?.status === 'draft' ? (
          <Popconfirm
            title={t('Publish this exact Navigation version?')}
            disabled={isDirty || saving || reason.trim().length < 3}
            onConfirm={() => void transition('publish')}
          >
            <Button disabled={isDirty || saving || reason.trim().length < 3}>{t('Publish')}</Button>
          </Popconfirm>
        ) : null}
        {canPublish && record && record.status !== 'archived' ? (
          <Popconfirm
            title={t('Archive this Navigation menu?')}
            disabled={isDirty || saving || reason.trim().length < 3}
            onConfirm={() => void transition('archive')}
          >
            <Button danger disabled={isDirty || saving || reason.trim().length < 3}>
              {t('Archive')}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Space>
  )
}

export const NavigationPage = () => {
  const { t } = useI18n()
  const tabs = useMemo(
    () => [
      { key: 'header', label: t('Header menu'), children: <MenuEditor placement="header" /> },
      { key: 'footer', label: t('Footer menu'), children: <MenuEditor placement="footer" /> },
    ],
    [t]
  )
  return (
    <CustomPageRecipe title={t('Navigation')}>
      <Tabs items={tabs} />
    </CustomPageRecipe>
  )
}
