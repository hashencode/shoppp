import type { ReportExport, ReportOrderRow, ReportingQuery } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, App } from 'antd'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  createReportExport,
  fetchReportOrders,
  reportExportDownloadUrl,
} from '../../services/reporting/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'

void React
dayjs.extend(utc)

const paramsQuery = (): ReportingQuery => {
  const params = new URLSearchParams(window.location.search)
  return {
    currency: params.get('currency') ?? 'USD',
    endDate: params.get('endDate') ?? dayjs().format('YYYY-MM-DD'),
    startDate: params.get('startDate') ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    timeZone: params.get('timeZone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  }
}

export const OrderReportPage = () => {
  const { message } = App.useApp()
  const { role, permissions } = useAuth()
  const { locale, t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [query, setQuery] = useState<ReportingQuery>(paramsQuery)
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [rows, setRows] = useState<ReportOrderRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reportExport, setReportExport] = useState<ReportExport | null>(null)
  const [form] = Form.useForm<{ reason: string }>()
  const pageSize = 20
  const canExport = hasPermission(role, 'reporting.export', permissions)

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      try {
        const response = await fetchReportOrders({
          ...query,
          page: nextPage,
          pageSize,
          ...(committedSearch ? { query: committedSearch } : {}),
        })
        setRows(response.data)
        setPage(response.page)
        setTotal(response.total)
      } catch (error) {
        void message.error(localizeError(error))
      } finally {
        setLoading(false)
      }
    },
    [message, committedSearch, localizeError, query]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
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
      {
        dataIndex: 'grossContribution',
        key: 'gross',
        title: t('Gross ({currency})', { currency: query.currency }),
        width: 150,
        render: (value: number) => formatMinorCurrency(value, query.currency, locale),
      },
      {
        dataIndex: 'refundContribution',
        key: 'refund',
        title: t('Refunds ({currency})', { currency: query.currency }),
        width: 150,
        render: (value: number) => formatMinorCurrency(value, query.currency, locale),
      },
      {
        dataIndex: 'netContribution',
        key: 'net',
        title: t('Net ({currency})', { currency: query.currency }),
        width: 150,
        render: (value: number) => formatMinorCurrency(value, query.currency, locale),
      },
    ],
    [locale, query.currency, t]
  )

  const submitExport = async ({ reason }: { reason: string }) => {
    setExporting(true)
    try {
      const created = await createReportExport({
        ...query,
        confirm: true,
        ...(committedSearch ? { query: committedSearch } : {}),
        reason,
      })
      setReportExport(created)
      setExportOpen(false)
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Order revenue report')}</h1>
        <p className="text-slate-500">
          {t(
            'Drill down from gross and refund events without mixing currencies, environments, or test checkouts.'
          )}
        </p>
      </div>
      <Space wrap align="end">
        <Input.Search
          aria-label={t('Search report orders')}
          allowClear
          className="w-80"
          placeholder={t('Order reference or customer email')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => setCommittedSearch(value.trim())}
        />
        <Select
          aria-label={t('Report currency')}
          className="w-28"
          value={query.currency}
          options={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((value) => ({
            label: value,
            value,
          }))}
          onChange={(currency) => setQuery((current) => ({ ...current, currency }))}
        />
        <Select
          aria-label={t('Report time zone')}
          className="w-52"
          showSearch
          value={query.timeZone}
          options={[
            ...new Set([
              query.timeZone,
              'UTC',
              'America/New_York',
              'Europe/London',
              'Asia/Shanghai',
            ]),
          ].map((value) => ({ label: value, value }))}
          onChange={(timeZone) => setQuery((current) => ({ ...current, timeZone }))}
        />
        <label>
          <span className="mb-1 block text-xs text-slate-500">{t('Start date')}</span>
          <input
            aria-label={t('Report start date')}
            className="h-8 rounded-md border border-slate-300 px-3"
            type="date"
            value={query.startDate}
            onChange={(event) =>
              setQuery((current) => ({ ...current, startDate: event.target.value }))
            }
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">{t('End date')}</span>
          <input
            aria-label={t('Report end date')}
            className="h-8 rounded-md border border-slate-300 px-3"
            type="date"
            value={query.endDate}
            onChange={(event) =>
              setQuery((current) => ({ ...current, endDate: event.target.value }))
            }
          />
        </label>
        {canExport ? (
          <Button
            onClick={() => {
              form.resetFields()
              setExportOpen(true)
            }}
          >
            {t('Export CSV')}
          </Button>
        ) : null}
      </Space>
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
      <Table
        rowKey="publicReference"
        columns={columns}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: t('No order events match this reporting window.') }}
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: false,
          total,
          onChange: (nextPage) => void load(nextPage),
        }}
        scroll={{ x: 1330 }}
      />
      <Modal
        title={t('Export scoped order report')}
        open={exportOpen}
        okText={t('Confirm export')}
        confirmLoading={exporting}
        destroyOnHidden
        onCancel={() => setExportOpen(false)}
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
    </div>
  )
}
