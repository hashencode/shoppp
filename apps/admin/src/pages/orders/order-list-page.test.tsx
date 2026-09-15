import React from 'react'
import type { AdminOrder } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { useI18n } from '../../shared/contexts/i18n-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { OrderListPage } from './order-list-page'

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

const order: AdminOrder = {
  createdAt: '2026-09-15T01:00:00.000Z',
  currency: 'USD',
  email: 'shopper@example.test',
  fulfillmentStatus: 'unfulfilled',
  grandTotal: 2500,
  orderStatus: 'confirmed',
  paymentStatus: 'paid',
  publicReference: 'ORD-LIST01',
}

let orderQueries: Record<string, string>[] = []
let failOrders = false
let emptyOrders = false

const server = setupServer(
  http.get('*/admin/orders', ({ request }) => {
    orderQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (failOrders) {
      return HttpResponse.json(
        { error: { code: 'orders_unavailable', message: 'Orders are unavailable.' } },
        { status: 503 }
      )
    }
    const items = emptyOrders ? [] : [order]
    return HttpResponse.json({
      data: items,
      meta: {
        page: Number(new URL(request.url).searchParams.get('page') ?? 1),
        pageSize: 20,
        total: emptyOrders ? 0 : 40,
      },
    })
  })
)

const renderPage = () =>
  renderInLocale(
    <AuthTestProvider role="order_operator" permissions={['orders.read']}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/orders']}>
          <Routes>
            <Route path="/orders" element={<OrderListPage />} />
            <Route path="/orders/:reference" element={<div>Order destination</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>,
    'en-US'
  )

const LocaleSwitch = () => {
  const { setLocale } = useI18n()
  return <button onClick={() => setLocale('zh-CN')}>Switch language</button>
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  orderQueries = []
  failOrders = false
  emptyOrders = false
  server.resetHandlers()
  window.localStorage.clear()
})
afterAll(() => server.close())

describe('OrderListPage', () => {
  it('retranslates without refetching the committed order query', async () => {
    renderInLocale(
      <AuthTestProvider role="order_operator" permissions={['orders.read']}>
        <ThemeProvider>
          <LocaleSwitch />
          <MemoryRouter initialEntries={['/orders']}>
            <OrderListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>,
      'en-US'
    )

    await screen.findByText('ORD-LIST01')
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(orderQueries).toEqual([{ page: '1', pageSize: '20' }])
  })

  it('commits draft filters only on Search and restores the entry baseline on Reset', async () => {
    renderPage()

    await screen.findByText('ORD-LIST01')
    expect(orderQueries).toEqual([{ page: '1', pageSize: '20' }])

    fireEvent.change(screen.getByLabelText('Search orders'), {
      target: { value: ' ORD-2 ' },
    })
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter payment status' }))
    fireEvent.click((await screen.findAllByText('paid')).at(-1)!)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter fulfillment status' }))
    fireEvent.click((await screen.findAllByText('shipped')).at(-1)!)

    expect(orderQueries).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() => expect(orderQueries).toHaveLength(2), { timeout: 3_000 })
    expect(orderQueries[1]).toEqual({
      fulfillmentStatus: 'shipped',
      page: '1',
      pageSize: '20',
      paymentStatus: 'paid',
      query: 'ORD-2',
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_100))
    })

    fireEvent.change(screen.getByLabelText('Search orders'), {
      target: { value: 'unsubmitted' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(orderQueries).toHaveLength(3))
    expect(orderQueries[2]).toEqual(orderQueries[1])

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(orderQueries).toHaveLength(4), { timeout: 3_000 })
    expect(orderQueries[3]).toEqual({ page: '1', pageSize: '20' })
  })

  it('preserves numeric pagination and the public-reference detail route', async () => {
    renderPage()
    await screen.findByText('ORD-LIST01')

    fireEvent.click(document.querySelector('.ant-pagination-next button')!)
    await waitFor(() => expect(orderQueries.at(-1)?.page).toBe('2'))

    fireEvent.click(screen.getByRole('button', { name: 'ORD-LIST01' }))
    expect(await screen.findByText('Order destination')).toBeTruthy()
  })

  it('uses standard blocking error, retry, and empty states', async () => {
    failOrders = true
    const view = renderPage()
    expect(await screen.findByText('List could not be loaded')).toBeTruthy()
    expect(screen.queryByText('ORD-LIST01')).toBeNull()

    failOrders = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('ORD-LIST01')).toBeTruthy()
    view.unmount()

    emptyOrders = true
    renderPage()
    expect(await screen.findByText('No orders match these filters.')).toBeTruthy()
  })
})
