import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Space } from 'antd'
import React from 'react'

void React

type SortActionGroupProps = {
  index: number
  count: number
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  nested?: boolean
}

const formatIndexLabel = (index: number, nested?: boolean) => {
  const prefix = nested ? '&' : '#'
  const value = String(index + 1).padStart(2, '0')
  return `${prefix}${value}`
}

export const SortActionGroup = ({ index, count, onMoveUp, onMoveDown, onRemove, nested }: SortActionGroupProps) => (
  <Space>
    <Button type="text" className="p-2" style={{ color: 'var(--ant-color-primary)' }} tabIndex={-1}>
      {formatIndexLabel(index, nested)}
    </Button>
    <Button icon={<ArrowUpOutlined />} disabled={index === 0} onClick={onMoveUp} />
    <Button icon={<ArrowDownOutlined />} disabled={index === count - 1} onClick={onMoveDown} />
    <Button icon={<DeleteOutlined />} danger onClick={onRemove} />
  </Space>
)
