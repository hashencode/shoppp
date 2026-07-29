import { Form } from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { buildSearchGridProps } from '../list/build-search-grid-props'
import { buildModalListTableProps, MODAL_LIST_TABLE_SIZE } from '../list/modal-list-rules'
import { resolveActionColumnWidth } from '../list/resolve-action-column-width'
import { TemplateListContent } from '../list/template-list-content'
import { TemplateListFilterForm } from '../list/template-list-filter-form'
import { useTemplateListController } from '../list/use-template-list-controller'
import { useTemplateListFilters } from '../list/use-template-list-filters'
import type { StandardListPageSpec } from '../specs/standard-list-page-spec'
import { useStandardPagination } from '../../hooks/use-standard-pagination'

void React

export const ModalListPageRecipe = <
  TFilterValues extends Record<string, unknown>,
  TRequestFilters extends object,
  TResponse,
  TItem,
  TError = unknown,
>({
  spec,
}: {
  spec: StandardListPageSpec<TFilterValues, TRequestFilters, TResponse, TItem, TError>
}) => {
  const [filterForm] = Form.useForm<TFilterValues>()
  const [total, setTotal] = useState(0)
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
      enableAutoRefresh: false,
    })

  useEffect(() => {
    void load()
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

  const columns = useMemo(
    () =>
      spec.buildColumns({
        openFormPage: () => undefined,
        reload,
        resolveActionColumnWidth: (baseWidth, maxWidth) =>
          resolveActionColumnWidth(baseWidth, MODAL_LIST_TABLE_SIZE, maxWidth),
      }),
    [reload, spec]
  )

  const toolbarExtra = useMemo(() => {
    if (typeof spec.toolbarExtra !== 'function') {
      return spec.toolbarExtra
    }

    return spec.toolbarExtra({
      reload,
    })
  }, [reload, spec])

  const searchColProps = useMemo(() => buildSearchGridProps(visibleFieldCount), [visibleFieldCount])
  const modalListTableProps = useMemo(() => buildModalListTableProps(pagination), [pagination])

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
  const selectedColumnKeys = columns
    .filter((column) => typeof column.key === 'string')
    .map((column) => String(column.key))

  const tableNode = spec.buildTableNode({
    columns,
    dataSource,
    loading,
    reload,
    tableSize: modalListTableProps.size,
    current,
    pageSize,
    total: responseTotal,
    tableClassName: modalListTableProps.className,
    pagination: modalListTableProps.pagination,
    onPageChange: (nextCurrent, nextSize) => {
      modalListTableProps.pagination.onChange?.(nextCurrent, nextSize)
    },
    selectedColumnKeys,
    setTableSize: () => undefined,
    setSelectedColumnKeys: () => undefined,
    onColumnSettingOrderChange: () => undefined,
    virtualScroll: {
      enabled: false,
      scroll: {
        x: 0,
        y: 0,
      },
    },
  })

  return (
    <div className="space-y-4">
      {spec.renderBeforeFilter ?? null}

      {spec.filterFields.length > 0 ? (
        <TemplateListFilterForm<TFilterValues>
          form={filterForm}
          fields={spec.filterFields}
          fieldColProps={searchColProps.formItem}
          labelCol={searchColProps.labelItem}
          wrapperCol={searchColProps.inputItem}
          actionsColProps={searchColProps.actions}
          compactLayout
          extraActions={toolbarExtra}
          extraActionsPlacement="before-primary-actions"
          extraActionsDivider={Boolean(toolbarExtra)}
          onSubmit={(values) => {
            onSubmitFilters(values)
            resetPage()
          }}
          onValuesChange={onValuesChangeFilters}
          onReset={handleResetAll}
        />
      ) : toolbarExtra ? (
        <div className="flex justify-end">{toolbarExtra}</div>
      ) : null}

      {spec.renderBetweenFilterAndContent ?? null}

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

      {spec.renderAfterContent ?? null}
    </div>
  )
}
