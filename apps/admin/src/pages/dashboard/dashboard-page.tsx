import type { ReportingQuery, RevenueMetrics, RevenueReport } from '@shoppp/contracts'
import { ArrowDownOutlined, ArrowUpOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  App,
  Tooltip,
  theme,
} from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchRevenueReport } from '../../services/reporting/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

void React

const TIME_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Shanghai']
const CURRENCY_OPTIONS = [
  ...new Set([
    'CNY',
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'HKD',
    'SGD',
    'AUD',
    'CAD',
    ...Intl.supportedValuesOf('currency'),
  ]),
].map((value) => ({ label: value, value }))

const initialQuery = (): ReportingQuery => ({
  currency: 'CNY',
  endDate: dayjs().format('YYYY-MM-DD'),
  startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
})

type MetricCardProps = {
  label: string
  value: number
  currency?: string
  comparison: number
  description: string
  comparisonWindow: string
}

const MetricCard = ({
  label,
  value,
  currency,
  comparison,
  description,
  comparisonWindow,
}: MetricCardProps) => {
  const { locale, t } = useI18n()
  const { token } = theme.useToken()
  const delta = value - comparison
  const currencyFormatter = currency
    ? new Intl.NumberFormat(locale, { style: 'currency', currency })
    : undefined
  const unit = currencyFormatter?.formatToParts(0).find((part) => part.type === 'currency')?.value
  const fractionDigits = currencyFormatter?.resolvedOptions().maximumFractionDigits ?? 0
  const divisor = 10 ** fractionDigits
  const numberFormatter = new Intl.NumberFormat(
    locale,
    currency ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits } : {}
  )
  const amount = numberFormatter.format(Math.abs(delta) / divisor)
  const DirectionIcon = delta > 0 ? ArrowUpOutlined : ArrowDownOutlined

  return (
    <Card className="h-full">
      <Statistic
        title={
          <span className="inline-flex items-center gap-1">
            {unit ? `${label} (${unit})` : label}
            <Tooltip title={description} trigger={['hover', 'focus']}>
              <Button
                type="text"
                size="small"
                aria-label={t('About {metric}', { metric: label })}
                icon={<QuestionCircleOutlined aria-hidden />}
                style={{ color: token.colorTextSecondary }}
              />
            </Tooltip>
          </span>
        }
        value={value / divisor}
        formatter={() => numberFormatter.format(value / divisor)}
        styles={{ content: { fontSize: 24 } }}
      />
      {delta !== 0 && (
        <p className="mb-0 mt-2 text-xs">
          <Tooltip title={t('Previous {window}', { window: comparisonWindow })}>
            <span style={{ color: delta > 0 ? token.colorSuccessText : token.colorErrorText }}>
              <DirectionIcon aria-label={delta > 0 ? t('Increase') : t('Decrease')} /> {amount}
            </span>
          </Tooltip>
        </p>
      )}
    </Card>
  )
}

export const DashboardPage = () => {
  const dateRangeId = useId()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const localizeError = useLocalizedApiError()
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const [query, setQuery] = useState<ReportingQuery>(initialQuery)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setReport(null)
      if (!query.startDate || !query.endDate) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const result = await fetchRevenueReport(query)
        if (active) setReport(result)
      } catch (error) {
        if (active) void message.error(localizeError(error))
      } finally {
        if (active) setLoading(false)
      }
    }
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [message, localizeError, query, retryAttempt])

  const comparisonWindow = report
    ? `${report.comparison.startDate}–${report.comparison.endDate}`
    : '—'
  const cards = useMemo<
    Array<{
      currency?: boolean
      key: keyof RevenueMetrics
      label: string
      description: string
    }>
  >(
    () => [
      {
        currency: true,
        key: 'grossSales',
        label: t('Gross sales'),
        description: t(
          'Order totals counted once when paid orders are created. Later cancellations and refunds do not change this amount.'
        ),
      },
      {
        currency: true,
        key: 'refundTotal',
        label: t('Refunds'),
        description: t(
          'Successful refunds counted by their completion time, including partial refunds and refunds for canceled orders.'
        ),
      },
      {
        currency: true,
        key: 'netSales',
        label: t('Net sales'),
        description: t(
          'Gross sales minus refunds completed in the selected period. This can be negative when refunds exceed sales.'
        ),
      },
      {
        key: 'orderCount',
        label: t('Paid orders'),
        description: t(
          'Paid orders created in the selected period. Failed checkouts and test orders are excluded.'
        ),
      },
      {
        currency: true,
        key: 'averageOrderValue',
        label: t('Average order value'),
        description: t(
          'Gross sales divided by paid order count, rounded to the currency’s smallest unit. Zero when there are no paid orders.'
        ),
      },
    ],
    [t]
  )
  const hasDateRange = Boolean(query.startDate && query.endDate)
  const updateQuery = (patch: Partial<ReportingQuery>) => {
    setReport(null)
    setLoading(true)
    setQuery((current) => ({ ...current, ...patch }))
  }

  return (
    <CustomPageRecipe title={t('Commerce dashboard')}>
      <Card>
        <Space wrap align="end" className="w-full [&>.ant-space-item]:max-w-full">
          <label>
            <span className="mb-1 block text-xs text-slate-500">{t('Currency')}</span>
            <Select
              aria-label={t('Currency')}
              className="w-28"
              showSearch
              optionFilterProp="label"
              value={query.currency}
              options={CURRENCY_OPTIONS}
              onChange={(currency) => updateQuery({ currency })}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-slate-500">{t('Time zone')}</span>
            <Select
              aria-label={t('Time zone')}
              className="w-52"
              showSearch
              value={query.timeZone}
              options={[...new Set([query.timeZone, ...TIME_ZONES])].map((value) => ({
                label: value,
                value,
              }))}
              onChange={(timeZone) => updateQuery({ timeZone })}
            />
          </label>
          <div>
            <span className="mb-1 block text-xs text-slate-500">{t('Date range')}</span>
            <label className="sr-only" htmlFor={`${dateRangeId}-start`}>
              {t('Start date')}
            </label>
            <label className="sr-only" htmlFor={`${dateRangeId}-end`}>
              {t('End date')}
            </label>
            <DatePicker.RangePicker
              id={{ start: `${dateRangeId}-start`, end: `${dateRangeId}-end` }}
              className="w-72 max-w-full"
              format="YYYY-MM-DD"
              placeholder={[t('Start date'), t('End date')]}
              value={[
                query.startDate ? dayjs(query.startDate) : null,
                query.endDate ? dayjs(query.endDate) : null,
              ]}
              onChange={(dates) =>
                updateQuery({
                  startDate: dates?.[0]?.format('YYYY-MM-DD') ?? '',
                  endDate: dates?.[1]?.format('YYYY-MM-DD') ?? '',
                })
              }
            />
          </div>
        </Space>
      </Card>

      {loading && !report ? (
        <Card>
          <Skeleton active />
          <span>{t('Loading report…')}</span>
        </Card>
      ) : report ? (
        <>
          <Row gutter={[16, 16]}>
            {cards.map((card) => (
              <Col key={card.key} xs={24} md={12} xl={card.key === 'averageOrderValue' ? 24 : 6}>
                <MetricCard
                  label={card.label}
                  value={report.current.metrics[card.key]}
                  comparison={report.comparison.metrics[card.key]}
                  description={card.description}
                  comparisonWindow={comparisonWindow}
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
                  render: (value: number) => numberFormatter.format(value),
                },
              ]}
              scroll={{ x: 720 }}
            />
          </Card>
        </>
      ) : (
        <Empty
          description={t(
            hasDateRange ? 'Reporting data is unavailable.' : 'Select a start and end date.'
          )}
        >
          {hasDateRange && (
            <Button onClick={() => setRetryAttempt((attempt) => attempt + 1)}>{t('Retry')}</Button>
          )}
        </Empty>
      )}
    </CustomPageRecipe>
  )
}
