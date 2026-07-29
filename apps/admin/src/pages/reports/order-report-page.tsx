import type { ReportExport, ReportOrderRow, ReportingQuery } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  createReportExport,
  fetchReportOrders,
  reportExportDownloadUrl,
} from '../../services/reporting/api'

void React

const paramsQuery = (): ReportingQuery => {
  const params = new URLSearchParams(window.location.search)
  return {
    currency: params.get('currency') ?? 'USD',
    endDate: params.get('endDate') ?? dayjs().format('YYYY-MM-DD'),
    startDate: params.get('startDate') ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    timeZone:
      params.get('timeZone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  }
}

const formatMinorUnits = (amount: number, currency: string) => {
  const formatter = new Intl.NumberFormat(undefined, { currency, style: 'currency' })
  const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amount / 10 ** decimals)
}

export const OrderReportPage = () => {
  const { role } = useAuth()
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
  const canExport = hasPermission(role, 'reporting.export')

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
        void message.error(normalizeApiError(error).message)
      } finally {
        setLoading(false)
      }
    },
    [committedSearch, query]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      { dataIndex: 'publicReference', key: 'reference', title: 'Order', width: 170 },
      {
        dataIndex: 'createdAt',
        key: 'created',
        title: 'Created (UTC)',
        width: 190,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      { dataIndex: 'email', key: 'email', title: 'Customer', width: 220 },
      {
        dataIndex: 'paymentStatus',
        key: 'payment',
        title: 'Payment',
        width: 150,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      { dataIndex: 'orderStatus', key: 'orderStatus', title: 'Order status', width: 150 },
      {
        dataIndex: 'grossContribution',
        key: 'gross',
        title: `Gross (${query.currency})`,
        width: 150,
        render: (value: number) => formatMinorUnits(value, query.currency),
      },
      {
        dataIndex: 'refundContribution',
        key: 'refund',
        title: `Refunds (${query.currency})`,
        width: 150,
        render: (value: number) => formatMinorUnits(value, query.currency),
      },
      {
        dataIndex: 'netContribution',
        key: 'net',
        title: `Net (${query.currency})`,
        width: 150,
        render: (value: number) => formatMinorUnits(value, query.currency),
      },
    ],
    [query.currency]
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
          ? 'Report export is ready.'
          : 'Report export is being prepared in the background.'
      )
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Order revenue report</h1>
        <p className="text-slate-500">
          Drill down from gross and refund events without mixing currencies, environments, or test
          checkouts.
        </p>
      </div>
      <Alert
        type="info"
        showIcon
        message={`Reporting basis: ${query.currency} · ${query.timeZone} · ${query.startDate}–${query.endDate}`}
      />
      <Space wrap align="end">
        <Input.Search
          aria-label="Search report orders"
          allowClear
          className="w-80"
          placeholder="Order reference or customer email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => setCommittedSearch(value.trim())}
        />
        <Select
          aria-label="Report currency"
          className="w-28"
          value={query.currency}
          options={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((value) => ({
            label: value,
            value,
          }))}
          onChange={(currency) => setQuery((current) => ({ ...current, currency }))}
        />
        <Select
          aria-label="Report time zone"
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
          <span className="mb-1 block text-xs text-slate-500">Start date</span>
          <input
            aria-label="Report start date"
            className="h-8 rounded-md border border-slate-300 px-3"
            type="date"
            value={query.startDate}
            onChange={(event) =>
              setQuery((current) => ({ ...current, startDate: event.target.value }))
            }
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-500">End date</span>
          <input
            aria-label="Report end date"
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
            Export CSV
          </Button>
        ) : null}
      </Space>
      {reportExport ? (
        <Alert
          type={reportExport.status === 'ready' ? 'success' : 'info'}
          message={`Export ${reportExport.id}: ${reportExport.status}`}
          description={
            reportExport.status === 'ready' ? (
              <a href={reportExportDownloadUrl(reportExport.id)}>
                Download export ({reportExport.rowCount ?? 0} rows)
              </a>
            ) : (
              `The export expires at ${dayjs(reportExport.expiresAt).format('YYYY-MM-DD HH:mm')}.`
            )
          }
        />
      ) : null}
      <Table
        rowKey="publicReference"
        columns={columns}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: 'No order events match this reporting window.' }}
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
        title="Export scoped order report"
        open={exportOpen}
        okText="Confirm export"
        confirmLoading={exporting}
        destroyOnHidden
        onCancel={() => setExportOpen(false)}
        onOk={() => form.submit()}
      >
        <Alert
          className="mb-4"
          type="warning"
          message="The CSV contains customer email addresses. Access is audited and expires after 24 hours."
        />
        <Form form={form} layout="vertical" onFinish={(values) => void submitExport(values)}>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ min: 3, required: true, message: 'Enter an export reason.' }]}
          >
            <Input.TextArea aria-label="Export reason" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
