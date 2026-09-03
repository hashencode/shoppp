import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AdminOrderDetail } from '@shoppp/contracts'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
import { OrderDetailPage } from './order-detail'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})

describe('Order timeline in a native browser', () => {
  it('translates known shipment semantics while preserving exact raw and old mixed labels in a locally scrolling table', async () => {
    const carrier = 'DHL / Express, Inc.'
    const trackingNumber = '  Tracking / # 42 : A-B  '
    const legacy = `shipped · ${carrier} ${trackingNumber}`
    const shipment = {
      createdAt: '2026-09-03T00:00:00.000Z',
      kind: 'fulfillment' as const,
      label: legacy,
      status: 'shipped',
      actor: 'Refund',
      reason: 'Order',
    }
    const detail: AdminOrderDetail = {
      allowedActions: { cancel: false, fulfill: [], refundMaximum: 0 },
      facts: {
        createdAt: shipment.createdAt,
        currency: 'USD',
        email: 'shopper@example.test',
        fulfillmentStatus: 'shipped',
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
        publicReference: 'ORD-BROWSER',
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
        { ...shipment, id: 'structured', carrier, trackingNumber },
        { ...shipment, id: 'legacy' },
      ],
    }
    transport = installBrowserApi((request) => {
      if (request.method !== 'get' || request.url !== '/admin/orders/ORD-BROWSER')
        throw new Error(`Unexpected request ${request.url}`)
      return { data: { data: detail } }
    })
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/orders/ORD-BROWSER']}>
        <Routes>
          <Route path="/orders/:reference" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
      ['orders.read']
    )
    await expect.element(page.getByText('Atlas Carry-on')).toBeVisible()
    assertNativeBrowserAndCss()
    for (let index = 0; index < 2; index += 1) {
      const chinese = document.documentElement.lang === 'zh-CN'
      const cells = document.querySelectorAll('tr[data-row-key="structured"] td')
      expect(cells[1]?.textContent).toBe(chinese ? '履约' : 'Fulfillment')
      expect(cells[2]?.textContent).toBe(chinese ? '已发货' : 'Shipment dispatched')
      expect(cells[3]?.textContent).toBe(chinese ? '已发货' : 'Shipment dispatched')
      expect(cells[4]?.textContent).toBe(carrier)
      expect(cells[5]?.textContent).toBe(trackingNumber)
      expect(cells[6]?.textContent).toBe('Refund')
      expect(cells[7]?.textContent).toBe('Order')
      expect(document.querySelector('tr[data-row-key="legacy"] td:nth-child(3)')?.textContent).toBe(
        legacy
      )
      const table = document
        .querySelector('tr[data-row-key="structured"]')!
        .closest('.ant-table-content')!
      assertWithinViewport(table)
      expect(table.scrollWidth).toBeGreaterThan(table.clientWidth)
      table.scrollLeft = table.scrollWidth
      expect(table.scrollLeft).toBeGreaterThan(0)
      await switchBrowserLocale()
    }
    expect(transport.requests).toHaveLength(1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
