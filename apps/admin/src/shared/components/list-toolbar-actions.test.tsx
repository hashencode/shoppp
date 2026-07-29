import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import type { ColumnsType } from 'antd/es/table'
import {
  buildListToolbarColumnSettingOptions,
  type ListToolbarColumnSettingOption,
  ListToolbarActions,
} from './list-toolbar-actions'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

describe('list-toolbar-actions', () => {
  it('builds column setting options from keyed columns', () => {
    const columns: ColumnsType<{ id: number }> = [
      { key: 'id', title: 'ID', dataIndex: 'id' },
      { title: '无 key 列', dataIndex: 'id' },
      { key: 'action', title: () => '操作', render: () => null },
    ]

    expect(buildListToolbarColumnSettingOptions(columns)).toEqual<ListToolbarColumnSettingOption[]>(
      [
        { key: 'id', label: 'ID' },
        { key: 'action', label: 'action' },
      ]
    )
  })

  it('renders refresh text and only shows the leading divider when requested', () => {
    const props = {
      tableSize: 'small' as const,
      onTableSizeChange: () => undefined,
      onReload: () => undefined,
      columnSettingOptions: [{ key: 'id', label: 'ID' }],
      selectedColumnKeys: ['id'],
      onSelectedColumnKeysChange: () => undefined,
    }

    const { container, rerender } = render(<ListToolbarActions {...props} />)

    const refreshButton = screen.getByRole('button', { name: '刷新' })

    expect(refreshButton.textContent).toContain('刷新')
    expect(container.querySelector('.ant-divider-vertical')).toBeNull()

    rerender(<ListToolbarActions {...props} showLeadingDivider />)

    const divider = container.querySelector('.ant-divider-vertical')
    const nextRefreshButton = screen.getByRole('button', { name: '刷新' })
    const dividerBeforeRefresh = Boolean(
      divider &&
        (divider.compareDocumentPosition(nextRefreshButton) & Node.DOCUMENT_POSITION_FOLLOWING)
    )

    expect(divider).toBeTruthy()
    expect(dividerBeforeRefresh).toBe(true)
  })

  it('renders built-in column setting panel and reports selection changes', async () => {
    const recordedKeys: string[][] = []

    render(
      <ListToolbarActions
        tableSize="small"
        onTableSizeChange={() => undefined}
        onReload={() => undefined}
        columnSettingOptions={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: '名称' },
        ]}
        selectedColumnKeys={['id']}
        onSelectedColumnKeysChange={(keys) => {
          recordedKeys.push(keys)
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '列设置' }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'ID' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('checkbox', { name: '名称' }))

    await waitFor(() => {
      expect(recordedKeys.length).toBeGreaterThan(0)
    })
  })

  it('renders reset order action when custom order can be cleared', async () => {
    let clearCallCount = 0

    render(
      <ListToolbarActions
        tableSize="small"
        onTableSizeChange={() => undefined}
        onReload={() => undefined}
        onClearColumnSort={() => {
          clearCallCount += 1
        }}
        clearColumnSortDisabled={false}
        columnSettingOptions={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: '名称' },
        ]}
        selectedColumnKeys={['id', 'name']}
        onSelectedColumnKeysChange={() => undefined}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '列设置' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '重置列排序' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '重置列排序' }))

    expect(clearCallCount).toBe(1)
  })
})
