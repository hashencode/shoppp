import { Button, Card, Form, Typography } from 'antd'
import type { ColumnGroupType, ColumnType, ColumnsType } from 'antd/es/table'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import { ListSearchSettingsDropdown } from '../../components/list-search-settings-dropdown'
import {
  buildListToolbarColumnSettingOptions,
  ListToolbarActions,
} from '../../components/list-toolbar-actions'
import { useTheme } from '../../contexts/theme-context'
import { useListViewPreferences } from '../../hooks/use-list-view-preferences'
import {
  VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD,
  useStandardPagination,
} from '../../hooks/use-standard-pagination'
import { useCrudFormNavigation } from '../hooks'
import { buildSearchGridProps } from '../list/build-search-grid-props'
import {
  buildStandardListPagination,
  STANDARD_LIST_TABLE_CLASS_NAME,
} from '../list/standard-list-pagination'
import { resolveActionColumnWidth } from '../list/resolve-action-column-width'
import { TemplateListContent } from '../list/template-list-content'
import { TemplateListFilterForm } from '../list/template-list-filter-form'
import { useTemplateListController } from '../list/use-template-list-controller'
import { useTemplateListFilters } from '../list/use-template-list-filters'
import type { StandardListPageSpec } from '../specs/standard-list-page-spec'

void React

const VIRTUAL_TABLE_HEIGHT = 700
const DEFAULT_VIRTUAL_TABLE_WIDTH = 1200
const EXPLICIT_LIST_LOADING_MIN_DURATION_MS = 1000
type StandardTableColumn<TItem> = ColumnGroupType<TItem> | ColumnType<TItem>
const ACTION_COLUMN_KEYS = new Set(['action', 'actions'])

const resolveVirtualScrollX = (columns: Array<{ width?: string | number }>) => {
  const numericWidthSum = columns.reduce((sum, column) => {
    return typeof column.width === 'number' ? sum + column.width : sum
  }, 0)

  return Math.max(numericWidthSum, DEFAULT_VIRTUAL_TABLE_WIDTH)
}

const isDefinedColumn = <TItem,>(
  column: StandardTableColumn<TItem> | undefined
): column is StandardTableColumn<TItem> => Boolean(column)

const isActionColumn = <TItem,>(column: StandardTableColumn<TItem>) => {
  const columnKey =
    typeof column.key === 'string' || typeof column.key === 'number'
      ? String(column.key)
      : undefined
  const columnTitle = typeof column.title === 'string' ? column.title.trim() : undefined

  return (columnKey ? ACTION_COLUMN_KEYS.has(columnKey) : false) || columnTitle === '操作'
}

const normalizeActionColumnAlignment = <TItem,>(
  columns: ColumnsType<TItem>
): ColumnsType<TItem> => {
  return columns.map((column) => {
    if ('children' in column && Array.isArray(column.children)) {
      return {
        ...column,
        children: normalizeActionColumnAlignment(column.children),
      }
    }

    if (!isActionColumn(column) || column.align) {
      return column
    }

    return {
      ...column,
      align: 'left',
    }
  })
}

export const StandardListPageRecipe = <
  TFilterValues extends Record<string, unknown>,
  TRequestFilters extends object,
  TResponse,
  TItem,
  TError = unknown,
>({
  spec,
  cardTitleOverride,
}: {
  spec: StandardListPageSpec<TFilterValues, TRequestFilters, TResponse, TItem, TError>
  cardTitleOverride?: React.ReactNode
}) => {
  const [filterForm] = Form.useForm<TFilterValues>()
  const { role, permissions } = useAuth()
  const { searchCompactLayout, setSearchCompactLayout } = useTheme()
  const { openFormPage } = useCrudFormNavigation(spec.formRoute)
  const [total, setTotal] = useState(0)
  const pendingLoadMinimumMsRef = React.useRef(0)
  const paginationMode = spec.paginationMode ?? 'remote'
  const { current, pageSize, pagination, resetPage } = useStandardPagination({
    total,
    ...spec.pagination,
  })

  const {
    filters,
    requestVersion,
    onSubmit: onSubmitFilters,
    onValuesChange: onValuesChangeFilters,
    onReset: onResetFilters,
  } = useTemplateListFilters<TFilterValues, TRequestFilters>({
    form: filterForm,
    initialFilters: spec.initialFilters,
    toFilters: spec.toFilters,
    autoApplyOnValuesChange: false,
  })

  const buildRequestFilters = spec.buildRequestFilters
  const transformResponse = spec.transformResponse
  const selectItems = spec.selectItems

  const requestFilters = useMemo(() => {
    if (paginationMode === 'local') {
      return filters
    }

    return (
      buildRequestFilters?.({
        filters,
        current,
        pageSize,
      }) ??
      ({
        ...filters,
        current,
        size: pageSize,
      } as TRequestFilters)
    )
  }, [buildRequestFilters, current, filters, pageSize, paginationMode])

  const handleTransformResponse = useCallback(
    (nextResponse: TResponse) => {
      const applied = transformResponse?.(nextResponse) ?? nextResponse
      const responseTotal =
        paginationMode === 'local'
          ? selectItems(applied).length
          : (applied as { total?: number } | null)?.total
      setTotal(typeof responseTotal === 'number' ? responseTotal : 0)
      return applied
    },
    [paginationMode, selectItems, transformResponse]
  )

  const { response, loading, error, showInitialLoading, showError, showEmpty, showPartial, load } =
    useTemplateListController<TRequestFilters, TResponse, TItem, TError>({
      filters: requestFilters,
      request: spec.request,
      selectItems,
      isPartial: spec.isPartial,
      mapError: spec.mapError,
      onError: spec.onError,
      transformResponse: handleTransformResponse,
      refreshChannel: spec.refreshChannel,
    })

  useEffect(() => {
    const minimumLoadingMs = pendingLoadMinimumMsRef.current
    pendingLoadMinimumMsRef.current = 0
    void load({ minimumLoadingMs })
  }, [load, requestVersion])

  const watchedFilterValues = Form.useWatch(
    (values) => values as Partial<TFilterValues>,
    filterForm
  ) as Partial<TFilterValues> | undefined

  const visibleFieldCount = useMemo(() => {
    const currentFilterValues = watchedFilterValues ?? {}

    return spec.filterFields.filter((field) => {
      if (!field.visibleWhen) {
        return true
      }

      return field.visibleWhen(currentFilterValues)
    }).length
  }, [spec.filterFields, watchedFilterValues])

  const reload = useCallback(async () => {
    await load()
  }, [load])

  const defaultColumnKeys = useMemo(
    () =>
      spec
        .buildColumns({
          openFormPage,
          reload,
          resolveActionColumnWidth: (baseWidth) => baseWidth,
        })
        .filter((column) => typeof column.key === 'string')
        .map((column) => String(column.key)),
    [openFormPage, reload, spec]
  )

  const {
    tableSize,
    selectedColumnKeys,
    columnOrder,
    hasCustomColumnOrder,
    setTableSize,
    setSelectedColumnKeys,
    setColumnOrder,
    clearColumnOrder,
  } = useListViewPreferences({
    tableId: spec.tableId,
    defaultColumnKeys,
    defaultDensity: 'middle',
  })

  const columns = useMemo(
    () =>
      normalizeActionColumnAlignment(
        spec.buildColumns({
          openFormPage,
          reload,
          resolveActionColumnWidth: (baseWidth, maxWidth) =>
            resolveActionColumnWidth(baseWidth, tableSize, maxWidth),
        })
      ),
    [openFormPage, reload, spec, tableSize]
  )

  const toolbarExtra = useMemo(() => {
    if (typeof spec.toolbarExtra !== 'function') {
      return spec.toolbarExtra
    }

    return spec.toolbarExtra({
      reload,
    })
  }, [reload, spec])

  const orderedColumns = useMemo<ColumnsType<TItem>>(() => {
    if (columnOrder.length === 0) {
      return columns
    }

    const columnMap = new Map<string, StandardTableColumn<TItem>>(
      columns
        .filter(
          (column): column is StandardTableColumn<TItem> & { key: string } =>
            typeof column.key === 'string'
        )
        .map((column) => [String(column.key), column])
    )
    const sortedColumns = columnOrder.map((key) => columnMap.get(key)).filter(isDefinedColumn)
    const orderedKeySet = new Set(sortedColumns.map((column) => String(column.key)))
    const remainingColumns = columns.filter(
      (column) => typeof column.key !== 'string' || !orderedKeySet.has(String(column.key))
    )

    return [...sortedColumns, ...remainingColumns]
  }, [columnOrder, columns])

  const visibleColumns = useMemo<ColumnsType<TItem>>(
    () =>
      orderedColumns.filter(
        (column) =>
          typeof column.key !== 'string' || selectedColumnKeys.includes(String(column.key))
      ),
    [orderedColumns, selectedColumnKeys]
  )

  const searchColProps = useMemo(() => buildSearchGridProps(visibleFieldCount), [visibleFieldCount])
  const tablePagination = useMemo(() => buildStandardListPagination(pagination), [pagination])

  const virtualScroll = useMemo(
    () => ({
      enabled: pageSize >= VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD,
      scroll: {
        x: resolveVirtualScrollX(visibleColumns),
        y: VIRTUAL_TABLE_HEIGHT,
      },
    }),
    [pageSize, visibleColumns]
  )

  const handleResetAll = () => {
    onResetFilters()
    resetPage()
  }

  const responseItems = selectItems(response)
  const dataSource =
    paginationMode === 'local'
      ? responseItems.slice((current - 1) * pageSize, current * pageSize)
      : responseItems
  const responseTotal =
    paginationMode === 'local'
      ? responseItems.length
      : ((response as { total?: number } | null)?.total ?? 0)
  const resolvedCardTitleSource = cardTitleOverride ?? spec.cardTitle
  const resolvedCardTitle =
    resolvedCardTitleSource && resolvedCardTitleSource !== spec.pageTitle
      ? resolvedCardTitleSource
      : undefined

  const tableNode = spec.buildTableNode({
    columns: visibleColumns,
    dataSource,
    loading,
    reload,
    tableSize,
    current,
    pageSize,
    total: responseTotal,
    tableClassName: STANDARD_LIST_TABLE_CLASS_NAME,
    pagination: tablePagination,
    onPageChange: (nextCurrent, nextSize) => {
      tablePagination.onChange?.(nextCurrent, nextSize)
    },
    selectedColumnKeys,
    setTableSize,
    setSelectedColumnKeys,
    onColumnSettingOrderChange: setColumnOrder,
    virtualScroll,
  })
  const visibleCreateAction =
    spec.createAction &&
    (!spec.createAction.permission ||
      hasPermission(role, spec.createAction.permission, permissions))
      ? spec.createAction
      : null
  const hasToolbarLeadingActions = Boolean(visibleCreateAction) || spec.toolbarExtraVisible === true

  return (
    <div className="space-y-4 pb-20">
      {spec.pageTitleHidden ? null : (
        <Typography.Title level={4} className="!mb-1">
          {spec.pageTitle}
        </Typography.Title>
      )}

      {spec.renderBeforeFilter ?? null}
      {spec.filterFields.length > 0 ? (
        <Card
          variant="borderless"
          styles={{
            body: {
              paddingRight: 8,
            },
          }}
        >
          <TemplateListFilterForm<TFilterValues>
            form={filterForm}
            fields={spec.filterFields}
            fieldColProps={searchColProps.formItem}
            labelCol={searchColProps.labelItem}
            wrapperCol={searchColProps.inputItem}
            actionsColProps={searchColProps.actions}
            compactLayout={searchCompactLayout}
            submitLoading={loading}
            extraActionsPlacement="before-primary-actions"
            extraActions={
              <ListSearchSettingsDropdown
                compactLayout={{
                  enabled: searchCompactLayout,
                  onChange: setSearchCompactLayout,
                }}
              />
            }
            onSubmit={(values) => {
              pendingLoadMinimumMsRef.current = EXPLICIT_LIST_LOADING_MIN_DURATION_MS
              onSubmitFilters(values)
              resetPage()
            }}
            onValuesChange={onValuesChangeFilters}
            onReset={handleResetAll}
          />
        </Card>
      ) : null}

      {spec.renderBetweenFilterAndContent ?? null}
      <Card
        variant="borderless"
        title={resolvedCardTitle}
        extra={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {visibleCreateAction ? (
              <Button
                type="primary"
                icon={visibleCreateAction.icon}
                onClick={() => openFormPage('add')}
              >
                {visibleCreateAction.label}
              </Button>
            ) : null}

            {toolbarExtra}

            <ListToolbarActions
              tableSize={tableSize}
              densityItems={spec.densityItems}
              onTableSizeChange={setTableSize}
              onClearColumnSort={clearColumnOrder}
              clearColumnSortDisabled={!hasCustomColumnOrder}
              reloadLoading={loading}
              showLeadingDivider={hasToolbarLeadingActions}
              onReload={() =>
                void load({
                  showSuccess: true,
                  minimumLoadingMs: EXPLICIT_LIST_LOADING_MIN_DURATION_MS,
                })
              }
              columnSettingOptions={buildListToolbarColumnSettingOptions(orderedColumns)}
              selectedColumnKeys={selectedColumnKeys}
              onSelectedColumnKeysChange={setSelectedColumnKeys}
              onColumnSettingOrderChange={setColumnOrder}
            />
          </div>
        }
      >
        <TemplateListContent
          showInitialLoading={showInitialLoading}
          showError={showError}
          showPartial={showPartial}
          showEmpty={showEmpty}
          errorMessage={(error as { message?: string } | null)?.message}
          partialMessage={(response as { partialMessage?: string } | null)?.partialMessage}
          onRetry={() => {
            void load()
          }}
          onReloadPartial={() => {
            void load()
          }}
          onResetEmpty={handleResetAll}
          copy={spec.stateCopy}
          tableNode={tableNode}
        />
      </Card>

      {spec.renderAfterContent ?? null}
    </div>
  )
}
