import React, { useEffect } from 'react'
import type { ReportExport, ReportOrderRow } from '@shoppp/contracts'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../../infrastructure/auth/auth-context'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import type { Role } from '../../shared/types/roles'
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
const server = setupServer(
  http.get('*/admin/reporting/orders', () =>
    HttpResponse.json({ data: [order], meta: { page: 1, pageSize: 20, total: 1 } })
  ),
  http.post('*/admin/reporting/exports', async ({ request }) => {
    exportBody = await request.json()
    exportIdempotencyKey = request.headers.get('Idempotency-Key')
    return HttpResponse.json({ data: readyExport }, { status: 202 })
  })
)

const SetRole = ({ role }: { role: Role }) => {
  const auth = useAuth()
  useEffect(() => auth.setRole(role), [auth, role])
  return null
}

const renderPage = (role: Role) =>
  render(
    <AuthProvider>
      <SetRole role={role} />
      <ThemeProvider>
        <OrderReportPage />
      </ThemeProvider>
    </AuthProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  exportBody = undefined
  exportIdempotencyKey = null
  server.resetHandlers()
})
afterAll(() => server.close())

describe('OrderReportPage', () => {
  it('shows reconcilable rows while hiding export from a read-only operator', async () => {
    renderPage('viewer')
    await waitFor(() => expect(screen.getByText('ORD-REPORT01')).toBeTruthy())
    expect(screen.getByText('shopper@example.test')).toBeTruthy()
    expect(screen.getByText('$25.00')).toBeTruthy()
    expect(screen.getByText('$5.00')).toBeTruthy()
    expect(screen.getByText('$20.00')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
  })

  it('requires a reason and explicit confirmation before creating an audited export', async () => {
    renderPage('editor')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy())
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
      expect(exportBody).toMatchObject({
        confirm: true,
        currency: 'USD',
        reason: 'Month-end reconciliation',
      })
    )
    expect(exportIdempotencyKey).toMatch(/^report-export-/)
    await waitFor(() => expect(screen.getByText('Download export (1 rows)')).toBeTruthy())
  })
})
