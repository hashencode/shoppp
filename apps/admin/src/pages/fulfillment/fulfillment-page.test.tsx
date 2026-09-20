import type { AdminOrder } from '@shoppp/contracts'
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { FulfillmentPage } from './fulfillment-page'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const fulfillmentOrder: AdminOrder = {
  createdAt: '2026-09-20T00:00:00.000Z',
  currency: 'USD',
  email: 'shopper@example.test',
  fulfillmentStatus: 'unfulfilled',
  grandTotal: 2500,
  orderStatus: 'confirmed',
  paymentStatus: 'paid',
  publicReference: 'ORD-FULFILL',
}

const server = setupServer(
  http.get('*/admin/orders', () =>
    HttpResponse.json({
      data: [fulfillmentOrder],
      meta: { page: 1, pageSize: 100, total: 1 },
    })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('FulfillmentPage', () => {
  it('uses the first-level recipe heading and preserves order navigation', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['orders.read']} role="order_operator">
        <ThemeProvider>
          <MemoryRouter initialEntries={['/fulfillment']}>
            <Routes>
              <Route path="/fulfillment" element={<FulfillmentPage />} />
              <Route path="/orders/:reference" element={<div>Order detail</div>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )

    expect(screen.getByRole('heading', { level: 4, name: 'Fulfillment' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.queryByText('Paid orders waiting for the next warehouse transition.')).toBeNull()
    expect(await screen.findByText('ORD-FULFILL')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Order detail')).toBeTruthy()
  })
})
