import React from 'react'
import type { RevenueReport } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, rstest } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { renderInLocale } from '../../test/render-in-locale'
import { DashboardPage } from './dashboard-page'
import * as reportingApi from '../../services/reporting/api'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const report: RevenueReport = {
  comparison: {
    endDate: '2026-06-30',
    metrics: {
      averageOrderValue: 1_000,
      grossSales: 2_000,
      netSales: 1_900,
      orderCount: 2,
      refundTotal: 100,
    },
    startDate: '2026-06-01',
  },
  currency: 'USD',
  current: {
    endDate: '2026-07-30',
    metrics: {
      averageOrderValue: 1_750,
      grossSales: 3_500,
      netSales: 2_000,
      orderCount: 2,
      refundTotal: 1_500,
    },
    series: [
      {
        date: '2026-07-30',
        grossSales: 3_500,
        netSales: 2_000,
        orderCount: 2,
        refundTotal: 1_500,
      },
    ],
    startDate: '2026-07-01',
  },
  definitions: {
    grossSales: 'Paid orders recognized once.',
    refundTotal: 'Successful refunds at completion.',
  },
  timeZone: 'America/New_York',
}

const server = setupServer(
  http.get('*/admin/reporting/revenue', () => HttpResponse.json({ data: report }))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  rstest.unstubAllEnvs()
  rstest.restoreAllMocks()
})
afterAll(() => server.close())

describe('DashboardPage', () => {
  it.each(['development', 'production'])(
    'queries real reports for retired preview links in %s',
    async (environment) => {
      rstest.stubEnv('NODE_ENV', environment)
      let requests = 0
      server.use(
        http.get('*/admin/reporting/revenue', () => {
          requests += 1
          return HttpResponse.json({ data: report })
        })
      )
      renderInLocale(
        <MemoryRouter initialEntries={['/dashboard?preview=metric-states']}>
          <DashboardPage />
        </MemoryRouter>
      )
      expect(await screen.findByText('35.00')).toBeTruthy()
      expect(screen.queryByText('250.00')).toBeNull()
      expect(screen.queryByText(/Demo data/)).toBeNull()
      expect(screen.getByRole('button', { name: 'View underlying orders' })).toBeTruthy()
      expect(requests).toBe(1)
    }
  )

  it('should show absolute changes without repeated reporting summaries', async () => {
    renderInLocale(
      <ThemeProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    )

    await screen.findByText('Gross sales ($)')
    expect(screen.queryByText('Reporting basis:')).toBeNull()
    expect(screen.queryByText('Metric definitions')).toBeNull()
    expect(screen.getByText('Gross sales ($)')).toBeTruthy()
    expect(screen.getByText('Refunds ($)')).toBeTruthy()
    expect(screen.getByText('Net sales ($)')).toBeTruthy()
    expect(screen.getAllByText('Paid orders').length).toBeGreaterThan(0)
    expect(screen.getByText('Average order value ($)')).toBeTruthy()
    const grossCard = screen.getByText('Gross sales ($)').closest('.ant-card')!
    expect(grossCard.querySelector('p')?.textContent?.trim()).toBe('15.00')
    expect(grossCard.querySelector('p svg')?.getAttribute('data-icon')).toBe('arrow-up')
    expect(grossCard.querySelector('p [role="img"]')?.getAttribute('aria-label')).toBe('Increase')
    expect(screen.getByText('14.00')).toBeTruthy()
    expect(screen.getByText('1.00')).toBeTruthy()
    expect(screen.getByText('7.50')).toBeTruthy()
    expect(screen.queryByText('No change')).toBeNull()
    expect(screen.queryByText('vs. previous period')).toBeNull()
    expect(
      screen.getAllByText('Paid orders')[0]?.closest('.ant-card')?.querySelector('p')
    ).toBeNull()
    expect(screen.queryByText(/Previous 2026-06-01/)).toBeNull()
    expect(screen.getAllByText('$35.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0)
    expect(screen.getByText('17.50')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View underlying orders' })).toBeTruthy()
  })

  it('should explain metrics in Chinese on hover and focus, without exposing API copy', async () => {
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      'zh-CN'
    )
    const help = await screen.findByRole('button', { name: '平均客单价说明' })
    expect(screen.queryByText('grossSales')).toBeNull()
    expect(screen.queryByText('Paid orders recognized once.')).toBeNull()
    fireEvent.mouseEnter(help)
    expect((await screen.findByRole('tooltip')).textContent).toContain('销售总额除以已支付订单数')
    fireEvent.mouseLeave(help)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    fireEvent.focus(screen.getByRole('button', { name: '退款说明' }))
    expect((await screen.findByRole('tooltip')).textContent).toContain('退款成功时间')
    expect(screen.getByText('销售总额 (US$)')).toBeTruthy()
    expect(screen.getByText('35.00')).toBeTruthy()
    expect(screen.queryByText('持平')).toBeNull()
    expect(screen.queryByText('较上一周期')).toBeNull()
  })

  it('should show decreases and zero-baseline increases without percentages', async () => {
    server.use(
      http.get('*/admin/reporting/revenue', () =>
        HttpResponse.json({
          data: {
            ...report,
            currency: 'JPY',
            comparison: {
              ...report.comparison,
              metrics: { ...report.comparison.metrics, averageOrderValue: 0 },
            },
            current: {
              ...report.current,
              metrics: { ...report.current.metrics, netSales: -100, orderCount: 0 },
            },
          },
        })
      )
    )
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    const netCard = (await screen.findByText('Net sales (¥)')).closest('.ant-card')!
    expect(netCard.querySelector('.ant-statistic-content')?.textContent).toBe('-100')
    expect(netCard.querySelector('p')?.textContent?.trim()).toBe('2,000')
    expect(netCard.querySelector('p svg')?.getAttribute('data-icon')).toBe('arrow-down')
    expect(netCard.querySelector('p [role="img"]')?.getAttribute('aria-label')).toBe('Decrease')
    expect(
      screen
        .getAllByText('Paid orders')[0]
        ?.closest('.ant-card')
        ?.querySelector('p')
        ?.textContent?.trim()
    ).toBe('2')
    expect(screen.getAllByText('1,750').length).toBeGreaterThan(0)
    expect(screen.queryByText(/NaN|Infinity|%/)).toBeNull()
  })

  it('should query immediately when filters change and skip an empty range', async () => {
    const requests: string[] = []
    server.use(
      http.get('*/admin/reporting/revenue', ({ request }) => {
        requests.push(request.url)
        return HttpResponse.json({ data: report })
      })
    )
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    await screen.findByText('Gross sales ($)')
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
    expect(new URL(requests[0]!).searchParams.get('currency')).toBe('CNY')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Currency' }))
    fireEvent.click(await screen.findByText('EUR', { selector: '.ant-select-item-option-content' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(new URL(requests[1]!).searchParams.get('currency')).toBe('EUR')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Time zone' }))
    fireEvent.click(
      await screen.findByText('Europe/London', { selector: '.ant-select-item-option-content' })
    )
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(new URL(requests[2]!).searchParams.get('timeZone')).toBe('Europe/London')
    expect(screen.getByText('Date range')).toBeTruthy()
    expect(screen.getByLabelText('Start date').closest('.ant-picker-range')).toBe(
      screen.getByLabelText('End date').closest('.ant-picker-range')
    )
    fireEvent.focus(screen.getByLabelText('Start date'))
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-01' } })
    fireEvent.keyDown(screen.getByLabelText('Start date'), { key: 'Enter', code: 'Enter' })
    fireEvent.focus(screen.getByLabelText('End date'))
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-30' } })
    fireEvent.keyDown(screen.getByLabelText('End date'), { key: 'Enter', code: 'Enter' })
    fireEvent.blur(screen.getByLabelText('End date'))
    await waitFor(() => expect(requests).toHaveLength(4))
    expect(new URL(requests[3]!).searchParams.get('startDate')).toBe('2026-07-01')
    expect(new URL(requests[3]!).searchParams.get('endDate')).toBe('2026-07-30')
    expect(screen.queryByText('Filters changed. Apply to update results.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByText('Select a start and end date.')).toBeTruthy()
    expect(requests).toHaveLength(4)
    expect(screen.queryByText('Gross sales ($)')).toBeNull()
  })

  it('should discard the old report on query failure and allow retry', async () => {
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    await screen.findByText('Gross sales ($)')
    server.use(http.get('*/admin/reporting/revenue', () => new HttpResponse(null, { status: 500 })))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Currency' }))
    fireEvent.click(await screen.findByText('EUR', { selector: '.ant-select-item-option-content' }))
    await screen.findByText('Reporting data is unavailable.')
    expect(screen.queryByText('Gross sales ($)')).toBeNull()
    server.resetHandlers()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Gross sales ($)')).toBeTruthy()
  })

  it('ignores a slow response for a previous filter selection', async () => {
    let finishOld!: (value: RevenueReport) => void
    const oldRequest = new Promise<RevenueReport>((resolve) => {
      finishOld = resolve
    })
    const fetch = rstest
      .spyOn(reportingApi, 'fetchRevenueReport')
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce({ ...report, currency: 'EUR' })
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Currency' }))
    fireEvent.click(await screen.findByText('EUR', { selector: '.ant-select-item-option-content' }))
    await screen.findByText('Gross sales (€)')
    await act(async () => {
      finishOld(report)
      await oldRequest
    })
    expect(screen.getByText('Gross sales (€)')).toBeTruthy()
    expect(screen.queryByText('Gross sales ($)')).toBeNull()
  })

  it('searches additional currency codes and queries the selected currency immediately', async () => {
    const requests: string[] = []
    server.use(
      http.get('*/admin/reporting/revenue', ({ request }) => {
        const currency = new URL(request.url).searchParams.get('currency')!
        requests.push(currency)
        return HttpResponse.json({ data: { ...report, currency } })
      })
    )
    renderInLocale(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    await screen.findByText('Gross sales (CN¥)')
    const currencyInput = screen.getByRole('combobox', { name: 'Currency' })
    expect(currencyInput.getAttribute('readonly')).toBeNull()
    fireEvent.change(currencyInput, { target: { value: 'twd' } })
    fireEvent.click(await screen.findByText('TWD', { selector: '.ant-select-item-option-content' }))
    await screen.findByText('Gross sales (NT$)')
    expect(requests).toEqual(['CNY', 'TWD'])
    fireEvent.change(currencyInput, { target: { value: 'chf' } })
    fireEvent.click(await screen.findByText('CHF', { selector: '.ant-select-item-option-content' }))
    await screen.findByText('Gross sales (CHF)')
    expect(requests).toEqual(['CNY', 'TWD', 'CHF'])
  })
})
