import React from 'react'
import { AnalysisChart } from '../../shared/template-kit/dashboard/analysis-ui'
import { useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'

void React

export const DashboardChart = ({
  series,
  label,
  currency,
  mini = false,
  bars = false,
}: {
  series: { date: string; value: number }[]
  label: string
  currency?: string
  mini?: boolean
  bars?: boolean
}) => {
  const { locale } = useI18n()
  const format = (value: number) =>
    currency
      ? formatMinorCurrency(value, currency, locale)
      : new Intl.NumberFormat(locale).format(value)
  return (
    <AnalysisChart
      series={series}
      label={label}
      kind={mini ? (bars ? 'bars' : 'area') : 'sales'}
      format={format}
    />
  )
}
