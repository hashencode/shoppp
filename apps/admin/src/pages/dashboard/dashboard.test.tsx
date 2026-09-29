import React from 'react'
import type { AdminSession, RevenueReport, TrafficReport } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { renderInLocale } from '../../test/render-in-locale'
import { DashboardPage } from './dashboard-page'
import * as timeZones from '../../shared/utils/time-zones'
import * as reportingApi from '../../services/reporting/api'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { revenueFixture, trafficFixture, productsFixture } from './dashboard-test-data'
import { authContextFixture } from '../../test/auth-context-fixture'

void React
if (!window.matchMedia)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  })
if (!window.ResizeObserver)
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

rstest.mock('echarts-for-react', () => ({
  default: ({ option }: { option: unknown }) => (
    <div data-testid="chart-option">{JSON.stringify(option)}</div>
  ),
}))

const sessionFixture = (environment: 'test' | 'production', identityId: string): AdminSession => ({
  displayName: 'Dashboard operator',
  email: 'operator@example.test',
  environment,
  identityId,
  permissions: ['reporting.read'],
  principalKind: 'human',
  role: {
    enabled: true,
    id: 'role-operator',
    key: 'operator',
    name: 'Operator',
    protected: false,
    system: false,
    version: 1,
  },
})
const LocationProbe = () => {
  const location = useLocation()
  return (
    <output aria-label="location">
      {location.pathname}
      {location.search}
    </output>
  )
}
const renderDashboard = () =>
  renderInLocale(
    <MemoryRouter>
      <DashboardPage />
      <LocationProbe />
    </MemoryRouter>
  )
const select = async (name: string, value: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name }))
  fireEvent.click(await screen.findByText(value, { selector: '.ant-select-item-option-content' }))
}
const metric = (name: string) =>
  screen.getByText(name, { selector: 'span' }).closest('.ant-card') as HTMLElement
beforeEach(() => {
  rstest
    .spyOn(reportingApi, 'fetchRevenueReport')
    .mockImplementation(async (query) => revenueFixture(query))
  rstest
    .spyOn(reportingApi, 'fetchTrafficReport')
    .mockImplementation(async (query) => trafficFixture(query))
  rstest
    .spyOn(reportingApi, 'fetchProductSalesReport')
    .mockImplementation(async (query) => productsFixture(query))
})
afterEach(() => {
  window.localStorage.clear()
  rstest.restoreAllMocks()
})

describe('Commerce dashboard', () => {
  it('renders four real metrics, separates UV from PV and preserves current/archived product links', async () => {
    renderDashboard()
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(document.querySelectorAll('[data-metric]')).toHaveLength(4)
    expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('1')
    const uv = within(metric('Unique visitors')).getByTestId('chart-option').textContent!
    expect(JSON.parse(uv).series[0].data).toEqual([1, 1])
    expect(within(metric('Gross sales')).getByText(/75%/)).toBeTruthy()
    expect(within(metric('Net sales')).getByText(/Percentage unavailable/)).toBeTruthy()
    expect(screen.queryByText('Average order value')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Query' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Product A' }).getAttribute('href')).toBe(
      'https://store.example.com/products/a'
    )
    expect(screen.getByText('Archived product B').closest('a')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Page views' }))
    const chart = screen.getByRole('img', { name: 'Daily page views' })
    expect(
      JSON.parse(within(chart).getByTestId('chart-option').textContent!).series[0].data
    ).toEqual([5, 1])
    expect(screen.getByText('4', { selector: 'li span' })).toBeTruthy()
    expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(1)
  })
  it('uses browser timezone fallback and keeps currency visible through financial failures, without reloading traffic', async () => {
    rstest.spyOn(timeZones, 'resolveDefaultTimeZone').mockImplementation(() => {
      throw new Error('unavailable')
    })
    rstest.mocked(reportingApi.fetchRevenueReport).mockRejectedValueOnce(new Error('offline'))
    renderDashboard()
    await screen.findAllByText('Reporting data is unavailable.')
    expect(rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[0]![0].timeZone).toBe('UTC')
    expect(screen.getByRole('combobox', { name: 'Currency' }).closest('.ant-card')).toBe(
      metric('Gross sales')
    )
    expect(within(metric('Gross sales')).queryByTestId('metric-value')).toBeNull()
    expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('1')
    await select('Currency', 'JPY')
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(within(metric('Gross sales')).getByTestId('metric-value').textContent).toBe('¥3,500')
    expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(1)
    expect(rstest.mocked(reportingApi.fetchProductSalesReport).mock.calls.at(-1)![0].currency).toBe(
      'JPY'
    )
  })
  it('remembers currency only for the authenticated identity and environment', async () => {
    window.localStorage.setItem('shoppp.dashboard.currency:test:a', 'EUR')
    window.localStorage.setItem('shoppp.dashboard.currency:production:a', 'USD')
    const auth = authContextFixture({ session: sessionFixture('test', 'a') })
    renderInLocale(
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[0]![0].currency).toBe('EUR')
    await select('Currency', 'GBP')
    expect(window.localStorage.getItem('shoppp.dashboard.currency:test:a')).toBe('GBP')
    expect(window.localStorage.getItem('shoppp.dashboard.currency:production:a')).toBe('USD')
  })
  it('reloads identity-scoped currency and discards pending results when the mounted session changes', async () => {
    let resolveOld!: (report: RevenueReport) => void
    rstest.mocked(reportingApi.fetchRevenueReport).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    window.localStorage.setItem('shoppp.dashboard.currency:test:a', 'EUR')
    window.localStorage.setItem('shoppp.dashboard.currency:production:b', 'KWD')
    const SessionFixture = () => {
      const [changed, setChanged] = React.useState(false)
      const auth = authContextFixture({
        session: sessionFixture(changed ? 'production' : 'test', changed ? 'b' : 'a'),
      })
      return (
        <AuthContext.Provider value={auth}>
          <MemoryRouter>
            <button onClick={() => setChanged(true)}>Switch session</button>
            <DashboardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      )
    }
    renderInLocale(<SessionFixture />)
    await waitFor(() => expect(reportingApi.fetchRevenueReport).toHaveBeenCalledTimes(1))
    const old = rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[0]![0]
    fireEvent.click(screen.getByRole('button', { name: 'Switch session' }))
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[1]![0].currency).toBe('KWD')
    expect(within(metric('Gross sales')).getByTestId('metric-value').textContent).toContain('3.500')
    await act(async () => resolveOld(revenueFixture(old)))
    expect(within(metric('Gross sales')).getByTestId('metric-value').textContent).toContain('KWD')
    expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(2)
    expect(window.localStorage.getItem('shoppp.dashboard.currency:test:a')).toBe('EUR')
  })
  it('keeps sales available when only the product ranking fails', async () => {
    rstest.mocked(reportingApi.fetchProductSalesReport).mockRejectedValueOnce(new Error('offline'))
    renderDashboard()
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(within(metric('Gross sales')).getByTestId('metric-value').textContent).toBe('CN¥35.00')
    expect(screen.getByText('Reporting data is unavailable.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('link', { name: 'Product A' })
    expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(1)
  })
  it('automatically submits a preset once for all modules and keeps late responses out of the snapshot', async () => {
    let resolveOld!: (report: RevenueReport) => void
    rstest.mocked(reportingApi.fetchRevenueReport).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    renderDashboard()
    await waitFor(() => expect(reportingApi.fetchRevenueReport).toHaveBeenCalledTimes(1))
    const old = rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[0]![0]
    await select('Date preset', 'Last 7 days')
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(reportingApi.fetchRevenueReport).toHaveBeenCalledTimes(2)
    expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(2)
    expect(reportingApi.fetchProductSalesReport).toHaveBeenCalledTimes(2)
    await act(async () =>
      resolveOld({
        ...revenueFixture(old),
        current: {
          ...revenueFixture(old).current,
          metrics: { ...revenueFixture(old).current.metrics, grossSales: 999999 },
        },
      })
    )
    expect(within(metric('Gross sales')).getByTestId('metric-value').textContent).toBe('CN¥35.00')
    fireEvent.click(screen.getByRole('button', { name: 'View underlying orders' }))
    const url = new URL(screen.getByLabelText('location').textContent!, 'https://admin.test')
    expect(url.searchParams.get('startDate')).toBe(
      rstest.mocked(reportingApi.fetchRevenueReport).mock.calls[1]![0].startDate
    )
    expect(url.searchParams.get('startDate')).not.toBe(old.startDate)
  })
  for (const outcome of ['resolve', 'reject'] as const) {
    it(`ignores an old traffic ${outcome} after a newer date range has loaded`, async () => {
      let resolveOld!: (report: TrafficReport) => void
      let rejectOld!: (reason: Error) => void
      rstest.mocked(reportingApi.fetchTrafficReport).mockReturnValueOnce(
        new Promise((resolve, reject) => {
          resolveOld = resolve
          rejectOld = reject
        })
      )
      renderDashboard()
      await waitFor(() => expect(reportingApi.fetchTrafficReport).toHaveBeenCalledTimes(1))
      const old = rstest.mocked(reportingApi.fetchTrafficReport).mock.calls[0]![0]
      await select('Date preset', 'Last 7 days')
      await waitFor(() =>
        expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('1')
      )
      fireEvent.click(screen.getByRole('tab', { name: 'Page views' }))
      await act(async () => {
        if (outcome === 'reject') rejectOld(new Error('late failure'))
        else
          resolveOld({
            ...trafficFixture(old),
            uniqueVisitors: 999,
            pageViews: 999,
            products: [],
            series: [],
          })
      })
      expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('1')
      expect(screen.getByRole('link', { name: 'Product A' })).toBeTruthy()
      expect(screen.getByRole('img', { name: 'Daily page views' }).textContent).toContain('[5,1]')
      expect(screen.queryByText('Reporting data is unavailable.')).toBeNull()
    })
  }
  it('shows a traffic error rather than a zero, retries its committed scope and keeps financial data', async () => {
    rstest.mocked(reportingApi.fetchTrafficReport).mockRejectedValueOnce(new Error('offline'))
    renderDashboard()
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(within(metric('Unique visitors')).queryByTestId('metric-value')).toBeNull()
    fireEvent.click(within(metric('Unique visitors')).getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('1')
    )
    expect(reportingApi.fetchRevenueReport).toHaveBeenCalledTimes(1)
    expect(rstest.mocked(reportingApi.fetchTrafficReport).mock.calls[0]).toEqual(
      rstest.mocked(reportingApi.fetchTrafficReport).mock.calls[1]
    )
  })
  it('shows a genuine empty result as zero and an empty ranking', async () => {
    rstest.mocked(reportingApi.fetchTrafficReport).mockImplementation(async (query) => ({
      ...trafficFixture(query),
      uniqueVisitors: 0,
      pageViews: 0,
      series: [],
      products: [],
    }))
    renderDashboard()
    await screen.findByRole('button', { name: 'View underlying orders' })
    expect(within(metric('Unique visitors')).getByTestId('metric-value').textContent).toBe('0')
    fireEvent.click(screen.getByRole('tab', { name: 'Page views' }))
    expect(screen.getByText('No product activity in this window.')).toBeTruthy()
  })
  it('localizes metric explanations and new analytics controls in Chinese', async () => {
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      'zh-CN'
    )
    await screen.findByRole('button', { name: '查看明细订单' })
    fireEvent.focus(screen.getByRole('button', { name: '独立访客说明' }))
    expect((await screen.findByRole('tooltip')).textContent).toContain('匿名浏览器')
    expect(screen.getByRole('tab', { name: '访问量' })).toBeTruthy()
  })
})
