import type { ReportExport, ReportOrderRow, ReportingQuery } from '@shoppp/contracts'
import { Alert, App, Button, Form, Input, Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import React, { useMemo, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import {
  createReportExport,
  fetchReportOrders,
  reportExportDownloadUrl,
  type ReportOrderFilters,
} from '../../services/reporting/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'
import { getTimeZoneOptions, isValidTimeZone, resolveDefaultTimeZone } from '../../shared/utils/time-zones'

void React
dayjs.extend(utc)

const REPORT_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] as const

type ReportFilterValues = ReportingQuery & { query?: string }
type ReportListResponse = Awaited<ReturnType<typeof fetchReportOrders>>

const buildReportRequestFilters = ({
  filters,
  current,
  pageSize,
}: {
  filters: ReportOrderFilters
  current: number
  pageSize: number
}): ReportOrderFilters => ({ ...filters, page: current, pageSize })

const selectReportRows = (response: ReportListResponse | null) => response?.data ?? []

const isDateOnly = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

const parseEntryQuery = (): ReportFilterValues => {
  const params = new URLSearchParams(window.location.search)
  const currency = params.get('currency')?.toUpperCase()
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  const timeZone = params.get('timeZone')

  return {
    currency: REPORT_CURRENCIES.includes(currency as (typeof REPORT_CURRENCIES)[number])
      ? currency!
      : 'USD',
    startDate: isDateOnly(startDate) ? startDate : dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    endDate: isDateOnly(endDate) ? endDate : dayjs().format('YYYY-MM-DD'),
    timeZone: isValidTimeZone(timeZone) ? timeZone : resolveDefaultTimeZone(),
  }
}

const toFilters = (values: ReportFilterValues): ReportOrderFilters => ({
  currency: values.currency,
  startDate: values.startDate,
  endDate: values.endDate,
  timeZone: values.timeZone,
  query: values.query?.trim() || undefined,
})

const bindCommittedCurrency = (
  columns: ColumnsType<ReportOrderRow>,
  currency: string,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string
): ColumnsType<ReportOrderRow> =>
  columns.map((column) => {
    const key = String(column.key)
    if (!['gross', 'refund', 'net'].includes(key)) return column
    const labels = {
      gross: 'Gross ({currency})',
      refund: 'Refunds ({currency})',
      net: 'Net ({currency})',
    } as const
    return {
      ...column,
      title: t(labels[key as keyof typeof labels], { currency }),
      render: (value: number) => formatMinorCurrency(value, currency, locale),
    }
  })

const ReportExportAction = ({
  appliedFilters,
  onCreated,
}: {
  appliedFilters: ReportOrderFilters
  onCreated: (reportExport: ReportExport) => void
}) => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [form] = Form.useForm<{ reason: string }>()

  const submitExport = async ({ reason }: { reason: string }) => {
    setExporting(true)
    try {
      const created = await createReportExport({
        currency: appliedFilters.currency,
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        timeZone: appliedFilters.timeZone,
        ...(appliedFilters.query ? { query: appliedFilters.query } : {}),
        confirm: true,
        reason,
      })
      onCreated(created)
      setOpen(false)
      void message.success(
        created.status === 'ready'
          ? translateNow('Report export is ready.')
          : translateNow('Report export is being prepared in the background.')
      )
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          form.resetFields()
          setOpen(true)
        }}
      >
        {t('Export CSV')}
      </Button>
      <Modal
        title={t('Export scoped order report')}
        open={open}
        okText={t('Confirm export')}
        confirmLoading={exporting}
        destroyOnHidden
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Alert
          className="mb-4"
          type="warning"
          message={t(
            'The CSV contains customer email addresses. Access is audited and expires after 24 hours.'
          )}
        />
        <Form form={form} layout="vertical" onFinish={(values) => void submitExport(values)}>
          <Form.Item
            name="reason"
            label={t('Reason')}
            rules={[{ min: 3, required: true, message: t('Enter an export reason.') }]}
          >
            <Input.TextArea aria-label={t('Export reason')} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export const OrderReportPage = () => {
  const { role, permissions } = useAuth()
  const { locale, t } = useI18n()
  const localizeError = useLocalizedApiError()
  const [entryBaseline] = useState<ReportFilterValues>(parseEntryQuery)
  const [reportExport, setReportExport] = useState<ReportExport | null>(null)
  const canExport = hasPermission(role, 'reporting.export', permissions)

  const filterFields = useMemo<TemplateListFilterField<ReportFilterValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: t('Order'),
        inputProps: {
          'aria-label': t('Search report orders'),
          placeholder: t('Order reference or customer email'),
          type: 'search',
        },
      },
      {
        type: 'select',
        name: 'currency',
        label: t('Currency'),
        options: REPORT_CURRENCIES.map((value) => ({ label: value, value })),
        selectProps: { 'aria-label': t('Report currency') },
      },
      {
        type: 'select',
        name: 'timeZone',
        label: t('Time zone'),
        options: getTimeZoneOptions(entryBaseline.timeZone),
        selectProps: { 'aria-label': t('Report time zone'), showSearch: true },
      },
      {
        type: 'input',
        name: 'startDate',
        label: t('Start date'),
        inputProps: { 'aria-label': t('Report start date'), type: 'date' },
      },
      {
        type: 'input',
        name: 'endDate',
        label: t('End date'),
        inputProps: { 'aria-label': t('Report end date'), type: 'date' },
      },
    ],
    [entryBaseline.timeZone, t]
  )

  const spec = useMemo<
    StandardListPageSpec<
      ReportFilterValues,
      ReportOrderFilters,
      ReportListResponse,
      ReportOrderRow,
      Error
    >
  >(
    () => ({
      pageTitle: t('Order revenue report'),
      cardTitle: t('Order revenue report'),
      tableId: 'order-revenue-report-list',
      initialFilters: toFilters(entryBaseline),
      initialFormValues: entryBaseline,
      toFilters,
      pagination: {
        defaultPageSize: 20,
        includeAllDataOption: false,
        maxPageSize: 100,
        pageSizeOptions: [20, 50, 100],
      },
      buildRequestFilters: buildReportRequestFilters,
      request: fetchReportOrders,
      selectItems: selectReportRows,
      mapError: (error) => new Error(localizeError(error)),
      filterFields,
      renderBetweenFilterAndContent: (
        <>
          <Alert
            type="info"
            showIcon
            title={t(
              'Drill down from gross and refund events without mixing currencies, environments, or test checkouts.'
            )}
          />
          {reportExport ? (
            <Alert
              type={reportExport.status === 'ready' ? 'success' : 'info'}
              message={t('Export {id}: {status}', {
                id: reportExport.id,
                status: t(reportExport.status),
              })}
              description={
                reportExport.status === 'ready' ? (
                  <a href={reportExportDownloadUrl(reportExport.id)}>
                    {t('Download export ({count} rows)', { count: reportExport.rowCount ?? 0 })}
                  </a>
                ) : (
                  t('The export expires at {time}.', {
                    time: dayjs(reportExport.expiresAt).format('YYYY-MM-DD HH:mm'),
                  })
                )
              }
            />
          ) : null}
        </>
      ),
      toolbarExtra: ({ appliedFilters }) =>
        canExport ? (
          <ReportExportAction appliedFilters={appliedFilters} onCreated={setReportExport} />
        ) : null,
      toolbarExtraVisible: canExport,
      buildColumns: () => [
        { dataIndex: 'publicReference', key: 'reference', title: t('Order'), width: 170 },
        {
          dataIndex: 'createdAt',
          key: 'created',
          title: t('Created (UTC)'),
          width: 190,
          render: (value: string) => dayjs.utc(value).format('YYYY-MM-DD HH:mm'),
        },
        { dataIndex: 'email', key: 'email', title: t('Customer'), width: 220 },
        {
          dataIndex: 'paymentStatus',
          key: 'payment',
          title: t('Payment'),
          width: 150,
          render: (value: string) => <Tag>{t(value)}</Tag>,
        },
        {
          dataIndex: 'orderStatus',
          key: 'orderStatus',
          title: t('Order status'),
          width: 150,
          render: (value: string) => t(value),
        },
        { dataIndex: 'grossContribution', key: 'gross', title: 'Gross', width: 150 },
        { dataIndex: 'refundContribution', key: 'refund', title: 'Refunds', width: 150 },
        { dataIndex: 'netContribution', key: 'net', title: 'Net', width: 150 },
      ],
      buildTableNode: ({
        columns,
        dataSource,
        loading,
        pagination,
        appliedFilters,
        tableClassName,
        tableSize,
        virtualScroll,
      }) => (
        <Table<ReportOrderRow>
          className={tableClassName}
          rowKey="publicReference"
          columns={bindCommittedCurrency(columns, appliedFilters.currency, locale, t)}
          dataSource={dataSource}
          loading={loading}
          size={tableSize}
          pagination={pagination}
          virtual={virtualScroll.enabled}
          scroll={virtualScroll.enabled ? virtualScroll.scroll : { x: 1330 }}
        />
      ),
      stateCopy: {
        errorTitle: t('List could not be loaded'),
        emptyTitle: t('No order events match this reporting window.'),
        emptyDescription: t('No order events match this reporting window.'),
      },
    }),
    [canExport, entryBaseline, filterFields, locale, localizeError, reportExport, t]
  )

  return <StandardListPageRecipe spec={spec} />
}
