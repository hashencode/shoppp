import React from 'react'
import type { AdminOrderDetail, AdminPermission } from '@shoppp/contracts'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { OrderDetailPage } from './order-detail'

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

const detail: AdminOrderDetail = {
  allowedActions: {
    cancel: true,
    fulfill: ['picking'],
    refundMaximum: 2500,
  },
  facts: {
    createdAt: '2026-07-30T00:00:00.000Z',
    currency: 'USD',
    email: 'shopper@example.test',
    fulfillmentStatus: 'unfulfilled',
    lines: [
      {
        currency: 'USD',
        discountAmount: 0,
        lineTotalAmount: 2500,
        productName: 'Atlas Carry-on',
        quantity: 1,
        sku: 'ATLAS-BLK',
        taxAmount: 0,
        unitPriceAmount: 2500,
        variantName: 'Black',
      },
    ],
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    publicReference: 'ORD-TEST001',
    shippingAddress: {
      city: 'Portland',
      countryCode: 'US',
      line1: '100 Market Street',
      name: 'Example Shopper',
      postalCode: '97205',
      region: 'OR',
    },
    totals: {
      discountTotal: 0,
      grandTotal: 2500,
      shippingTotal: 0,
      subtotal: 2500,
      taxTotal: 0,
    },
  },
  timeline: [
    {
      createdAt: '2026-07-30T00:00:00.000Z',
      id: 'notify_1',
      kind: 'notification',
      label: 'order_receipt',
      status: 'pending',
    },
  ],
}

let refundBody: unknown
const server = setupServer(
  http.get('*/admin/orders/ORD-TEST001', () => HttpResponse.json({ data: detail })),
  http.post('*/admin/orders/ORD-TEST001/refunds', async ({ request }) => {
    refundBody = await request.json()
    return HttpResponse.json({
      data: {
        ...detail,
        facts: { ...detail.facts, paymentStatus: 'partially_refunded' },
      },
    })
  })
)

const renderPage = (permissions: readonly AdminPermission[]) =>
  render(
    <AuthTestProvider role="order_operator" permissions={permissions}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/orders/ORD-TEST001']}>
          <Routes>
            <Route path="/orders/:reference" element={<OrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  refundBody = undefined
  server.resetHandlers()
})
afterAll(() => server.close())

describe('OrderDetailPage', () => {
  it('shows immutable facts and a unified timeline without mutation controls for viewers', async () => {
    renderPage(['orders.read'])

    await waitFor(() => expect(screen.getByRole('heading', { name: 'ORD-TEST001' })).toBeTruthy())
    expect(screen.getByText('Atlas Carry-on')).toBeTruthy()
    expect(screen.getByText('order_receipt')).toBeTruthy()
    expect(screen.getByText('Payment · paid')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Refund' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark picking' })).toBeNull()
  })

  it('requires explicit confirmation, amount, and reason before an authorized refund', async () => {
    renderPage(['orders.read', 'orders.refund'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refund' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    expect(
      screen.getByText('This action is audited and cannot be silently reversed.')
    ).toBeTruthy()
    fireEvent.change(screen.getByRole('spinbutton', { name: /Amount in minor units/ }), {
      target: { value: '500' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Customer service adjustment' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm operation' }))

    await waitFor(() =>
      expect(refundBody).toEqual({
        amount: 500,
        confirm: true,
        reason: 'Customer service adjustment',
      })
    )
    await waitFor(() => expect(screen.getByText('Payment · partially_refunded')).toBeTruthy())
  })
})
