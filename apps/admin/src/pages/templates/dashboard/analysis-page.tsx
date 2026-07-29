import { ArrowDownOutlined, ArrowUpOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import { useState } from 'react'
import { getPieSource, rankingStores, searchData, type SalesType } from '../../../infrastructure/msw/handlers/dashboard'
import { useStandardPagination } from '../../../shared/hooks/use-standard-pagination'
import { useTheme } from '../../../shared/contexts/theme-context'

const metrics = {
  dailyActiveUsers: 1248,
  healthScore: 83,
  weeklyVisits: [
    { date: 'Mon', value: 980 },
    { date: 'Tue', value: 1120 },
    { date: 'Wed', value: 1080 },
    { date: 'Thu', value: 1230 },
    { date: 'Fri', value: 1290 },
    { date: 'Sat', value: 860 },
    { date: 'Sun', value: 940 },
  ],
}

export const AnalysisPage = () => {
  const { token } = theme.useToken()
  const { resolvedTheme } = useTheme()
  const visitsData = metrics.weeklyVisits
  const onlineTrend = metrics.weeklyVisits.map((item, idx) => ({
    ...item,
    value: Math.max(300, Math.round(item.value * (0.8 + (idx % 3) * 0.05))),
  }))
  const [salesType, setSalesType] = useState<SalesType>('all')
  const [activeTime, setActiveTime] = useState<'today' | 'week' | 'month' | 'year'>('year')
  const [activeChartTab, setActiveChartTab] = useState<'sales' | 'views'>('sales')
  const { pagination } = useStandardPagination({ total: searchData.length })
  const accentText = token.colorPrimary
  const mutedText = token.colorTextSecondary
  const chartAxisLine = token.colorBorderSecondary
  const chartSplitLine = token.colorSplit
  const trendUpColor = token.colorSuccess
  const trendDownColor = token.colorError
  const rankTopBg = token.colorText
  const rankTopText = token.colorBgContainer
  const rankOtherBg = token.colorFillSecondary
  const rankOtherText = token.colorTextSecondary

  const salesOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: visitsData.map((item) => item.date),
      boundaryGap: true,
      axisLine: { lineStyle: { color: chartAxisLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: chartSplitLine } },
    },
    series: [
      {
        data: visitsData.map((item) => item.value),
        type: 'bar',
        barWidth: 26,
        itemStyle: { color: token.colorPrimary, borderRadius: [6, 6, 0, 0] },
      },
    ],
    grid: { left: 0, right: 0, top: 20, bottom: 20, containLabel: true },
  }

  const tinyAreaOption = {
    xAxis: { type: 'category', show: false, boundaryGap: false, data: visitsData.map((item) => item.date) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        data: visitsData.map((item) => item.value),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: token.colorInfo, width: 2 },
        areaStyle: { color: token.colorInfoBg },
      },
    ],
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
  }

  const tinyBarOption = {
    xAxis: { type: 'category', show: false, boundaryGap: true, data: visitsData.map((item) => item.date) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        data: visitsData.map((item) => item.value),
        type: 'bar',
        itemStyle: { color: token.colorPrimary },
        barWidth: '55%',
      },
    ],
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
  }

  const onlineAreaOption = {
    xAxis: { type: 'category', show: false, boundaryGap: false, data: onlineTrend.map((item) => item.date) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        data: onlineTrend.map((item) => item.value),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: token.colorPrimary, width: 2 },
        areaStyle: { color: token.colorPrimaryBg },
      },
    ],
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
  }

  const pieSource = getPieSource(salesType)

  const proportionOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        data: pieSource,
        label: { formatter: '{b}: {c}' },
      },
    ],
  }

  return (
    <div className="space-y-4">
      <Row gutter={[24, 16]}>
        <Col xs={24} sm={12} xl={6} className="flex">
          <Card
            className="w-full [&_.ant-card-body]:!flex [&_.ant-card-body]:!min-h-[188px] [&_.ant-card-body]:!flex-col [&_.ant-card-body]:!px-5 [&_.ant-card-body]:!py-[18px] [&_.ant-card-head]:!px-5 [&_.ant-statistic-title]:!text-[var(--text-secondary)]"
            variant="borderless"
            title={
              <Space size={6}>
                总销售额
                <Tooltip title="指标说明">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            }
          >
            <div className="flex flex-grow flex-col">
              <div className={'flex-grow flex flex-col justify-between'}>
                <Statistic value={126560} precision={0} prefix="¥" />
                <div className="mt-2 flex gap-3.5 text-[13px]" style={{ color: mutedText }}>
                  <span>
                    周同比 <ArrowUpOutlined style={{ color: trendUpColor }} /> 12%
                  </span>
                  <span>
                    日同比 <ArrowDownOutlined style={{ color: trendDownColor }} /> 11%
                  </span>
                </div>
              </div>

              <Divider className="!my-3" />
              <div>
                <span>日销售额 ￥12,423</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6} className="flex">
          <Card
            className="w-full [&_.ant-card-body]:!flex [&_.ant-card-body]:!min-h-[188px] [&_.ant-card-body]:!flex-col [&_.ant-card-body]:!px-5 [&_.ant-card-body]:!py-[18px] [&_.ant-card-head]:!px-5 [&_.ant-statistic-title]:!text-[var(--text-secondary)]"
            variant="borderless"
            title="访问量"
          >
            <div className="flex flex-grow flex-col">
              <div className={'flex-grow flex flex-col justify-between'}>
                <Statistic value={metrics.dailyActiveUsers} />
                <div>
                  <ReactECharts option={tinyAreaOption} style={{ height: 46 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
                </div>
              </div>
              <Divider className="!my-3" />
              <div>
                <span>日访问量 1,234</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6} className="flex">
          <Card
            className="w-full [&_.ant-card-body]:!flex [&_.ant-card-body]:!min-h-[188px] [&_.ant-card-body]:!flex-col [&_.ant-card-body]:!px-5 [&_.ant-card-body]:!py-[18px] [&_.ant-card-head]:!px-5 [&_.ant-statistic-title]:!text-[var(--text-secondary)]"
            variant="borderless"
            title="支付笔数"
          >
            <div className="flex flex-grow flex-col">
              <div className={'flex-grow flex flex-col justify-between'}>
                <Statistic value={6560} />
                <div>
                  <ReactECharts option={tinyBarOption} style={{ height: 46 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
                </div>
              </div>
              <Divider className="!my-3" />
              <div>
                <span>转化率 13.4%</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6} className="flex">
          <Card
            className="w-full [&_.ant-card-body]:!flex [&_.ant-card-body]:!min-h-[188px] [&_.ant-card-body]:!flex-col [&_.ant-card-body]:!px-5 [&_.ant-card-body]:!py-[18px] [&_.ant-card-head]:!px-5 [&_.ant-statistic-title]:!text-[var(--text-secondary)]"
            variant="borderless"
            title="运营活动效果"
          >
            <div className="flex flex-grow flex-col">
              <div className={'flex-grow flex flex-col justify-between'}>
                <Statistic value={metrics.healthScore} suffix="%" />
                <div>
                  <div className="flex w-full items-center gap-2.5">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full"
                      style={{ background: token.colorFillSecondary }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${token.colorPrimary}, ${token.colorSuccess})`,
                          width: `${metrics.healthScore}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm" style={{ color: mutedText }}>
                      {metrics.healthScore}%
                    </span>
                  </div>
                </div>
              </div>
              <Divider className="!my-3" />
              <div>
                <span>目标达成率稳定上升</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className="[&_.ant-card-head]:border-b [&_.ant-card-head]:border-[var(--border-muted)]"
        variant="borderless"
        tabList={[
          { key: 'sales', tab: '销售额' },
          { key: 'views', tab: '访问量' },
        ]}
        activeTabKey={activeChartTab}
        onTabChange={(key) => setActiveChartTab(key as 'sales' | 'views')}
        tabBarExtraContent={
          <Space className="hidden lg:inline-flex" size={8}>
            <Button
              type="text"
              style={{ color: activeTime === 'today' ? accentText : mutedText }}
              onClick={() => setActiveTime('today')}
            >
              今日
            </Button>
            <Button
              type="text"
              style={{ color: activeTime === 'week' ? accentText : mutedText }}
              onClick={() => setActiveTime('week')}
            >
              本周
            </Button>
            <Button
              type="text"
              style={{ color: activeTime === 'month' ? accentText : mutedText }}
              onClick={() => setActiveTime('month')}
            >
              本月
            </Button>
            <Button
              type="text"
              style={{ color: activeTime === 'year' ? accentText : mutedText }}
              onClick={() => setActiveTime('year')}
            >
              本年
            </Button>
            <DatePicker.RangePicker variant={'filled'} value={[dayjs().subtract(6, 'day'), dayjs()]} />
          </Space>
        }
      >
        <Row gutter={[48, 16]}>
          <Col xs={24} lg={16}>
            <ReactECharts option={salesOption} style={{ height: 300 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
          </Col>
          <Col xs={24} lg={8}>
            <Typography.Title level={5}>
              {activeChartTab === 'sales' ? '门店销售额排名' : '门店访问量排名'}
            </Typography.Title>
            <ul className="mt-2.5 list-none p-0">
              {rankingStores.map((item) => (
                <li key={item.rank} className="mt-4 flex items-center gap-2" style={{ color: token.colorText }}>
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
                    style={
                      item.rank <= 3
                        ? { background: rankTopBg, color: rankTopText }
                        : { background: rankOtherBg, color: rankOtherText }
                    }
                  >
                    {item.rank}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.name}
                  </span>
                  <span>
                    {(activeChartTab === 'sales'
                      ? item.total
                      : Math.round(item.total * 0.9)
                    ).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 16]}>
        <Col xs={24} xl={12}>
          <Card title="线上热门搜索" variant="borderless">
            <Row gutter={[24, 16]}>
              <Col span={12}>
                <Statistic title="搜索用户数" value={12321} />
                <ReactECharts option={onlineAreaOption} style={{ height: 48 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
              </Col>
              <Col span={12}>
                <Statistic title="人均搜索次数" value={2.7} />
                <ReactECharts option={onlineAreaOption} style={{ height: 48 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
              </Col>
            </Row>
            <Table
              className="mt-6"
              size="small"
              rowKey="key"
              pagination={pagination}
              dataSource={searchData}
              scroll={{ x: 412 }}
              columns={[
                { title: '排名', dataIndex: 'key', key: 'key', width: 72 },
                { title: '搜索关键词', dataIndex: 'keyword', key: 'keyword', width: 120 },
                { title: '用户数', dataIndex: 'count', key: 'count', width: 100 },
                {
                  title: '周涨幅',
                  dataIndex: 'range',
                  key: 'range',
                  width: 120,
                  render: (value: number, row: { down: boolean }) => (
                    <span style={{ color: row.down ? trendDownColor : trendUpColor }}>
                      {row.down ? <ArrowDownOutlined /> : <ArrowUpOutlined />} {value}%
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="销售额类别占比"
            variant="borderless"
            extra={
              <Segmented
                value={salesType}
                onChange={(value) => setSalesType(value as SalesType)}
                options={[
                  { label: '全部渠道', value: 'all' },
                  { label: '线上', value: 'online' },
                  { label: '门店', value: 'stores' },
                ]}
              />
            }
          >
            <ReactECharts option={proportionOption} style={{ height: 340 }} theme={resolvedTheme === 'dark' ? 'dark' : undefined} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
