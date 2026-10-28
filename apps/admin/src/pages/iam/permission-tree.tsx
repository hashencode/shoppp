import { ADMIN_PERMISSION_CATALOG, type AdminPermission } from '@shoppp/contracts'
import { Button, Checkbox, Input, Space, Tooltip, Tree, Typography } from 'antd'
import type { TreeDataNode } from 'antd'
import { FoldVertical, UnfoldVertical } from 'lucide-react'
import React, { useState } from 'react'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

type PermissionTreeProps = {
  disabled?: boolean
  onChange?: (value: AdminPermission[]) => void
  permitted: readonly AdminPermission[]
  value?: readonly AdminPermission[]
}

export const PermissionTree = ({
  disabled = false,
  onChange,
  permitted,
  value = [],
}: PermissionTreeProps) => {
  const { t } = useI18n()
  const entries = ADMIN_PERMISSION_CATALOG.filter((entry) => permitted.includes(entry.key))
  const categories = [...new Set(entries.map((entry) => entry.category))]
  const groups = categories.map((category) => {
    const children = entries.filter((entry) => entry.category === category)
    return {
      key: `category:${category}`,
      category,
      children,
      checkedCount: children.filter((entry) => value.includes(entry.key)).length,
    }
  })
  const categoryKeys = groups.map((group) => group.key)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(categoryKeys)
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const selected = entries.filter((entry) => value.includes(entry.key))
  const matches = (text: string) => Boolean(query && text.toLocaleLowerCase().includes(query))
  const matchingKeys = new Set<string>()
  for (const entry of entries) {
    if (matches(`${entry.key} ${t(entry.label)} ${t(entry.description)} ${t(entry.category)}`)) {
      matchingKeys.add(entry.key)
      matchingKeys.add(`category:${entry.category}`)
    }
  }
  const treeData: TreeDataNode[] = groups.map((group) => ({
    key: group.key,
    disableCheckbox: disabled,
    title: (
      <Space>
        <span className="font-medium capitalize">{t(group.category)}</span>
        <Typography.Text type="secondary">
          {group.checkedCount}/{group.children.length}
        </Typography.Text>
      </Space>
    ),
    children: group.children.map((entry) => ({
      key: entry.key,
      disableCheckbox: disabled,
      title: <span title={t(entry.description)}>{t(entry.label)}</span>,
    })),
  }))
  // Disabled checkboxes stop Ant Design's parent conduction. Project the stored
  // readonly values explicitly; editable parent/child interaction stays library-owned.
  const readonlyCheckedKeys = {
    checked: [
      ...selected.map((entry) => entry.key),
      ...groups
        .filter((group) => group.checkedCount === group.children.length)
        .map((group) => group.key),
    ],
    halfChecked: groups
      .filter((group) => group.checkedCount > 0 && group.checkedCount < group.children.length)
      .map((group) => group.key),
  }

  return (
    <div className="space-y-3">
      <Input
        allowClear
        disabled={false}
        aria-label={t('Search permissions')}
        placeholder={t('Search permissions')}
        value={search}
        onChange={(event) => {
          const nextSearch = event.target.value
          setSearch(nextSearch)
          if (nextSearch.trim()) setExpandedKeys(categoryKeys)
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox
          disabled={disabled || !entries.length}
          checked={entries.length > 0 && selected.length === entries.length}
          indeterminate={selected.length > 0 && selected.length < entries.length}
          onChange={(event) => {
            if (!disabled) onChange?.(event.target.checked ? entries.map((entry) => entry.key) : [])
          }}
        >
          {t('Select all permissions')}
        </Checkbox>
        <Space size={0}>
          <Tooltip title={t('Expand all')}>
            <Button
              type="text"
              icon={<UnfoldVertical size={16} aria-hidden />}
              aria-label={t('Expand all')}
              disabled={false}
              onClick={() => setExpandedKeys(categoryKeys)}
            />
          </Tooltip>
          <Tooltip title={t('Collapse all')}>
            <Button
              type="text"
              icon={<FoldVertical size={16} aria-hidden />}
              aria-label={t('Collapse all')}
              disabled={false}
              onClick={() => setExpandedKeys([])}
            />
          </Tooltip>
        </Space>
      </div>
      {query && !matchingKeys.size ? (
        <Typography.Text type="secondary">{t('No matching permissions')}</Typography.Text>
      ) : null}
      <Tree
        aria-label={t('Role permissions')}
        checkable
        disabled={false}
        checkStrictly={disabled}
        selectable={false}
        showLine={{ showLeafIcon: false }}
        virtual={false}
        treeData={treeData}
        checkedKeys={disabled ? readonlyCheckedKeys : selected.map((entry) => entry.key)}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        filterTreeNode={(node) => matchingKeys.has(String(node.key))}
        onCheck={(checkedKeys) => {
          if (disabled || !Array.isArray(checkedKeys)) return
          onChange?.(
            entries.filter((entry) => checkedKeys.includes(entry.key)).map((entry) => entry.key)
          )
        }}
      />
    </div>
  )
}
