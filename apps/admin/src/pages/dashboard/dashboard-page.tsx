import type { ReportingQuery, RevenueMetrics, RevenueReport } from '@shoppp/contracts'
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  message,
} from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchRevenueReport } from '../../services/reporting/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'

void React

const TIME_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Shanghai']

const initialQuery = (): ReportingQuery => ({
  currency: 'USD',
  endDate: dayjs().format('YYYY-MM-DD'),
  startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
})

type MetricCardProps = {
  label: string
  value: number
  currency?: string
  comparison: number
  locale: string
  previousLabel: string
}

const MetricCard = ({
  label,
  value,
  currency,
  comparison,
  locale,
  previousLabel,
}: MetricCardProps) => (
  <Card>
    <Statistic
      title={label}
      value={currency ? formatMinorCurrency(value, currency, locale) : value}
      styles={{ content: { fontSize: 24 } }}
    />
    <p className="mb-0 mt-2 text-xs text-slate-500">
      {previousLabel}: {currency ? formatMinorCurrency(comparison, currency, locale) : comparison}
    </p>
  </Card>
)

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const localizeError = useLocalizedApiError()
  const [draft, setDraft] = useState<ReportingQuery>(initialQuery)
  const [query, setQuery] = useState<ReportingQuery>(initialQuery)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await fetchRevenueReport(query))
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [localizeError, query])

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
      { comparisonKey: 'grossSales', currency: true, key: 'grossSales', label: t('Gross sales') },
      { comparisonKey: 'refundTotal', currency: true, key: 'refundTotal', label: t('Refunds') },
      { comparisonKey: 'netSales', currency: true, key: 'netSales', label: t('Net sales') },
      { comparisonKey: 'orderCount', key: 'orderCount', label: t('Paid orders') },
      {
        comparisonKey: 'averageOrderValue',
        currency: true,
        key: 'averageOrderValue',
        label: t('Average order value'),
      },
    ],
    [t]
  )

  const applyQuery = () => {
    if (draft.startDate > draft.endDate) {
      void message.error(t('Start date must not be after end date.'))
      return
    }
    setQuery(draft)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Commerce dashboard')}</h1>
        <p className="text-slate-500">
          {t(
            'Authoritative paid-order and successful-refund events, kept separate by currency and environment.'
          )}
        </p>
      </div>
      <Card>
        <Space wrap align="end">
          <label>
            <span className="mb-1 block text-xs text-slate-500">{t('Currency')}</span>
            <Select
              aria-label={t('Currency')}
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
            <span className="mb-1 block text-xs text-slate-500">{t('Time zone')}</span>
            <Select
              aria-label={t('Time zone')}
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
            <span className="mb-1 block text-xs text-slate-500">{t('Start date')}</span>
            <input
              aria-label={t('Start date')}
              className="h-8 rounded-md border border-slate-300 px-3"
              type="date"
              value={draft.startDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">{t('End date')}</span>
            <input
              aria-label={t('End date')}
              className="h-8 rounded-md border border-slate-300 px-3"
              type="date"
              value={draft.endDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </label>
          <Button type="primary" onClick={applyQuery}>
            {t('Apply')}
          </Button>
        </Space>
      </Card>

      {loading && !report ? (
        <Card>
          <Skeleton active />
        </Card>
      ) : report ? (
        <>
          <Card size="small">
            <strong>{t('Reporting basis:')}</strong> {report.currency} · {report.timeZone} ·{' '}
            {report.current.startDate}–{report.current.endDate}
          </Card>
          <Row gutter={[16, 16]}>
            {cards.map((card) => (
              <Col key={card.key} xs={24} md={12} xl={card.key === 'averageOrderValue' ? 24 : 6}>
                <MetricCard
                  label={card.label}
                  value={report.current.metrics[card.key]}
                  comparison={report.comparison.metrics[card.comparisonKey]}
                  locale={locale}
                  previousLabel={t('Previous {window}', { window: comparisonWindow })}
                  {...(card.currency ? { currency: report.currency } : {})}
                />
              </Col>
            ))}
          </Row>
          <Card
            title={t('Daily revenue series')}
            extra={
              <Button
                onClick={() => {
                  const params = new URLSearchParams(query)
                  navigate(`/reports/orders?${params.toString()}`)
                }}
              >
                {t('View underlying orders')}
              </Button>
            }
          >
            <Table
              rowKey="date"
              pagination={false}
              dataSource={report.current.series}
              locale={{
                emptyText: <Empty description={t('No commerce events in this window.')} />,
              }}
              columns={[
                { dataIndex: 'date', key: 'date', title: t('Local date'), width: 120 },
                {
                  dataIndex: 'grossSales',
                  key: 'gross',
                  title: t('Gross ({currency})', { currency: report.currency }),
                  render: (value: number) => formatMinorCurrency(value, report.currency, locale),
                },
                {
                  dataIndex: 'refundTotal',
                  key: 'refund',
                  title: t('Refunds ({currency})', { currency: report.currency }),
                  render: (value: number) => formatMinorCurrency(value, report.currency, locale),
                },
                {
                  dataIndex: 'netSales',
                  key: 'net',
                  title: t('Net ({currency})', { currency: report.currency }),
                  render: (value: number) => formatMinorCurrency(value, report.currency, locale),
                },
                {
                  dataIndex: 'orderCount',
                  key: 'orders',
                  title: t('Paid orders'),
                  width: 120,
                },
              ]}
              scroll={{ x: 720 }}
            />
          </Card>
          <Card title={t('Metric definitions')}>
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
        <Empty description={t('Reporting data is unavailable.')} />
      )}
    </div>
  )
}
