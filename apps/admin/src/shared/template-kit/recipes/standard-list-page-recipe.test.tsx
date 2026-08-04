import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import type { TablePaginationConfig } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuthTestProvider } from '../../../test/auth-context-fixture'
import { ThemeProvider } from '../../contexts/theme-context'
import type { Role } from '../../types/roles'
import { StandardListPageRecipe } from './standard-list-page-recipe'
import type { StandardListPageSpec } from '../specs/standard-list-page-spec'
import {
  ALL_DATA_PAGE_SIZE,
  VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD,
} from '../../hooks/use-standard-pagination'

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
  name?: string
}

type RequestFilters = {
  name?: string
  current?: number
  size?: number
}

type Response = {
  data: Array<{ id: number; name: string }>
  current: number
  size: number
  total: number
}

type VirtualScrollSnapshot = {
  enabled: boolean
  scroll: {
    x: number
    y: number
  }
}

const renderWithTheme = (node: React.ReactNode, role: Role = 'admin') => {
  return render(
    <AuthTestProvider role={role}>
      <ThemeProvider>{node}</ThemeProvider>
    </AuthTestProvider>
  )
}

describe('StandardListPageRecipe', () => {
  it('does not auto request on filter value change and only queries on submit', async () => {
    const requestCalls: RequestFilters[] = []
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: (values) => ({
        name: values.name?.trim() || undefined,
      }),
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        current,
        size: pageSize,
      }),
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: 1, name: filters.name ?? 'default' }],
          current: filters.current ?? 1,
          size: filters.size ?? 10,
          total: 1,
        }
      },
      selectItems: (response) => response?.data ?? [],
      filterFields: [
        {
          type: 'input',
          name: 'name',
          label: '名称',
          inputProps: {
            placeholder: '请输入名称',
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
        <div data-testid="table-node">{dataSource[0]?.name ?? 'empty'}</div>
      ),
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
    })

    fireEvent.change(screen.getByPlaceholderText('请输入名称'), {
      target: { value: '  alpha  ' },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    expect(requestCalls).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
    })

    expect(requestCalls[1]).toEqual({
      name: 'alpha',
      current: 1,
      size: 10,
    })
    await waitFor(
      () => {
        expect(screen.getByTestId('table-node').textContent).toBe('alpha')
      },
      { timeout: 3_000 }
    )
  }, 10_000)

  it('resets to first page when page size changes', async () => {
    const requestCalls: RequestFilters[] = []
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-page-size',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: (values) => ({
        name: values.name?.trim() || undefined,
      }),
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        current,
        size: pageSize,
      }),
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: 1, name: 'demo' }],
          current: filters.current ?? 1,
          size: filters.size ?? 10,
          total: 200,
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
      buildTableNode: ({ onPageChange }) => (
        <div>
          <button type="button" onClick={() => onPageChange(3, 10)}>
            goto-page-3
          </button>
          <button type="button" onClick={() => onPageChange(3, 20)}>
            change-size
          </button>
        </div>
      ),
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'goto-page-3' }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
    })
    expect(requestCalls[1]).toEqual({
      current: 3,
      size: 10,
    })

    fireEvent.click(screen.getByRole('button', { name: 'change-size' }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(3)
    })
    expect(requestCalls[2]).toEqual({
      current: 1,
      size: 20,
    })
  })

  it('keeps standard page-size options and disables page-size search after pagination is normalized', async () => {
    const latestPaginationRef: { current: TablePaginationConfig | null } = { current: null }

    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-page-size-options',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async () => ({
        data: [{ id: 1, name: 'demo' }],
        current: 1,
        size: 10,
        total: 200,
      }),
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
      buildTableNode: ({ pagination }) => {
        latestPaginationRef.current = pagination
        return <div>table</div>
      },
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(latestPaginationRef.current).not.toBeNull()
    })

    const latestPagination = latestPaginationRef.current
    expect(latestPagination?.pageSizeOptions).toEqual([10, 20, 50, 100, ALL_DATA_PAGE_SIZE])
    expect(latestPagination?.showSizeChanger).toMatchObject({
      showSearch: false,
      optionLabelProp: 'label',
    })
  })

  it('should enable virtual scroll with fixed height when page size reaches threshold', async () => {
    let latestVirtualScroll: VirtualScrollSnapshot | null = null
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-virtual-scroll',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: (values) => ({
        name: values.name?.trim() || undefined,
      }),
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        current,
        size: pageSize,
      }),
      request: async (filters) => ({
        data: [{ id: 1, name: 'demo' }],
        current: filters.current ?? 1,
        size: filters.size ?? 10,
        total: 200,
      }),
      selectItems: (response) => response?.data ?? [],
      filterFields: [],
      buildColumns: () =>
        [
          {
            key: 'name',
            title: '名称',
            dataIndex: 'name',
            width: 180,
          },
        ] satisfies ColumnsType<{ id: number; name: string }>,
      buildTableNode: ({ onPageChange, virtualScroll }) => {
        latestVirtualScroll = virtualScroll
        return (
          <div>
            <button
              type="button"
              onClick={() => onPageChange(2, VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD)}
            >
              enable-virtual-scroll
            </button>
          </div>
        )
      },
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(latestVirtualScroll).not.toBeNull()
    })

    expect(latestVirtualScroll).toEqual({
      enabled: false,
      scroll: {
        x: 1200,
        y: 700,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'enable-virtual-scroll' }))

    await waitFor(() => {
      expect(latestVirtualScroll).toEqual({
        enabled: true,
        scroll: {
          x: 1200,
          y: 700,
        },
      })
    })
  })

  it('does not render the filter card when there are no filter fields', async () => {
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试列表',
      tableId: 'recipe-test-list-without-filters',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async () => ({
        data: [{ id: 1, name: 'demo' }],
        current: 1,
        size: 10,
        total: 1,
      }),
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
      buildTableNode: ({ dataSource }) => <div>{dataSource[0]?.name ?? 'empty'}</div>,
    }

    const { container } = renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(screen.getByText('demo')).toBeTruthy()
    })

    expect(screen.queryByRole('button', { name: /查\s*询/ })).toBeNull()
    expect(container.querySelector('.ant-card')).toBeTruthy()
    expect(container.querySelectorAll('.ant-card').length).toBe(1)
    expect(screen.getAllByText('测试列表')).toHaveLength(1)
  })

  it('renders create action as solid primary button when configured', async () => {
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-create-action',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async () => ({
        data: [{ id: 1, name: 'demo' }],
        current: 1,
        size: 10,
        total: 1,
      }),
      selectItems: (response) => response?.data ?? [],
      filterFields: [],
      createAction: {
        label: '新增数据',
      },
      buildColumns: () =>
        [
          {
            key: 'name',
            title: '名称',
            dataIndex: 'name',
          },
        ] satisfies ColumnsType<{ id: number; name: string }>,
      buildTableNode: ({ dataSource }) => <div>{dataSource[0]?.name ?? 'empty'}</div>,
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(screen.getByText('demo')).toBeTruthy()
    })

    const createButton = screen.getByRole('button', { name: '新增数据' })
    expect(createButton.className).toContain('ant-btn-primary')
    expect(createButton.className).not.toContain('ant-btn-variant-filled')

    const refreshButton = screen.getByRole('button', { name: '刷新' })
    const divider = document.querySelector('.ant-card-extra .ant-divider-vertical')
    const createBeforeDivider = Boolean(
      divider &&
        (createButton.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING)
    )
    const dividerBeforeRefresh = Boolean(
      divider && (divider.compareDocumentPosition(refreshButton) & Node.DOCUMENT_POSITION_FOLLOWING)
    )

    expect(divider).toBeTruthy()
    expect(createBeforeDivider).toBe(true)
    expect(dividerBeforeRefresh).toBe(true)
  })

  it('places search settings before reset and query actions', async () => {
    const requestCalls: RequestFilters[] = []
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-search-settings-order',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: (values) => ({ name: values.name?.trim() || undefined }),
      request: async (filters) => {
        requestCalls.push(filters)
        return { data: [{ id: 1, name: 'demo' }], current: 1, size: 10, total: 1 }
      },
      selectItems: (response) => response?.data ?? [],
      filterFields: [
        {
          type: 'input',
          name: 'name',
          label: '名称',
        },
      ],
      buildColumns: () => [],
      buildTableNode: ({ dataSource }) => <div>{dataSource[0]?.name}</div>,
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    const searchSettingsButton = await screen.findByRole('button', { name: '搜索设置' })
    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
    })
    const resetButton = screen.getByRole('button', { name: /重\s*置/ })
    const queryButton = screen.getByRole('button', { name: /查\s*询/ })

    expect(
      searchSettingsButton.compareDocumentPosition(resetButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(resetButton.compareDocumentPosition(queryButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await act(async () => {
      fireEvent.click(searchSettingsButton)
    })
    expect(requestCalls).toHaveLength(1)
  })

  it('shows the divider for a visible toolbar extra and omits it for empty extras', async () => {
    const buildSpec = (
      toolbarExtra: React.ReactNode,
      toolbarExtraVisible: boolean
    ): StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > => ({
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-toolbar-extra',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async () => ({ data: [{ id: 1, name: 'demo' }], current: 1, size: 10, total: 1 }),
      selectItems: (response) => response?.data ?? [],
      filterFields: [],
      toolbarExtra,
      toolbarExtraVisible,
      buildColumns: () => [],
      buildTableNode: ({ dataSource }) => <div>{dataSource[0]?.name}</div>,
    })

    const { unmount } = renderWithTheme(
      <StandardListPageRecipe spec={buildSpec(<button type="button">导出</button>, true)} />
    )

    await screen.findByText('demo')

    const exportButton = screen.getByRole('button', { name: '导出' })
    const refreshButton = screen.getByRole('button', { name: '刷新' })
    const divider = document.querySelector('.ant-card-extra .ant-divider-vertical')

    expect(divider).toBeTruthy()
    expect(exportButton.compareDocumentPosition(divider!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(divider!.compareDocumentPosition(refreshButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    unmount()

    const { container: emptyContainer, unmount: unmountEmpty } = renderWithTheme(
      <StandardListPageRecipe spec={buildSpec(false, false)} />
    )

    await screen.findByText('demo')
    expect(emptyContainer.querySelector('.ant-card-extra .ant-divider-vertical')).toBeNull()

    unmountEmpty()

    const { container: emptyArrayContainer } = renderWithTheme(
      <StandardListPageRecipe spec={buildSpec([false, null], false)} />
    )

    await screen.findByText('demo')
    expect(emptyArrayContainer.querySelector('.ant-card-extra .ant-divider-vertical')).toBeNull()

    unmountEmpty()

    const { container: emptyFragmentContainer } = renderWithTheme(
      <StandardListPageRecipe spec={buildSpec(<></>, false)} />
    )

    await screen.findByText('demo')
    expect(emptyFragmentContainer.querySelector('.ant-card-extra .ant-divider-vertical')).toBeNull()
  })

  it('omits the divider when the configured create action is not permitted', async () => {
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-create-action-permission',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async () => ({ data: [{ id: 1, name: 'demo' }], current: 1, size: 10, total: 1 }),
      selectItems: (response) => response?.data ?? [],
      filterFields: [],
      createAction: {
        label: '新增数据',
        permission: 'catalog.write',
      },
      buildColumns: () => [],
      buildTableNode: ({ dataSource }) => <div>{dataSource[0]?.name}</div>,
    }

    const { container } = renderWithTheme(<StandardListPageRecipe spec={spec} />, 'viewer')

    await screen.findByText('demo')

    expect(screen.queryByRole('button', { name: '新增数据' })).toBeNull()
    expect(container.querySelector('.ant-card-extra .ant-divider-vertical')).toBeNull()
  })

  it('passes reload helper to custom table nodes', async () => {
    const requestCalls: RequestFilters[] = []
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-table-node-reload',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: () => ({}),
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: requestCalls.length, name: `demo-${requestCalls.length}` }],
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
      buildTableNode: ({ dataSource, reload }) => (
        <div>
          <div data-testid="table-node-reload">{dataSource[0]?.name ?? 'empty'}</div>
          <button type="button" onClick={() => void reload()}>
            reload-from-table
          </button>
        </div>
      ),
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
      expect(screen.getByTestId('table-node-reload').textContent).toBe('demo-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'reload-from-table' }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
      expect(screen.getByTestId('table-node-reload').textContent).toBe('demo-2')
    })
  })

  it('supports local pagination mode without sending page parameters to request', async () => {
    const requestCalls: RequestFilters[] = []
    const spec: StandardListPageSpec<
      FilterValues,
      RequestFilters,
      Response,
      { id: number; name: string },
      Error
    > = {
      paginationMode: 'local',
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-local-pagination',
      formRoute: '/test/form',
      initialFilters: {},
      toFilters: (values) => ({
        name: values.name?.trim() || undefined,
      }),
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        current,
        size: pageSize,
      }),
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            name: `item-${index + 1}`,
          })),
          current: 1,
          size: 12,
          total: 12,
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
      buildTableNode: ({ dataSource, onPageChange }) => (
        <div>
          <div data-testid="local-page-items">{dataSource.map((item) => item.name).join(',')}</div>
          <button type="button" onClick={() => onPageChange(2, 10)}>
            goto-local-page-2
          </button>
        </div>
      ),
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
    })

    expect(requestCalls[0]).toEqual({})
    expect(screen.getByTestId('local-page-items').textContent).toContain('item-1')
    expect(screen.getByTestId('local-page-items').textContent).not.toContain('item-11')

    fireEvent.click(screen.getByRole('button', { name: 'goto-local-page-2' }))

    await waitFor(() => {
      expect(screen.getByTestId('local-page-items').textContent).toContain('item-11')
    })
    expect(screen.getByTestId('local-page-items').textContent?.split(',')).toEqual([
      'item-11',
      'item-12',
    ])
    expect(requestCalls).toHaveLength(1)
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
      pageTitle: '测试列表',
      cardTitle: '测试数据',
      tableId: 'recipe-test-list-local-repeat-submit',
      formRoute: '/test/form',
      initialFilters: stableFilters,
      toFilters: () => stableFilters,
      request: async (filters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: requestCalls.length, name: `demo-${requestCalls.length}` }],
          current: 1,
          size: 10,
          total: 1,
        }
      },
      selectItems: (response) => response?.data ?? [],
      filterFields: [
        {
          type: 'input',
          name: 'name',
          label: '名称',
          inputProps: {
            placeholder: '请输入名称',
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
        <div data-testid="local-repeat-submit-table">{dataSource[0]?.name ?? 'empty'}</div>
      ),
    }

    renderWithTheme(<StandardListPageRecipe spec={spec} />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
      expect(screen.getByTestId('local-repeat-submit-table').textContent).toBe('demo-1')
    })

    fireEvent.change(screen.getByPlaceholderText('请输入名称'), {
      target: { value: 'ignored' },
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(requestCalls).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() => {
      expect(requestCalls).toHaveLength(2)
      expect(screen.getByTestId('local-repeat-submit-table').textContent).toBe('demo-2')
    })
    expect(requestCalls).toEqual([stableFilters, stableFilters])
  })

  it('does not re-request when only selection-related spec state changes', async () => {
    const requestCalls: RequestFilters[] = []

    const SelectionProbe = () => {
      const [selectedCount, setSelectedCount] = React.useState(0)
      const buildRequestFilters = React.useCallback(
        ({
          filters,
          current,
          pageSize,
        }: {
          filters: RequestFilters
          current: number
          pageSize: number
        }) => ({
          ...filters,
          current,
          size: pageSize,
        }),
        []
      )
      const request = React.useCallback(async (filters: RequestFilters) => {
        requestCalls.push(filters)
        return {
          data: [{ id: 1, name: 'demo' }],
          current: filters.current ?? 1,
          size: filters.size ?? 10,
          total: 1,
        }
      }, [])

      const spec: StandardListPageSpec<
        FilterValues,
        RequestFilters,
        Response,
        { id: number; name: string },
        Error
      > = {
        pageTitle: '测试列表',
        cardTitle: '测试数据',
        tableId: 'recipe-test-list-selection',
        formRoute: '/test/form',
        initialFilters: {},
        toFilters: (values) => ({
          name: values.name?.trim() || undefined,
        }),
        buildRequestFilters,
        request,
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
        buildTableNode: ({ dataSource }) => (
          <div>
            <div>{dataSource[0]?.name ?? 'empty'}</div>
            <button type="button" onClick={() => setSelectedCount(1)}>
              select-row
            </button>
          </div>
        ),
      }

      return (
        <StandardListPageRecipe
          spec={spec}
          cardTitleOverride={selectedCount > 0 ? <span>已选 {selectedCount} 项</span> : undefined}
        />
      )
    }

    renderWithTheme(<SelectionProbe />)

    await waitFor(() => {
      expect(requestCalls).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'select-row' }))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    expect(requestCalls).toHaveLength(1)
    expect(screen.getAllByText('已选 1 项')).toHaveLength(1)
  })
})
