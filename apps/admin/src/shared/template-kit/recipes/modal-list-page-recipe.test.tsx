import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import type { ColumnsType } from 'antd/es/table'
import { ThemeProvider } from '../../contexts/theme-context'
import { ModalListPageRecipe } from './modal-list-page-recipe'
import type { StandardListPageSpec } from '../specs/standard-list-page-spec'

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

type FilterValues = {
  keyword?: string
}

type RequestFilters = {
  keyword?: string
  current?: number
  size?: number
}

type Response = {
  data: Array<{ id: number; name: string }>
  current: number
  size: number
  total: number
}

const renderWithTheme = (node: React.ReactNode) => render(<ThemeProvider>{node}</ThemeProvider>)

describe('ModalListPageRecipe', () => {
  it('passes reload helper to custom table nodes', async () => {
    const requestCalls: RequestFilters[] = []
    let tableContract:
      | {
          tableSize: 'large' | 'middle' | 'small'
          tableClassName: string
          totalText?: React.ReactNode
        }
      | undefined
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '弹窗列表',
      cardTitle: '弹窗列表',
      tableId: 'modal-list-recipe-table-node-reload',
      formRoute: '',
      initialFilters: {},
      toFilters: () => ({}),
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: requestCalls.length, name: `modal-${requestCalls.length}` }],
          current: 1,
          size: 10,
          total: 1,
        }
      },
      selectItems: (response) => response?.data ?? [],
      filterFields: [],
      buildColumns: () =>
        [
          {
            key: 'name',
            title: '名称',
            dataIndex: 'name',
          },
        ] satisfies ColumnsType<{ id: number; name: string }>,
      buildTableNode: ({ dataSource, reload, tableSize, tableClassName, pagination }) => {
        tableContract = {
          tableSize,
          tableClassName,
          totalText: pagination.showTotal?.(pagination.total ?? 0, [1, dataSource.length]),
        }
        return (
          <div>
            <div data-testid="modal-table-node-reload">{dataSource[0]?.name ?? 'empty'}</div>
            <button type="button" onClick={() => void reload()}>
              reload-modal-table
            </button>
          </div>
        )
      },
    }

    renderWithTheme(<ModalListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
      expect(screen.getByTestId('modal-table-node-reload').textContent).toBe('modal-1')
    })
    expect(tableContract).toEqual({
      tableSize: 'middle',
      tableClassName: 'rule-list-table',
      totalText: '共 1 条数据',
    })

    fireEvent.click(screen.getByRole('button', { name: 'reload-modal-table' }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
      expect(screen.getByTestId('modal-table-node-reload').textContent).toBe('modal-2')
    })
  })

  it('re-requests local pagination data when submitting unchanged filters', async () => {
    const requestCalls: RequestFilters[] = []
    const stableFilters: RequestFilters = {}
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      paginationMode: 'local',
      pageTitle: '弹窗列表',
      cardTitle: '弹窗列表',
      tableId: 'modal-list-recipe-local-repeat-submit',
      formRoute: '',
      initialFilters: stableFilters,
      toFilters: () => stableFilters,
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: requestCalls.length, name: `modal-${requestCalls.length}` }],
          current: 1,
          size: 10,
          total: 1,
        }
      },
      selectItems: (response) => response?.data ?? [],
      filterFields: [
        {
          type: 'input',
          name: 'keyword',
          label: '关键字',
          inputProps: {
            placeholder: '请输入关键字',
          },
        },
      ],
      buildColumns: () =>
        [
          {
            key: 'name',
            title: '名称',
            dataIndex: 'name',
          },
        ] satisfies ColumnsType<{ id: number; name: string }>,
      buildTableNode: ({ dataSource }) => (
        <div data-testid="modal-local-repeat-submit-table">{dataSource[0]?.name ?? 'empty'}</div>
      ),
    }

    renderWithTheme(<ModalListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
      expect(screen.getByTestId('modal-local-repeat-submit-table').textContent).toBe('modal-1')
    })

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
      expect(screen.getByTestId('modal-local-repeat-submit-table').textContent).toBe('modal-2')
    })
    expect(requestCalls).toEqual([stableFilters, stableFilters])
  })
})
