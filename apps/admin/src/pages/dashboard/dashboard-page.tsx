import type {
  ReportingQuery,
  RevenueReport,
  TrafficReport,
  ProductSalesReport,
} from '@shoppp/contracts'
import { ArrowDownOutlined, ArrowUpOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Divider,
  Statistic,
  Space,
  Empty,
  Row,
  Skeleton,
  Select,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import dayjs from 'dayjs'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import {
  fetchRevenueReport,
  fetchTrafficReport,
  fetchProductSalesReport,
} from '../../services/reporting/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'
import {
  AnalysisMetricCard,
  AnalysisReportCard,
  AnalysisRank,
} from '../../shared/template-kit/dashboard/analysis-ui'
import { resolveDefaultTimeZone } from '../../shared/utils/time-zones'
import { DashboardChart } from './dashboard-chart'

void React
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

const todayInZone = (timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (name: string) => parts.find((entry) => entry.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const initialQuery = (storageKey: string | null): ReportingQuery => {
  let timeZone = 'UTC'
  try {
    timeZone = resolveDefaultTimeZone()
  } catch {
    // Keep UTC if the browser cannot resolve its timezone.
  }
  const today = dayjs(todayInZone(timeZone))
  let currency = 'CNY'
  try {
    const saved = storageKey ? window.localStorage.getItem(storageKey) : null
    if (CURRENCY_OPTIONS.some((option) => option.value === saved)) currency = saved!
  } catch {
    // Storage may be unavailable; keep the default.
  }
  return {
    currency,
    endDate: today.format('YYYY-MM-DD'),
    startDate: today.subtract(29, 'day').format('YYYY-MM-DD'),
    timeZone,
  }
}

type FinancialSnapshot = {
  key: string
  query: ReportingQuery
  revenue: RevenueReport | null
  products: ProductSalesReport | null
}
type TrafficSnapshot = { key: string; report: TrafficReport | null }

const Failure = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useI18n()
  return (
    <Button size="small" onClick={onRetry}>
      {t('Retry')}
    </Button>
  )
}

const MetricCard = ({
  label,
  description,
  value,
  previous,
  currency,
  series,
  comparisonWindow,
  control,
  empty,
  loading,
  retry,
  bars = false,
}: {
  label: string
  description: string
  value?: number
  previous?: number
  currency?: string
  series: { date: string; value: number }[]
  comparisonWindow?: string
  control?: React.ReactNode
  empty: boolean
  loading: boolean
  bars?: boolean
  retry: () => void
}) => {
  const { locale, t } = useI18n()
  const { token } = theme.useToken()
  const format = (amount: number) =>
    currency
      ? formatMinorCurrency(amount, currency, locale)
      : new Intl.NumberFormat(locale).format(amount)
  const delta = value !== undefined && previous !== undefined ? value - previous : undefined
  const Direction = delta !== undefined && delta < 0 ? ArrowDownOutlined : ArrowUpOutlined
  return (
    <AnalysisMetricCard
      data-metric={label}
      extra={control}
      title={
        <Space size={6}>
          <span>{label}</span>
          <Tooltip title={description} trigger={['hover', 'focus']}>
            <Button
              type="text"
              size="small"
              aria-label={t('About {metric}', { metric: label })}
              icon={<InfoCircleOutlined aria-hidden />}
            />
          </Tooltip>
        </Space>
      }
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : value === undefined ? (
        <Failure onRetry={retry} />
      ) : empty ? (
        <div className="flex flex-grow items-center justify-center">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className="flex flex-grow flex-col">
          <div className="flex flex-grow flex-col justify-between">
            <div data-testid="metric-value">
              <Statistic value={value} formatter={() => format(value)} />
            </div>
            <DashboardChart
              label={t('Daily trend for {metric}', { metric: label })}
              series={series}
              currency={currency}
              mini
              bars={bars}
            />
          </div>
          {delta !== undefined && (
            <>
              <Divider className="!my-3" />
              <p
                className="mb-0 text-[13px]"
                style={{
                  color:
                    delta !== 0
                      ? delta > 0
                        ? token.colorSuccessText
                        : token.colorErrorText
                      : token.colorTextSecondary,
                }}
              >
                <Tooltip title={t('Previous {window}', { window: comparisonWindow ?? '—' })}>
                  <span>
                    {delta !== 0 && (
                      <Direction aria-label={delta > 0 ? t('Increase') : t('Decrease')} />
                    )}{' '}
                    {delta > 0 ? '+' : ''}
                    {format(delta)}
                    {previous! > 0 && (
                      <>
                        {' · '}
                        {new Intl.NumberFormat(locale, {
                          style: 'percent',
                          maximumFractionDigits: 1,
                        }).format(delta / previous!)}
                      </>
                    )}
                  </span>
                </Tooltip>
              </p>
            </>
          )}
        </div>
      )}
    </AnalysisMetricCard>
  )
}

export const DashboardPage = () => {
  const auth = useContext(AuthContext)
  const storageKey = auth?.session
    ? `shoppp.dashboard.currency:${auth.session.environment}:${auth.session.identityId}`
    : null
  return <DashboardContent key={storageKey ?? 'anonymous'} storageKey={storageKey} />
}

const DashboardContent = ({ storageKey }: { storageKey: string | null }) => {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const [query, setQuery] = useState<ReportingQuery>(() => initialQuery(storageKey))
  const [preset, setPreset] = useState('30')
  const [rangeError, setRangeError] = useState(false)
  const [tab, setTab] = useState('sales')
  const [financialRetry, setFinancialRetry] = useState(0)
  const [trafficRetry, setTrafficRetry] = useState(0)
  const [financial, setFinancial] = useState<FinancialSnapshot | null>(null)
  const [traffic, setTraffic] = useState<TrafficSnapshot | null>(null)
  const financialRequest = useRef(0)
  const trafficRequest = useRef(0)
  const { startDate, endDate, timeZone, currency } = query
  const financialKey = JSON.stringify(query)
  const trafficKey = JSON.stringify({ startDate, endDate, timeZone })

  useEffect(() => {
    const request = ++financialRequest.current
    const snapshot = { ...query }
    void Promise.allSettled([fetchRevenueReport(snapshot), fetchProductSalesReport(snapshot)]).then(
      ([revenue, products]) => {
        if (financialRequest.current !== request) return
        setFinancial({
          key: financialKey,
          query: snapshot,
          revenue: revenue.status === 'fulfilled' ? revenue.value : null,
          products: products.status === 'fulfilled' ? products.value : null,
        })
      }
    )
    return () => {
      financialRequest.current += 1
    }
  }, [query, financialKey, financialRetry])

  useEffect(() => {
    const request = ++trafficRequest.current
    void fetchTrafficReport({ startDate, endDate, timeZone }).then(
      (report) => {
        if (request === trafficRequest.current) setTraffic({ key: trafficKey, report })
      },
      () => {
        if (request === trafficRequest.current) setTraffic({ key: trafficKey, report: null })
      }
    )
    return () => {
      trafficRequest.current += 1
    }
  }, [startDate, endDate, timeZone, trafficKey, trafficRetry])

  const finances = financial?.key === financialKey ? financial : null
  const visits = traffic?.key === trafficKey ? traffic : null
  const revenue = finances?.revenue
  const report = visits?.report
  const retryFinancial = () => {
    setFinancial(null)
    setFinancialRetry((value) => value + 1)
  }
  const retryTraffic = () => {
    setTraffic(null)
    setTrafficRetry((value) => value + 1)
  }
  const commitDates = (start: string, end: string) => {
    const days = dayjs(end).diff(dayjs(start), 'day')
    if (days < 0 || days > 366) {
      setRangeError(true)
      return
    }
    setRangeError(false)
    setQuery((current) =>
      current.startDate === start && current.endDate === end
        ? current
        : { ...current, startDate: start, endDate: end }
    )
  }
  const changePreset = (value: string) => {
    setPreset(value)
    if (value === 'custom') return
    const today = dayjs(todayInZone(timeZone))
    let start = today
    switch (value) {
      case 'today':
        break
      case 'week':
        start = today.subtract((today.day() + 6) % 7, 'day')
        break
      case 'month':
        start = today.startOf('month')
        break
      case 'year':
        start = today.startOf('year')
        break
      default:
        start = today.subtract(Number(value) - 1, 'day')
    }
    commitDates(start.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'))
  }
  const datePresets = [
    { value: 'today', label: t('Today') },
    { value: '7', label: t('Last 7 days') },
    { value: '30', label: t('Last 30 days') },
    { value: 'week', label: t('This week') },
    { value: 'month', label: t('This month') },
    { value: 'year', label: t('This year') },
    { value: 'custom', label: t('Custom') },
  ]
  const currencyControl = (
    <Select
      aria-label={t('Currency')}
      value={currency}
      options={CURRENCY_OPTIONS}
      showSearch
      optionFilterProp="label"
      size="small"
      style={{ minWidth: 88 }}
      onChange={(next: string) => {
        setQuery((current) =>
          current.currency === next ? current : { ...current, currency: next }
        )
        try {
          if (storageKey) window.localStorage.setItem(storageKey, next)
        } catch {
          /* Storage is optional. */
        }
      }}
    />
  )
  const financialWindow = revenue
    ? `${revenue.comparison.startDate}–${revenue.comparison.endDate}`
    : undefined
  const financialMetrics = revenue ? [revenue.current.metrics, revenue.comparison.metrics] : []
  const hasFinancialActivity = financialMetrics.some(
    ({ grossSales, netSales, orderCount, refundTotal }) =>
      grossSales > 0 || netSales !== 0 || orderCount > 0 || refundTotal > 0
  )
  const financialCards = [
    {
      key: 'grossSales' as const,
      label: t('Gross sales'),
      description: t(
        'Order totals counted once when paid orders are created. Later cancellations and refunds do not change this amount.'
      ),
      monetary: true,
      empty: !financialMetrics.some(
        ({ grossSales, orderCount }) => grossSales > 0 || orderCount > 0
      ),
    },
    {
      key: 'orderCount' as const,
      label: t('Paid orders'),
      description: t('Paid orders created in the selected period.'),
      monetary: false,
      empty: !financialMetrics.some(({ orderCount }) => orderCount > 0),
    },
    {
      key: 'netSales' as const,
      label: t('Net sales'),
      description: t(
        'Gross sales minus refunds completed in the selected period. This can be negative when refunds exceed sales.'
      ),
      monetary: true,
      empty: !hasFinancialActivity,
    },
  ]
  const renderFinancialCard = (card: (typeof financialCards)[number]) => (
    <Col key={card.key} xs={24} sm={12} xl={6} className="flex">
      <MetricCard
        label={card.label}
        description={card.description}
        value={revenue?.current.metrics[card.key]}
        previous={revenue?.comparison.metrics[card.key]}
        currency={card.monetary ? currency : undefined}
        series={
          revenue?.current.series.map((row) => ({ date: row.date, value: row[card.key] })) ?? []
        }
        comparisonWindow={financialWindow}
        control={card.key === 'grossSales' ? currencyControl : undefined}
        empty={card.empty}
        bars={card.key === 'orderCount'}
        loading={!finances}
        retry={retryFinancial}
      />
    </Col>
  )
  const isSales = tab === 'sales'
  const chartReady = isSales ? finances : visits
  const chartData = isSales ? revenue : report
  const rankingReport = isSales ? finances?.products : report
  const series = isSales
    ? revenue?.current.series.map((row) => ({ date: row.date, value: row.grossSales }))
    : report?.series.map((row) => ({ date: row.date, value: row.pageViews }))
  const rankings = isSales
    ? finances?.products?.products.map((product) => ({ ...product, value: product.grossSales }))
    : report?.products.map((product) => ({ ...product, value: product.pageViews }))
  const showRanking = !!rankings?.length
  const retry = isSales ? retryFinancial : retryTraffic
  const hasTrafficActivity =
    report &&
    [
      report.uniqueVisitors,
      report.pageViews,
      report.comparison.uniqueVisitors,
      report.comparison.pageViews,
    ].some((value) => value > 0)
  const noActivity =
    revenue &&
    report &&
    finances?.products &&
    !hasFinancialActivity &&
    !hasTrafficActivity &&
    finances.products.products.length === 0 &&
    report.products.length === 0

  const dateControls = (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Space size={8} className="hidden lg:inline-flex">
        {datePresets
          .filter(({ value }) => ['today', 'week', 'month', 'year'].includes(value))
          .map(({ value, label }) => (
            <Button
              key={value}
              type="text"
              onClick={() => changePreset(value)}
              style={{
                color: preset === value ? token.colorPrimary : token.colorTextSecondary,
              }}
            >
              {label}
            </Button>
          ))}
      </Space>
      <Select
        aria-label={t('Date preset')}
        value={preset}
        onChange={changePreset}
        style={{ minWidth: 130 }}
        options={datePresets}
      />
      <DatePicker.RangePicker
        variant="filled"
        aria-label={t('Date range')}
        value={[dayjs(startDate), dayjs(endDate)]}
        allowClear={false}
        format="YYYY-MM-DD"
        placeholder={[t('Start date'), t('End date')]}
        style={{ maxWidth: '100%' }}
        onChange={(dates) => {
          if (dates?.[0] && dates[1]) {
            setPreset('custom')
            commitDates(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'))
          }
        }}
      />
    </div>
  )
  const rangeFeedback = rangeError && (
    <Alert type="warning" title={t('Select an ordered date range of at most 367 days.')} />
  )

  if (noActivity) {
    return (
      <div className="flex min-h-[calc(100dvh-104px)] items-center justify-center">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('Not enough data to display the dashboard yet.')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Row gutter={[24, 16]}>
        {renderFinancialCard(financialCards[0]!)}
        <Col xs={24} sm={12} xl={6} className="flex">
          <MetricCard
            label={t('Unique visitors')}
            description={t(
              'Distinct anonymous browsers across the selected period. Daily visitors are deduplicated separately.'
            )}
            value={report?.uniqueVisitors}
            empty={report?.uniqueVisitors === 0 && report.comparison.uniqueVisitors === 0}
            previous={report?.comparison.available ? report.comparison.uniqueVisitors : undefined}
            comparisonWindow={
              report ? `${report.comparison.startDate}–${report.comparison.endDate}` : undefined
            }
            series={
              report?.series.map((row) => ({ date: row.date, value: row.uniqueVisitors })) ?? []
            }
            loading={!visits}
            retry={retryTraffic}
          />
        </Col>
        {financialCards.slice(1).map(renderFinancialCard)}
      </Row>
      <AnalysisReportCard
        tabList={[
          { key: 'sales', tab: t('Sales') },
          { key: 'views', tab: t('Page views') },
        ]}
        activeTabKey={tab}
        onTabChange={setTab}
        tabBarExtraContent={dateControls}
      >
        {rangeFeedback}
        <Row gutter={[48, 16]}>
          <Col xs={24} lg={showRanking ? 16 : 24}>
            {!chartReady ? (
              <Skeleton active />
            ) : !chartData ? (
              <Failure onRetry={retry} />
            ) : (
              <DashboardChart
                label={isSales ? t('Daily gross sales') : t('Daily page views')}
                series={series ?? []}
                currency={isSales ? currency : undefined}
              />
            )}
            {isSales && revenue && (
              <Button
                onClick={() =>
                  navigate(`/reports/orders?${new URLSearchParams(finances!.query).toString()}`)
                }
              >
                {t('View underlying orders')}
              </Button>
            )}
            {chartData && !rankingReport && <Failure onRetry={retry} />}
          </Col>
          {showRanking && (
            <Col xs={24} lg={8}>
              <Typography.Title level={5}>
                {isSales ? t('Top products by sales') : t('Top products by page views')}
              </Typography.Title>
              <ol className="mt-2.5 list-none p-0">
                {rankings!.map((product, index) => (
                  <li key={product.productId} className="mt-4 flex items-center gap-2">
                    <AnalysisRank rank={index + 1} />
                    <span className="min-w-0 flex-1 break-words">
                      {product.path && rankingReport?.storefrontOrigin ? (
                        <a
                          href={`${rankingReport.storefrontOrigin}${product.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {product.name}
                        </a>
                      ) : (
                        product.name
                      )}
                    </span>
                    <span className="shrink-0">
                      {isSales
                        ? formatMinorCurrency(product.value, currency, locale)
                        : new Intl.NumberFormat(locale).format(product.value)}
                    </span>
                  </li>
                ))}
              </ol>
            </Col>
          )}
        </Row>
      </AnalysisReportCard>
    </div>
  )
}
