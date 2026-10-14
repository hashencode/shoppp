import { auditQuerySchema, type AuditEvent, type AuditQuery } from '@shoppp/contracts'
import { Button, Card, Form, Space, Table, Tag, theme } from 'antd'
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
  useTemplateListFilters,
} from '../../shared/template-kit/list'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

type AuditFilterValues = Pick<AuditQuery, 'action' | 'result' | 'targetType'>
type AuditResponse = Awaited<ReturnType<typeof fetchAuditEvents>>

const PAGE_SIZE = 25
const TABLE_ID = 'audit-events-list'

const normalizeFilters = (values: AuditFilterValues): AuditFilterValues => ({
  action: values.action?.trim() || undefined,
  result: values.result,
  targetType: values.targetType?.trim() || undefined,
})

export const AuditPage = () => {
  const { token } = theme.useToken()
  const { t } = useI18n()
  const { searchCompactLayout } = useTheme()
  const localizeError = useLocalizedApiError()
  const [filterForm] = Form.useForm<AuditFilterValues>()
  const [cursorTrail, setCursorTrail] = useState<Array<string | undefined>>([undefined])
  const cursorIndex = cursorTrail.length - 1
  const resetCursor = useCallback(() => setCursorTrail([undefined]), [])
  const {
    filters: committedFilters,
    requestVersion,
    onSubmit: commitFilters,
    onReset: resetFilters,
  } = useTemplateListFilters<AuditFilterValues, AuditFilterValues>({
    form: filterForm,
    initialFilters: {},
    toFilters: normalizeFilters,
    onResetPage: resetCursor,
    autoApplyOnValuesChange: false,
  })

  const requestFilters = useMemo<AuditQuery>(
    () => ({
      ...committedFilters,
      pageSize: PAGE_SIZE,
      ...(cursorTrail.at(-1) ? { cursor: cursorTrail.at(-1) } : {}),
    }),
    [committedFilters, cursorTrail]
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
  }, [load, requestVersion])

  const goToFirstPage = resetCursor
  const goToPreviousPage = useCallback(() => {
    setCursorTrail((current) => (current.length > 1 ? current.slice(0, -1) : current))
  }, [])
  const goToNextPage = useCallback(() => {
    const nextCursor = controller.response?.nextCursor
    if (!nextCursor) return
    setCursorTrail((current) => [...current, nextCursor])
  }, [controller.response?.nextCursor])

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
        options: auditQuerySchema.shape.result.unwrap().options.map((value) => ({
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
  const searchGridProps = useMemo(() => buildSearchGridProps(filterFields), [filterFields])
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
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <div className="p-4" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
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
        </div>

        <div className="p-4">
          <div className="mb-4 flex flex-wrap justify-end gap-2">
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
          </div>
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
        </div>
      </Card>
    </CustomPageRecipe>
  )
}
