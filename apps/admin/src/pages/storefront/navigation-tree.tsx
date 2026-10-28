import type { NavigationMenu } from '@shoppp/contracts'
import {
  FileOutlined,
  FolderOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Empty, Space, Tooltip, Tree, Typography } from 'antd'
import { FoldVertical, UnfoldVertical } from 'lucide-react'
import React, { type RefObject } from 'react'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

type Items = NavigationMenu['items']
export type NavigationMove = 'up' | 'down' | 'indent' | 'outdent' | 'remove'
type DropPosition = 'before' | 'after' | 'inside'

export const normalizeNavigationItems = (
  items: NavigationMenu['items']
): NavigationMenu['items'] => {
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

export function dropNavigationItem(
  items: Items,
  id: string,
  targetId: string,
  position: DropPosition
): Items {
  const item = items.find((entry) => entry.id === id)
  const target = items.find((entry) => entry.id === targetId)
  if (!item || !target || id === targetId || target.parentId === id) return items
  const parentId = position === 'inside' ? target.id : target.parentId
  if (
    (position === 'inside' && target.parentId) ||
    (parentId && items.some((entry) => entry.parentId === id))
  )
    return items
  const siblings = items
    .filter((entry) => entry.parentId === parentId && entry.id !== id)
    .sort((a, b) => a.position - b.position)
  const index =
    position === 'inside'
      ? siblings.length
      : siblings.findIndex((entry) => entry.id === targetId) + (position === 'after' ? 1 : 0)
  siblings.splice(index, 0, { ...item, parentId })
  const positions = new Map(siblings.map((entry, position) => [entry.id, { ...entry, position }]))
  const next = items.map((entry) => positions.get(entry.id) ?? entry)
  return normalizeNavigationItems(next)
}

export const NavigationTree = ({
  items,
  selectedId,
  expandedKeys,
  canWrite,
  busy,
  addRef,
  actionRef,
  onAdd,
  onMove,
  onReorder,
  onSelect,
  onExpand,
}: {
  items: Items
  selectedId: string | null
  expandedKeys: React.Key[]
  canWrite: boolean
  busy: boolean
  addRef: RefObject<HTMLButtonElement | null>
  actionRef: RefObject<HTMLButtonElement | null>
  onAdd: (parentId: string | null) => void
  onMove: (id: string, action: NavigationMove) => void
  onReorder: (items: Items, selectedId: string) => void
  onSelect: (id: string) => void
  onExpand: (keys: React.Key[]) => void
}) => {
  const { t } = useI18n()
  const roots = items
    .filter((entry) => entry.parentId === null)
    .sort((a, b) => a.position - b.position)
  const parentKeys = roots
    .filter((root) => items.some((entry) => entry.parentId === root.id))
    .map((root) => root.id)
  const renderTitle = (item: Items[number]) => {
    const hasChildren = items.some((entry) => entry.parentId === item.id)
    const siblings = items
      .filter((entry) => entry.parentId === item.parentId)
      .sort((a, b) => a.position - b.position)
    const index = siblings.findIndex((entry) => entry.id === item.id)
    const label = item.label || t('Untitled item')
    return (
      <div className="navigation-tree-item" data-navigation-item={item.id}>
        <span className="navigation-tree-label" title={label}>
          {label}
        </span>
        {canWrite ? (
          <span
            className="navigation-tree-actions"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
            draggable={false}
          >
            {item.parentId === null ? (
              <Tooltip title={t('Add child item')}>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  aria-label={t('Add child item to {item}', { item: label })}
                  disabled={busy}
                  onClick={() => onAdd(item.id)}
                />
              </Tooltip>
            ) : null}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'up', label: t('Move up'), disabled: busy || index === 0 },
                  {
                    key: 'down',
                    label: t('Move down'),
                    disabled: busy || index === siblings.length - 1,
                  },
                  {
                    key: 'outdent',
                    label: t('Promote one level'),
                    disabled: busy || !item.parentId,
                  },
                  {
                    key: 'indent',
                    label: t('Make a child item'),
                    disabled: busy || Boolean(item.parentId) || index === 0 || hasChildren,
                  },
                  { type: 'divider' },
                  { key: 'remove', label: t('Delete menu item'), danger: true, disabled: busy },
                ],
                onClick: ({ key }) => onMove(item.id, key as NavigationMove),
              }}
            >
              <Tooltip title={t('Menu item actions')}>
                <Button
                  ref={selectedId === item.id ? actionRef : undefined}
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  aria-label={t('Menu item actions for {item}', { item: label })}
                  disabled={busy}
                />
              </Tooltip>
            </Dropdown>
          </span>
        ) : null}
      </div>
    )
  }
  const treeData = roots.map((root) => {
    const children = items
      .filter((entry) => entry.parentId === root.id)
      .sort((a, b) => a.position - b.position)
    return {
      key: root.id,
      icon: children.length ? <FolderOutlined /> : <FileOutlined />,
      title: renderTitle(root),
      children: children.map((child) => ({
        key: child.id,
        icon: <FileOutlined />,
        title: renderTitle(child),
      })),
    }
  })

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography.Title level={5} className="!mb-0">
          {t('Menu structure')}
        </Typography.Title>
        <Space size={0}>
          <Tooltip title={t('Expand all')}>
            <Button
              type="text"
              icon={<UnfoldVertical size={16} aria-hidden />}
              aria-label={t('Expand all')}
              disabled={!parentKeys.length}
              onClick={() => onExpand(parentKeys)}
            />
          </Tooltip>
          <Tooltip title={t('Collapse all')}>
            <Button
              type="text"
              icon={<FoldVertical size={16} aria-hidden />}
              aria-label={t('Collapse all')}
              disabled={!parentKeys.length}
              onClick={() => onExpand([])}
            />
          </Tooltip>
        </Space>
      </div>
      {canWrite ? (
        <Button ref={addRef} disabled={busy} onClick={() => onAdd(null)}>
          {t('Add menu item')}
        </Button>
      ) : null}
      {items.length ? (
        <Tree
          className="navigation-tree"
          aria-label={t('Menu structure')}
          blockNode
          showIcon
          showLine={{ showLeafIcon: false }}
          virtual={false}
          disabled={busy}
          draggable={canWrite && !busy ? { icon: <HolderOutlined /> } : false}
          treeData={treeData}
          selectedKeys={selectedId ? [selectedId] : []}
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          onSelect={(keys) => {
            if (keys[0]) onSelect(String(keys[0]))
          }}
          allowDrop={({ dragNode, dropNode, dropPosition }) =>
            canWrite &&
            !busy &&
            dropNavigationItem(
              items,
              String(dragNode.key),
              String(dropNode.key),
              dropPosition === 0 ? 'inside' : dropPosition < 0 ? 'before' : 'after'
            ) !== items
          }
          onDrop={(info) => {
            if (!canWrite || busy) return
            const position = info.dropPosition - Number(info.node.pos.split('-').at(-1))
            const next = dropNavigationItem(
              items,
              String(info.dragNode.key),
              String(info.node.key),
              !info.dropToGap ? 'inside' : position < 0 ? 'before' : 'after'
            )
            if (next !== items) onReorder(next, String(info.dragNode.key))
          }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className="space-y-1">
              <div>{t('No optional menu items')}</div>
              <Typography.Text type="secondary">
                {t('Add an item to show this optional Navigation region.')}
              </Typography.Text>
            </div>
          }
        />
      )}
    </section>
  )
}
