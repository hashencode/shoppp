import type { ReportingQuery, RevenueMetrics, RevenueReport } from '@shoppp/contracts'
import { ArrowDownOutlined, ArrowUpOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Row,
  Skeleton,
  Statistic,
  Table,
  App,
  Tooltip,
  theme,
} from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchRevenueReport } from '../../services/reporting/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { useTheme } from '../../shared/contexts/theme-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'
import {
  buildSearchGridProps,
  TemplateListFilterForm,
  type TemplateListFilterField,
  useTemplateListFilters,
} from '../../shared/template-kit/list'
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

type DashboardFilterValues = {
  currency: string
  timeZone: string
  dateRange: [Dayjs, Dayjs]
}

type ReportSnapshot = {
  data: RevenueReport
  query: ReportingQuery
}

const toFilterValues = (query: ReportingQuery): DashboardFilterValues => ({
  currency: query.currency,
  timeZone: query.timeZone,
  dateRange: [dayjs(query.startDate), dayjs(query.endDate)],
})

const toReportingQuery = (values: DashboardFilterValues): ReportingQuery => ({
  currency: values.currency,
  timeZone: values.timeZone,
  startDate: values.dateRange[0].format('YYYY-MM-DD'),
  endDate: values.dateRange[1].format('YYYY-MM-DD'),
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
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const { searchCompactLayout } = useTheme()
  const localizeError = useLocalizedApiError()
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const [filterForm] = Form.useForm<DashboardFilterValues>()
  const [defaultQuery] = useState<ReportingQuery>(initialQuery)
  const [initialFilterValues] = useState<DashboardFilterValues>(() => toFilterValues(defaultQuery))
  const {
    filters: committedQuery,
    requestVersion,
    onSubmit: commitFilters,
    onReset: resetFilters,
  } = useTemplateListFilters<DashboardFilterValues, ReportingQuery>({
    form: filterForm,
    initialFilters: defaultQuery,
    toFilters: toReportingQuery,
    autoApplyOnValuesChange: false,
  })
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const latestRequest = useRef(0)

  useEffect(() => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    const querySnapshot = { ...committedQuery }
    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchRevenueReport(querySnapshot)
        if (latestRequest.current === requestId) {
          setReportSnapshot({ data: result, query: querySnapshot })
        }
      } catch (error) {
        if (latestRequest.current === requestId) void message.error(localizeError(error))
      } finally {
        if (latestRequest.current === requestId) setLoading(false)
      }
    }
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [message, localizeError, committedQuery, requestVersion, retryAttempt])

  const report = reportSnapshot?.data ?? null

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
  const filterFields = useMemo<TemplateListFilterField<DashboardFilterValues>[]>(
    () => [
      {
        type: 'select',
        name: 'currency',
        label: t('Currency'),
        options: CURRENCY_OPTIONS,
        formItemProps: { rules: [{ required: true }] },
        selectProps: {
          'aria-label': t('Currency'),
          allowClear: false,
          showSearch: true,
          optionFilterProp: 'label',
        },
      },
      {
        type: 'select',
        name: 'timeZone',
        label: t('Time zone'),
        options: [...new Set([defaultQuery.timeZone, ...TIME_ZONES])].map((value) => ({
          label: value,
          value,
        })),
        formItemProps: { rules: [{ required: true }] },
        selectProps: {
          'aria-label': t('Time zone'),
          allowClear: false,
          showSearch: true,
          optionFilterProp: 'label',
        },
      },
      {
        type: 'date-range',
        name: 'dateRange',
        label: t('Date range'),
        formItemProps: {
          rules: [
            {
              validator: async (_, value: DashboardFilterValues['dateRange'] | null) => {
                if (!value?.[0] || !value[1]) {
                  throw new Error(t('Select a start and end date.'))
                }
              },
            },
          ],
        },
        datePickerProps: {
          'aria-label': t('Date range'),
          format: 'YYYY-MM-DD',
          placeholder: [t('Start date'), t('End date')],
        },
      },
    ],
    [defaultQuery.timeZone, t]
  )
  const searchGridProps = useMemo(() => buildSearchGridProps(filterFields), [filterFields])
  const submitFilters = (values: DashboardFilterValues) => {
    setReportSnapshot(null)
    setLoading(true)
    commitFilters(values)
  }
  const resetAndQuery = () => {
    setReportSnapshot(null)
    setLoading(true)
    resetFilters()
  }
  const retry = () => {
    setReportSnapshot(null)
    setLoading(true)
    setRetryAttempt((attempt) => attempt + 1)
  }

  return (
    <CustomPageRecipe title={t('Commerce dashboard')}>
      <Card variant="borderless" styles={{ body: { paddingRight: 8 } }}>
        <TemplateListFilterForm<DashboardFilterValues>
          form={filterForm}
          formProps={{ initialValues: initialFilterValues }}
          fields={filterFields}
          fieldColProps={searchGridProps.formItem}
          labelCol={searchGridProps.labelItem}
          wrapperCol={searchGridProps.inputItem}
          actionsColProps={searchGridProps.actions}
          compactLayout={searchCompactLayout}
          submitText={t('Query')}
          submitLoading={loading && !report}
          onSubmit={submitFilters}
          onReset={resetAndQuery}
        />
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
                  const params = new URLSearchParams(reportSnapshot!.query)
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
        <Empty description={t('Reporting data is unavailable.')}>
          <Button onClick={retry}>{t('Retry')}</Button>
        </Empty>
      )}
    </CustomPageRecipe>
  )
}
