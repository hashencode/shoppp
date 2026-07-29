import React from 'react'
import type { RevenueReport } from '@shoppp/contracts'
import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { DashboardPage } from './dashboard-page'

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
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('DashboardPage', () => {
  it('labels currency, IANA time zone, current window, and comparison window', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByText('Reporting basis:')).toBeTruthy())
    expect(screen.getByText('Reporting basis:').parentElement?.textContent).toContain(
      'USD · America/New_York · 2026-07-01–2026-07-30'
    )
    expect(screen.getByText('Gross sales')).toBeTruthy()
    expect(screen.getByText('Refunds')).toBeTruthy()
    expect(screen.getByText('Net sales')).toBeTruthy()
    expect(screen.getAllByText('Paid orders').length).toBeGreaterThan(0)
    expect(screen.getByText('Average order value')).toBeTruthy()
    expect(screen.getAllByText(/Previous 2026-06-01–2026-06-30:/)).toHaveLength(5)
    expect(screen.getAllByText('$35.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0)
    expect(screen.getByText('$17.50')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View underlying orders' })).toBeTruthy()
  })
})
