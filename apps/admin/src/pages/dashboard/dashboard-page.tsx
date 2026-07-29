import type { ReportingQuery, RevenueMetrics, RevenueReport } from '@shoppp/contracts'
import { Button, Card, Col, Empty, Row, Select, Skeleton, Space, Statistic, Table, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchRevenueReport } from '../../services/reporting/api'

void React

const TIME_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Shanghai']

const initialQuery = (): ReportingQuery => ({
  currency: 'USD',
  endDate: dayjs().format('YYYY-MM-DD'),
  startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
})

const formatMinorUnits = (amount: number, currency: string) => {
  const formatter = new Intl.NumberFormat(undefined, { currency, style: 'currency' })
  const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amount / 10 ** decimals)
}

type MetricCardProps = {
  label: string
  value: number
  currency?: string
  comparison: number
  comparisonWindow: string
}

const MetricCard = ({
  label,
  value,
  currency,
  comparison,
  comparisonWindow,
}: MetricCardProps) => (
  <Card>
    <Statistic
      title={label}
      value={currency ? formatMinorUnits(value, currency) : value}
      styles={{ content: { fontSize: 24 } }}
    />
    <p className="mb-0 mt-2 text-xs text-slate-500">
      Previous {comparisonWindow}: {currency ? formatMinorUnits(comparison, currency) : comparison}
    </p>
  </Card>
)

export const DashboardPage = () => {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ReportingQuery>(initialQuery)
  const [query, setQuery] = useState<ReportingQuery>(initialQuery)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await fetchRevenueReport(query))
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const comparisonWindow = report
    ? `${report.comparison.startDate}–${report.comparison.endDate}`
    : '—'
  const cards = useMemo<
    Array<{
      comparisonKey: keyof RevenueMetrics
      currency?: boolean
      key: keyof RevenueMetrics
      label: string
    }>
  >(
    () => [
      { comparisonKey: 'grossSales', currency: true, key: 'grossSales', label: 'Gross sales' },
      { comparisonKey: 'refundTotal', currency: true, key: 'refundTotal', label: 'Refunds' },
      { comparisonKey: 'netSales', currency: true, key: 'netSales', label: 'Net sales' },
      { comparisonKey: 'orderCount', key: 'orderCount', label: 'Paid orders' },
      {
        comparisonKey: 'averageOrderValue',
        currency: true,
        key: 'averageOrderValue',
        label: 'Average order value',
      },
    ],
    []
  )

  const applyQuery = () => {
    if (draft.startDate > draft.endDate) {
      void message.error('Start date must not be after end date.')
      return
    }
    setQuery(draft)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Commerce dashboard</h1>
        <p className="text-slate-500">
          Authoritative paid-order and successful-refund events, kept separate by currency and
          environment.
        </p>
      </div>
      <Card>
        <Space wrap align="end">
          <label>
            <span className="mb-1 block text-xs text-slate-500">Currency</span>
            <Select
              aria-label="Reporting currency"
              className="w-28"
              value={draft.currency}
              options={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(currency) => setDraft((current) => ({ ...current, currency }))}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">Time zone</span>
            <Select
              aria-label="Reporting time zone"
              className="w-52"
              showSearch
              value={draft.timeZone}
              options={[...new Set([draft.timeZone, ...TIME_ZONES])].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(timeZone) => setDraft((current) => ({ ...current, timeZone }))}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">Start date</span>
            <input
              aria-label="Reporting start date"
              className="h-8 rounded-md border border-slate-300 px-3"
              type="date"
              value={draft.startDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">End date</span>
            <input
              aria-label="Reporting end date"
              className="h-8 rounded-md border border-slate-300 px-3"
              type="date"
              value={draft.endDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </label>
          <Button type="primary" onClick={applyQuery}>
            Apply
          </Button>
        </Space>
      </Card>

      {loading && !report ? (
        <Card><Skeleton active /></Card>
      ) : report ? (
        <>
          <Card size="small">
            <strong>Reporting basis:</strong> {report.currency} · {report.timeZone} ·{' '}
            {report.current.startDate}–{report.current.endDate}
          </Card>
          <Row gutter={[16, 16]}>
            {cards.map((card) => (
              <Col key={card.key} xs={24} md={12} xl={card.key === 'averageOrderValue' ? 24 : 6}>
                <MetricCard
                  label={card.label}
                  value={report.current.metrics[card.key]}
                  comparison={report.comparison.metrics[card.comparisonKey]}
                  comparisonWindow={comparisonWindow}
                  {...(card.currency ? { currency: report.currency } : {})}
                />
              </Col>
            ))}
          </Row>
          <Card
            title="Daily revenue series"
            extra={
              <Button
                onClick={() => {
                  const params = new URLSearchParams(query)
                  navigate(`/reports/orders?${params.toString()}`)
                }}
              >
                View underlying orders
              </Button>
            }
          >
            <Table
              rowKey="date"
              pagination={false}
              dataSource={report.current.series}
              locale={{ emptyText: <Empty description="No commerce events in this window." /> }}
              columns={[
                { dataIndex: 'date', key: 'date', title: 'Local date', width: 120 },
                {
                  dataIndex: 'grossSales',
                  key: 'gross',
                  title: `Gross (${report.currency})`,
                  render: (value: number) => formatMinorUnits(value, report.currency),
                },
                {
                  dataIndex: 'refundTotal',
                  key: 'refund',
                  title: `Refunds (${report.currency})`,
                  render: (value: number) => formatMinorUnits(value, report.currency),
                },
                {
                  dataIndex: 'netSales',
                  key: 'net',
                  title: `Net (${report.currency})`,
                  render: (value: number) => formatMinorUnits(value, report.currency),
                },
                {
                  dataIndex: 'orderCount',
                  key: 'orders',
                  title: 'Paid orders',
                  width: 120,
                },
              ]}
              scroll={{ x: 720 }}
            />
          </Card>
          <Card title="Metric definitions">
            <dl className="grid gap-3 md:grid-cols-2">
              {Object.entries(report.definitions).map(([name, definition]) => (
                <div key={name}>
                  <dt className="font-medium">{name}</dt>
                  <dd className="text-sm text-slate-500">{definition}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      ) : (
        <Empty description="Reporting data is unavailable." />
      )}
    </div>
  )
}
