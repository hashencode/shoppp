import type { DragEndEvent } from '@dnd-kit/core'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColumnHeightOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Checkbox, Divider, Dropdown, Tooltip, theme } from 'antd'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Columns3Cog } from 'lucide-react'
import React, { type ReactNode, useId, useMemo } from 'react'
import { useI18n } from '../contexts/i18n-context'

void React

export const DEFAULT_TABLE_DENSITY_ITEMS: MenuProps['items'] = [
  { key: 'large', label: 'Comfortable' },
  { key: 'middle', label: 'Default' },
  { key: 'small', label: 'Compact' },
]

export type ListToolbarColumnSettingOption = {
  key: string
  label: ReactNode
  disabled?: boolean
}

const COLUMN_SETTING_DRAG_DISTANCE = 6

export const buildListToolbarColumnSettingOptions = <TItem,>(
  columns: ColumnsType<TItem>
): ListToolbarColumnSettingOption[] =>
  columns
    .filter((column) => typeof column.key === 'string')
    .map((column) => ({
      key: String(column.key),
      label:
        typeof column.title === 'function'
          ? String(column.key)
          : (column.title ?? String(column.key)),
    }))

type ListToolbarActionsProps = {
  tableSize: 'small' | 'middle' | 'large'
  densityItems?: MenuProps['items']
  onTableSizeChange: (size: 'small' | 'middle' | 'large') => void
  onClearColumnSort?: () => void
  clearColumnSortDisabled?: boolean
  reloadLoading?: boolean
  onReload: () => void
  showLeadingDivider?: boolean
  columnSettingOptions: ListToolbarColumnSettingOption[]
  selectedColumnKeys: string[]
  onSelectedColumnKeysChange: (keys: string[]) => void
  onColumnSettingOrderChange?: (keys: string[]) => void
  columnSettingMinWidth?: number
}

type SortableColumnSettingRowProps = {
  checked: boolean
  option: ListToolbarColumnSettingOption
  onCheckedChange: (key: string, checked: boolean) => void
}

const SortableColumnSettingRow = ({
  checked,
  option,
  onCheckedChange,
}: SortableColumnSettingRowProps) => {
  const { token } = theme.useToken()
  const labelId = useId()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.key,
    disabled: option.disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 rounded-md px-2 py-1"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        background: isDragging ? token.colorBgElevated : undefined,
      }}
    >
      <Checkbox
        checked={checked}
        disabled={option.disabled}
        onChange={(event) => onCheckedChange(option.key, event.target.checked)}
        aria-labelledby={labelId}
      />
      <span
        id={labelId}
        className={`flex-1 select-none text-sm ${option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-move'}`}
        {...(!option.disabled ? attributes : {})}
        {...(!option.disabled ? listeners : {})}
      >
        {option.label}
      </span>
    </div>
  )
}

export const ListToolbarActions = ({
  tableSize,
  densityItems,
  onTableSizeChange,
  onClearColumnSort,
  clearColumnSortDisabled = true,
  reloadLoading = false,
  onReload,
  showLeadingDivider = false,
  columnSettingOptions,
  selectedColumnKeys,
  onSelectedColumnKeysChange,
  onColumnSettingOrderChange,
  columnSettingMinWidth = 220,
}: ListToolbarActionsProps) => {
  const { token } = theme.useToken()
  const { t } = useI18n()
  const resolvedDensityItems = useMemo(
    () =>
      densityItems ??
      DEFAULT_TABLE_DENSITY_ITEMS?.map((item) =>
        item && 'label' in item
          ? { ...item, label: typeof item.label === 'string' ? t(item.label) : item.label }
          : item
      ),
    [densityItems, t]
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: COLUMN_SETTING_DRAG_DISTANCE,
      },
    })
  )
  const visibleColumnKeySet = new Set(selectedColumnKeys)

  const handleColumnSettingCheckedChange = (key: string, checked: boolean) => {
    const nextSelectedColumnKeys = checked
      ? [...selectedColumnKeys, key]
      : selectedColumnKeys.filter((selectedKey) => selectedKey !== key)
    onSelectedColumnKeysChange(nextSelectedColumnKeys)
  }

  const handleColumnSettingDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id)
    const overKey = over ? String(over.id) : null

    if (!overKey || activeKey === overKey || !onColumnSettingOrderChange) {
      return
    }

    const activeIndex = columnSettingOptions.findIndex((option) => option.key === activeKey)
    const overIndex = columnSettingOptions.findIndex((option) => option.key === overKey)

    if (activeIndex < 0 || overIndex < 0) {
      return
    }

    const nextOptions = arrayMove(columnSettingOptions, activeIndex, overIndex)
    onColumnSettingOrderChange(nextOptions.map((option) => option.key))
  }

  return (
    <div className="inline-flex items-center gap-2">
      {showLeadingDivider ? <Divider orientation="vertical" className="!mx-0 !h-5" /> : null}
      <Button
        icon={<ReloadOutlined />}
        aria-label={t('Refresh')}
        loading={reloadLoading}
        onClick={onReload}
      >
        {t('Refresh')}
      </Button>
      <Dropdown
        menu={{
          selectedKeys: [tableSize],
          items: resolvedDensityItems,
          onClick: ({ key }) => onTableSizeChange(key as 'small' | 'middle' | 'large'),
        }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Tooltip title={t('Density')}>
          <Button icon={<ColumnHeightOutlined />} aria-label={t('Density')} />
        </Tooltip>
      </Dropdown>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        popupRender={() => (
          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleColumnSettingDragEnd}
          >
            <SortableContext
              items={columnSettingOptions.map((option) => option.key)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="flex flex-col gap-3 rounded-xl border p-2 shadow-sm"
                style={{
                  minWidth: columnSettingMinWidth,
                  background: token.colorBgElevated,
                  borderColor: token.colorBorderSecondary,
                  boxShadow: token.boxShadowSecondary,
                }}
              >
                <div className="flex max-h-[500px] flex-col overflow-y-auto">
                  {columnSettingOptions.map((option) => (
                    <SortableColumnSettingRow
                      key={option.key}
                      option={option}
                      checked={visibleColumnKeySet.has(option.key)}
                      onCheckedChange={handleColumnSettingCheckedChange}
                    />
                  ))}
                </div>
                {onClearColumnSort ? (
                  <Button
                    type="text"
                    size="small"
                    className="self-start"
                    disabled={clearColumnSortDisabled}
                    onClick={onClearColumnSort}
                  >
                    {t('Reset column order')}
                  </Button>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        )}
      >
        <Tooltip title={t('Column settings')}>
          <Button
            icon={<Columns3Cog size={16} strokeWidth={1.8} />}
            aria-label={t('Column settings')}
          />
        </Tooltip>
      </Dropdown>
    </div>
  )
}
