import React from 'react'
import ReactECharts from 'echarts-for-react'
import { theme } from 'antd'
import { useI18n } from '../../shared/contexts/i18n-context'
import { formatMinorCurrency } from '../../shared/i18n/format-currency'

void React

export const DashboardChart = ({
  series,
  label,
  currency,
  mini = false,
}: {
  series: { date: string; value: number }[]
  label: string
  currency?: string
  mini?: boolean
}) => {
  const { token } = theme.useToken()
  const { locale } = useI18n()
  const format = (value: number) =>
    currency
      ? formatMinorCurrency(value, currency, locale)
      : new Intl.NumberFormat(locale).format(value)
  return (
    <div role="img" aria-label={label}>
      <ReactECharts
        notMerge
        opts={{ renderer: 'svg' }}
        style={{ height: mini ? 48 : 320 }}
        option={{
          backgroundColor: 'transparent',
          animation: false,
          textStyle: { color: token.colorTextSecondary },
          tooltip: { trigger: 'axis', valueFormatter: (value: number) => format(value) },
          grid: {
            left: mini ? 2 : 0,
            right: mini ? 2 : 16,
            top: mini ? 4 : 24,
            bottom: mini ? 4 : 8,
            containLabel: !mini,
          },
          xAxis: {
            type: 'category',
            show: !mini,
            data: series.map((row) => row.date),
            axisLabel: { color: token.colorTextSecondary },
            axisLine: { lineStyle: { color: token.colorBorderSecondary } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            show: !mini,
            axisLabel: { color: token.colorTextSecondary, formatter: format },
            splitLine: { lineStyle: { color: token.colorSplit } },
          },
          series: [
            {
              name: label,
              type: mini ? 'line' : 'bar',
              data: series.map((row) => row.value),
              showSymbol: series.length === 1,
              symbolSize: 4,
              lineStyle: { width: 2, color: token.colorPrimary },
              itemStyle: { color: token.colorPrimary },
              areaStyle: mini ? { color: token.colorPrimaryBg } : undefined,
              barMaxWidth: 28,
            },
          ],
        }}
      />
    </div>
  )
}
