import type { AuditEvent, AuditQuery } from '@shoppp/contracts'
import { Button, Card, Form, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { fetchAuditEvents } from '../../services/platform/api'
import {
  buildListToolbarColumnSettingOptions,
  ListToolbarActions,
} from '../../shared/components/list-toolbar-actions'
import { useI18n } from '../../shared/contexts/i18n-context'
import { useTheme } from '../../shared/contexts/theme-context'
import { useListViewPreferences } from '../../shared/hooks/use-list-view-preferences'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  buildSearchGridProps,
  STANDARD_LIST_TABLE_CLASS_NAME,
  TemplateListContent,
  TemplateListFilterForm,
  type TemplateListFilterField,
  useTemplateListController,
} from '../../shared/template-kit/list'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type AuditFilterValues = Pick<AuditQuery, 'action' | 'result' | 'targetType'>
type AuditResponse = { data: AuditEvent[]; nextCursor: string | null }

const PAGE_SIZE = 25
const TABLE_ID = 'audit-events-list'

const normalizeFilters = (values: AuditFilterValues): AuditFilterValues => ({
  action: values.action?.trim() || undefined,
  result: values.result,
  targetType: values.targetType?.trim() || undefined,
})

export const AuditPage = () => {
  const { t } = useI18n()
  const { searchCompactLayout } = useTheme()
  const localizeError = useLocalizedApiError()
  const [filterForm] = Form.useForm<AuditFilterValues>()
  const [committedFilters, setCommittedFilters] = useState<AuditFilterValues>({})
  const [cursorIndex, setCursorIndex] = useState(0)
  const [cursorTrail, setCursorTrail] = useState<Array<string | undefined>>([undefined])

  const requestFilters = useMemo<AuditQuery>(
    () => ({
      ...committedFilters,
      pageSize: PAGE_SIZE,
      ...(cursorTrail[cursorIndex] ? { cursor: cursorTrail[cursorIndex] } : {}),
    }),
    [committedFilters, cursorIndex, cursorTrail]
  )
  const controller = useTemplateListController<AuditQuery, AuditResponse, AuditEvent, ApiError>({
    filters: requestFilters,
    request: fetchAuditEvents,
    selectItems: (response) => response?.data ?? [],
    mapError: normalizeApiError,
  })
  const load = controller.load

  useEffect(() => {
    void load()
  }, [load])

  const commitFilters = useCallback((values: AuditFilterValues) => {
    setCursorIndex(0)
    setCursorTrail([undefined])
    setCommittedFilters(normalizeFilters(values))
  }, [])
  const resetFilters = useCallback(() => {
    filterForm.resetFields()
    commitFilters({})
  }, [commitFilters, filterForm])
  const goToFirstPage = useCallback(() => {
    setCursorIndex(0)
    setCursorTrail((current) => current.slice(0, 1))
  }, [])
  const goToPreviousPage = useCallback(() => {
    setCursorIndex((current) => Math.max(0, current - 1))
  }, [])
  const goToNextPage = useCallback(() => {
    const nextCursor = controller.response?.nextCursor
    if (!nextCursor) return
    setCursorTrail((current) => [...current.slice(0, cursorIndex + 1), nextCursor])
    setCursorIndex((current) => current + 1)
  }, [controller.response?.nextCursor, cursorIndex])

  const columns = useMemo<ColumnsType<AuditEvent>>(
    () => [
      {
        key: 'created',
        title: t('Time'),
        dataIndex: 'createdAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      { key: 'action', title: t('Action'), dataIndex: 'action', width: 220 },
      {
        key: 'result',
        title: t('Result'),
        dataIndex: 'result',
        width: 110,
        render: (value: string) => (
          <Tag color={value === 'failed' || value === 'denied' ? 'error' : 'success'}>
            {t(value)}
          </Tag>
        ),
      },
      {
        key: 'actor',
        title: t('Actor'),
        dataIndex: 'actorId',
        width: 200,
        render: (value: string | null) => value ?? t('system'),
      },
      {
        key: 'target',
        title: t('Target'),
        width: 260,
        render: (_: unknown, item) =>
          `${item.targetType}${item.targetId ? ` · ${item.targetId}` : ''}`,
      },
      {
        key: 'reason',
        title: t('Reason'),
        dataIndex: 'reason',
        width: 300,
        render: (value: string | null) => value ?? '—',
      },
      {
        key: 'request',
        title: t('Request ID'),
        dataIndex: 'requestId',
        width: 280,
        render: (value: string | null) => value ?? '—',
      },
    ],
    [t]
  )
  const defaultColumnKeys = useMemo(
    () => columns.flatMap((column) => (typeof column.key === 'string' ? [column.key] : [])),
    [columns]
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
    tableId: TABLE_ID,
    defaultColumnKeys,
    defaultDensity: 'middle',
  })
  const orderedColumns = useMemo(() => {
    const byKey = new Map(
      columns.flatMap((column) =>
        typeof column.key === 'string' ? ([[column.key, column]] as const) : []
      )
    )
    const ordered = columnOrder
      .map((key) => byKey.get(key))
      .filter((column): column is ColumnsType<AuditEvent>[number] => Boolean(column))
    const orderedKeys = new Set(ordered.map((column) => String(column.key)))
    return [
      ...ordered,
      ...columns.filter((column) => typeof column.key !== 'string' || !orderedKeys.has(column.key)),
    ]
  }, [columnOrder, columns])
  const visibleColumns = useMemo(
    () =>
      orderedColumns.filter(
        (column) => typeof column.key !== 'string' || selectedColumnKeys.includes(column.key)
      ),
    [orderedColumns, selectedColumnKeys]
  )
  const filterFields = useMemo<TemplateListFilterField<AuditFilterValues>[]>(
    () => [
      {
        type: 'input',
        name: 'action',
        label: t('Action'),
        inputProps: {
          'aria-label': t('Filter audit action'),
          placeholder: t('Exact action'),
        },
      },
      {
        type: 'input',
        name: 'targetType',
        label: t('Target'),
        inputProps: {
          'aria-label': t('Filter audit target'),
          placeholder: t('Target type'),
        },
      },
      {
        type: 'select',
        name: 'result',
        label: t('Result'),
        options: ['allowed', 'denied', 'succeeded', 'failed'].map((value) => ({
          label: t(value),
          value,
        })),
        selectProps: {
          'aria-label': t('Filter audit result'),
          placeholder: t('Result'),
        },
      },
    ],
    [t]
  )
  const searchGridProps = useMemo(
    () => buildSearchGridProps(filterFields.length),
    [filterFields.length]
  )
  const invalidCursor = controller.error?.code === 'invalid_audit_cursor'
  const retry = invalidCursor ? goToFirstPage : () => void load()
  const tableNode = (
    <Table<AuditEvent>
      className={STANDARD_LIST_TABLE_CLASS_NAME}
      rowKey="id"
      columns={visibleColumns}
      dataSource={controller.data}
      loading={controller.loading}
      size={tableSize}
      pagination={false}
      scroll={{ x: 1550 }}
    />
  )

  return (
    <CustomPageRecipe title={t('Audit trail')}>
      <p className="text-slate-500">
        {t('Redacted, permissioned records with stable cursor pagination.')}
      </p>

      <Card variant="borderless" styles={{ body: { paddingRight: 8 } }}>
        <TemplateListFilterForm<AuditFilterValues>
          form={filterForm}
          formProps={{ initialValues: {} }}
          fields={filterFields}
          fieldColProps={searchGridProps.formItem}
          labelCol={searchGridProps.labelItem}
          wrapperCol={searchGridProps.inputItem}
          actionsColProps={searchGridProps.actions}
          compactLayout={searchCompactLayout}
          submitLoading={controller.loading}
          onSubmit={commitFilters}
          onReset={resetFilters}
        />
      </Card>

      <Card
        variant="borderless"
        extra={
          <ListToolbarActions
            tableSize={tableSize}
            onTableSizeChange={setTableSize}
            onClearColumnSort={clearColumnOrder}
            clearColumnSortDisabled={!hasCustomColumnOrder}
            reloadLoading={controller.loading}
            onReload={() => void load()}
            columnSettingOptions={buildListToolbarColumnSettingOptions(orderedColumns)}
            selectedColumnKeys={selectedColumnKeys}
            onSelectedColumnKeysChange={setSelectedColumnKeys}
            onColumnSettingOrderChange={setColumnOrder}
          />
        }
      >
        <TemplateListContent
          showInitialLoading={controller.showInitialLoading}
          showError={controller.showError}
          showPartial={controller.showPartial}
          showEmpty={controller.showEmpty}
          errorMessage={controller.error ? localizeError(controller.error) : undefined}
          partialMessage={controller.error ? localizeError(controller.error) : undefined}
          onRetry={retry}
          onReloadPartial={() => void load()}
          onResetEmpty={resetFilters}
          copy={{
            loadingTitle: t('Loading audit events…'),
            errorTitle: t('Audit events could not be loaded'),
            errorActionLabel: invalidCursor ? t('Restart') : t('Retry'),
            partialTitle: t('Audit events could not be refreshed'),
            emptyTitle: t('No audit events match these filters'),
            emptyDescription: t('Reset the filters and search again.'),
          }}
          tableNode={tableNode}
        />
        {controller.response && (controller.data.length > 0 || cursorIndex > 0) ? (
          <Space wrap className="mt-4">
            <Button disabled={cursorIndex === 0 || controller.loading} onClick={goToFirstPage}>
              {t('First page')}
            </Button>
            <Button disabled={cursorIndex === 0 || controller.loading} onClick={goToPreviousPage}>
              {t('Previous page')}
            </Button>
            <Button
              disabled={!controller.response.nextCursor || controller.loading}
              onClick={goToNextPage}
            >
              {t('Next page')}
            </Button>
          </Space>
        ) : null}
      </Card>
    </CustomPageRecipe>
  )
}
