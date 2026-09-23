import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Space } from 'antd'
import React from 'react'

void React

type SortActionGroupProps = {
  index: number
  count: number
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  nested?: boolean
  disabled?: boolean
  moveDownLabel?: string
  moveUpLabel?: string
  removeLabel?: string
  removeConfirmTitle?: string
}

const formatIndexLabel = (index: number, nested?: boolean) => {
  const prefix = nested ? '&' : '#'
  const value = String(index + 1).padStart(2, '0')
  return `${prefix}${value}`
}

export const SortActionGroup = ({ index, count, onMoveUp, onMoveDown, onRemove, nested, disabled, moveDownLabel, moveUpLabel, removeLabel, removeConfirmTitle }: SortActionGroupProps) => (
  <Space>
    <Button type="text" className="p-2" style={{ color: 'var(--ant-color-primary)' }} tabIndex={-1}>
      {formatIndexLabel(index, nested)}
    </Button>
    <Button aria-label={moveUpLabel} icon={<ArrowUpOutlined />} disabled={disabled || index === 0} onClick={onMoveUp} />
    <Button aria-label={moveDownLabel} icon={<ArrowDownOutlined />} disabled={disabled || index === count - 1} onClick={onMoveDown} />
    <Popconfirm disabled={disabled || !removeConfirmTitle} title={removeConfirmTitle} onConfirm={onRemove}>
      <Button aria-label={removeLabel} icon={<DeleteOutlined />} disabled={disabled} danger onClick={removeConfirmTitle ? undefined : onRemove} />
    </Popconfirm>
  </Space>
)
