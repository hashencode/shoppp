import React from 'react'
import { Card, theme, type CardProps } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useTheme } from '../../contexts/theme-context'

void React

// Presentation extracted from the analysis template; both pages share these styles.
export const AnalysisMetricCard = (props: CardProps) => (
  <Card
    {...props}
    variant="borderless"
    className="w-full [&_.ant-card-body]:!flex [&_.ant-card-body]:!min-h-[188px] [&_.ant-card-body]:!flex-col [&_.ant-card-body]:!px-5 [&_.ant-card-body]:!py-[18px] [&_.ant-card-head]:!px-5 [&_.ant-statistic-title]:!text-[var(--text-secondary)]"
  />
)

export const AnalysisReportCard = (props: CardProps) => (
  <Card
    {...props}
    variant="borderless"
    className="[&_.ant-card-head]:border-b [&_.ant-card-head]:border-[var(--border-muted)] max-lg:[&_.ant-tabs-nav]:flex-wrap max-lg:[&_.ant-tabs-extra-content]:w-full max-lg:[&_.ant-tabs-extra-content]:pb-3"
  />
)

export const AnalysisRank = ({ rank }: { rank: number }) => {
  const { token } = theme.useToken()
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
      style={
        rank <= 3
          ? { background: token.colorText, color: token.colorBgContainer }
          : { background: token.colorFillSecondary, color: token.colorTextSecondary }
      }
    >
      {rank}
    </span>
  )
}

export const AnalysisChart = ({
  series,
  kind = 'sales',
  label,
  format,
}: {
  series: { date: string; value: number }[]
  kind?: 'sales' | 'area' | 'bars'
  label?: string
  format?: (value: number) => string
}) => {
  const { token } = theme.useToken()
  const { resolvedTheme } = useTheme()
  const mini = kind !== 'sales'
  const area = kind === 'area'
  const color = area ? token.colorInfo : token.colorPrimary
  return (
    <div {...(label ? { role: 'img', 'aria-label': label } : {})}>
      <ReactECharts
        notMerge
        opts={{ renderer: 'svg' }}
        theme={resolvedTheme === 'dark' ? 'dark' : undefined}
        style={{ height: mini ? 46 : 300 }}
        option={{
          backgroundColor: 'transparent',
          animation: false,
          textStyle: { color: token.colorTextSecondary },
          tooltip: { trigger: 'axis', ...(format ? { valueFormatter: format } : {}) },
          xAxis: {
            type: 'category',
            show: !mini,
            boundaryGap: !area,
            data: series.map((item) => item.date),
            axisLine: { lineStyle: { color: token.colorBorderSecondary } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            show: !mini,
            ...(format ? { axisLabel: { formatter: format } } : {}),
            splitLine: { lineStyle: { color: token.colorSplit } },
          },
          series: [
            {
              name: label,
              data: series.map((item) => item.value),
              type: area ? 'line' : 'bar',
              smooth: area,
              symbol: 'none',
              lineStyle: { color, width: 2 },
              ...(area
                ? { areaStyle: { color: token.colorInfoBg } }
                : { barWidth: mini ? '55%' : 26 }),
              itemStyle: { color, ...(!mini ? { borderRadius: [6, 6, 0, 0] } : {}) },
            },
          ],
          grid: {
            left: 0,
            right: 0,
            top: mini ? 0 : 20,
            bottom: mini ? 0 : 20,
            containLabel: !mini,
          },
        }}
      />
    </div>
  )
}
