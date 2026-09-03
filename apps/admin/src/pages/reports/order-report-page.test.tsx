import React from 'react'
import type { AdminPermission, ReportExport, ReportOrderRow } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { useI18n } from '../../shared/contexts/i18n-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { OrderReportPage } from './order-report-page'

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

const order: ReportOrderRow = {
  createdAt: '2026-07-30T00:00:00.000Z',
  currency: 'USD',
  email: 'shopper@example.test',
  fulfillmentStatus: 'unfulfilled',
  grossContribution: 2_500,
  netContribution: 2_000,
  orderStatus: 'confirmed',
  paymentStatus: 'partially_refunded',
  publicReference: 'ORD-REPORT01',
  refundContribution: 500,
}
const readyExport: ReportExport = {
  createdAt: '2026-07-30T01:00:00.000Z',
  currency: 'USD',
  endDate: '2026-07-30',
  expiresAt: '2026-07-31T01:00:00.000Z',
  id: 'rex_test_001',
  rowCount: 1,
  startDate: '2026-07-01',
  status: 'ready',
  timeZone: 'UTC',
}

let exportBody: unknown
let exportIdempotencyKey: string | null
let orderQueries: Record<string, string>[] = []
const server = setupServer(
  http.get('*/admin/reporting/orders', ({ request }) => {
    orderQueries.push(Object.fromEntries(new URL(request.url).searchParams))
    return HttpResponse.json({ data: [order], meta: { page: 1, pageSize: 20, total: 1 } })
  }),
  http.post('*/admin/reporting/exports', async ({ request }) => {
    exportBody = await request.json()
    exportIdempotencyKey = request.headers.get('Idempotency-Key')
    return HttpResponse.json({ data: readyExport }, { status: 202 })
  })
)

const LocaleSwitch = () => {
  const { locale, setLocale } = useI18n()
  return (
    <button onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}>
      Switch language
    </button>
  )
}

const renderPage = (permissions: readonly AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider role="reporting_operator" permissions={permissions}>
      <ThemeProvider>
        <LocaleSwitch />
        <OrderReportPage />
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  exportBody = undefined
  exportIdempotencyKey = null
  orderQueries = []
  window.history.replaceState(null, '', '/')
  server.resetHandlers()
})
afterAll(() => server.close())

describe('OrderReportPage', () => {
  it('keeps UTC timestamps across the local date boundary and language changes without reloading', async () => {
    server.use(
      http.get('*/admin/reporting/orders', ({ request }) => {
        orderQueries.push(Object.fromEntries(new URL(request.url).searchParams))
        return HttpResponse.json({
          data: [
            { ...order, createdAt: '2026-09-03T00:00:00.000Z' },
            { ...order, publicReference: 'ORD-BOUNDARY', createdAt: '2026-09-03T23:30:00.000Z' },
          ],
          meta: { page: 1, pageSize: 20, total: 2 },
        })
      })
    )
    renderPage(['reporting.read'])
    await screen.findByText('ORD-BOUNDARY')
    expect(screen.getByText('2026-09-03 00:00')).toBeTruthy()
    expect(screen.getByText('2026-09-03 23:30')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Created (UTC)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(screen.getByRole('columnheader', { name: '创建时间（UTC）' })).toBeTruthy()
    expect(screen.getByText('2026-09-03 00:00')).toBeTruthy()
    expect(screen.getByText('2026-09-03 23:30')).toBeTruthy()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(orderQueries).toHaveLength(1)
  })

  it('shows reconcilable rows while hiding export from a read-only operator', async () => {
    renderPage(['reporting.read'])
    await waitFor(() => expect(screen.getByText('ORD-REPORT01')).toBeTruthy())
    expect(screen.getByText('shopper@example.test')).toBeTruthy()
    expect(screen.getByText('$25.00')).toBeTruthy()
    expect(screen.getByText('$5.00')).toBeTruthy()
    expect(screen.getByText('$20.00')).toBeTruthy()
    expect(screen.queryByText(/Reporting basis:/)).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Report currency' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Report time zone' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  })

  it('requires a reason and explicit confirmation before creating an audited export', async () => {
    window.history.replaceState(
      null,
      '',
      '/reports/orders?currency=USD&startDate=2026-09-01&endDate=2026-09-03&timeZone=America%2FNew_York'
    )
    renderPage(['reporting.read', 'reporting.export'])
    await screen.findByText('ORD-REPORT01')
    expect(orderQueries).toEqual([
      {
        currency: 'USD',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        timeZone: 'America/New_York',
        page: '1',
        pageSize: '20',
      },
    ])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search report orders' }), {
      target: { value: '  ORD-REPORT01  ' },
    })
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search report orders' }), {
      key: 'Enter',
      code: 'Enter',
    })
    await waitFor(() => expect(orderQueries).toHaveLength(2))
    expect(orderQueries[1]).toEqual({ ...orderQueries[0], query: 'ORD-REPORT01' })
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(
      screen.getByText(
        'The CSV contains customer email addresses. Access is audited and expires after 24 hours.'
      )
    ).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Export reason' }), {
      target: { value: 'Month-end reconciliation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm export' }))

    await waitFor(() =>
      expect(exportBody).toEqual({
        confirm: true,
        currency: 'USD',
        reason: 'Month-end reconciliation',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        timeZone: 'America/New_York',
        query: 'ORD-REPORT01',
      })
    )
    expect(exportIdempotencyKey).toMatch(/^report-export-/)
    await waitFor(() => expect(screen.getByText('Download export (1 rows)')).toBeTruthy())
  })
})
