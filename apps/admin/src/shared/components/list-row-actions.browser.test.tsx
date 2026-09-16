import React from 'react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ConfigProvider, Table, theme, type TableColumnsType } from 'antd'
import '../../index.css'
import { ListRowActions, type ListRowActionSpec } from './list-row-actions'

void React

type VirtualRow = {
  key: string
  name: string
  wraps: boolean
}

const createActions = (wraps: boolean): ListRowActionSpec[] => {
  const actions: ListRowActionSpec[] = [
    { key: 'view', label: '查看', contentWidth: 30 },
    { key: 'edit', label: '编辑', contentWidth: 30 },
  ]

  return wraps
    ? [
        ...actions,
        { key: 'copy', label: '复制', contentWidth: 30 },
        { key: 'delete', label: '删除', contentWidth: 30, danger: true },
      ]
    : actions
}

const dataSource: VirtualRow[] = Array.from({ length: 120 }, (_, index) => ({
  key: `row-${index + 1}`,
  name: `记录 ${index + 1}`,
  wraps: index % 2 === 1,
}))

const columns: TableColumnsType<VirtualRow> = [
  { title: '名称', dataIndex: 'name', width: 220 },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 132,
    render: (_, record) => (
      <ListRowActions
        actions={createActions(record.wraps)}
        layoutMode="wrapped"
        maxRowContentWidth={100}
      />
    ),
  },
]

const waitForVirtualFrame = async () => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

afterEach(cleanup)

describe('ListRowActions virtual table preflight', () => {
  it.each([
    ['light', undefined],
    ['dark', theme.darkAlgorithm],
  ] as const)(
    'keeps mixed row heights and fixed cells aligned in %s theme',
    async (_, algorithm) => {
      render(
        <ConfigProvider theme={{ algorithm }}>
          <div style={{ width: 360 }}>
            <Table<VirtualRow>
              columns={columns}
              dataSource={dataSource}
              pagination={false}
              scroll={{ x: 600, y: 240 }}
              size="large"
              virtual
            />
          </div>
        </ConfigProvider>
      )

      await expect.element(page.getByText('记录 1')).toBeVisible()
      await expect.element(page.getByText('记录 2')).toBeVisible()

      const singleRow = document.querySelector<HTMLElement>('[data-row-key="row-1"]')
      const wrappedRow = document.querySelector<HTMLElement>('[data-row-key="row-2"]')
      expect(singleRow).not.toBeNull()
      expect(wrappedRow).not.toBeNull()
      expect(wrappedRow!.getBoundingClientRect().height).toBeGreaterThan(
        singleRow!.getBoundingClientRect().height
      )
      expect(singleRow!.querySelectorAll('[data-list-row-actions-row]')).toHaveLength(1)
      expect(wrappedRow!.querySelectorAll('[data-list-row-actions-row]')).toHaveLength(2)

      const virtualHolder = document.querySelector<HTMLElement>('.ant-table-tbody-virtual-holder')
      const horizontalScroller = document.querySelector<HTMLElement>('.ant-table-body')
      expect(virtualHolder).not.toBeNull()
      await act(async () => {
        virtualHolder!.scrollTop = virtualHolder!.scrollHeight
        fireEvent.scroll(virtualHolder!)
        if (horizontalScroller) {
          horizontalScroller.scrollLeft = horizontalScroller.scrollWidth
          fireEvent.scroll(horizontalScroller)
        }
        await waitForVirtualFrame()
      })

      const renderedRows = Array.from(
        document.querySelectorAll<HTMLElement>('[data-row-key^="row-"]')
      )
      expect(renderedRows.some((row) => row.dataset.rowKey === 'row-120')).toBe(true)
      renderedRows.forEach((row) => {
        const fixedCell = row.querySelector<HTMLElement>('.ant-table-cell-fix-end')
        expect(fixedCell).not.toBeNull()
        expect(window.getComputedStyle(fixedCell!).position).toBe('sticky')
        expect(
          Math.abs(fixedCell!.getBoundingClientRect().top - row.getBoundingClientRect().top)
        ).toBeLessThan(1)
        expect(
          Math.abs(fixedCell!.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom)
        ).toBeLessThan(1)
      })
    },
    15_000
  )
})
