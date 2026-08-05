import type { AdminOrderDetail } from '@shoppp/contracts'
import { expect, test, type Page } from '@playwright/test'
import { mockAdminSession } from './support'

const baseDetail = (reference: string): AdminOrderDetail => ({
  allowedActions: {
    cancel: true,
    fulfill: ['picking'],
    refundMaximum: 12_900,
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
        lineTotalAmount: 12_900,
        productName: 'Atlas Carry-on',
        quantity: 1,
        sku: 'ATLAS-BLK',
        taxAmount: 0,
        unitPriceAmount: 12_900,
        variantName: 'Black',
      },
    ],
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    publicReference: reference,
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
      grandTotal: 12_900,
      shippingTotal: 0,
      subtotal: 12_900,
      taxTotal: 0,
    },
  },
  timeline: [
    {
      createdAt: '2026-07-30T00:00:00.000Z',
      id: 'notification-receipt',
      kind: 'notification',
      label: 'order_receipt',
      status: 'sent',
    },
  ],
})

const confirmReason = async (page: Page, reason: string) => {
  await page.getByRole('textbox', { name: 'Reason' }).fill(reason)
  await page.getByRole('button', { name: 'Confirm operation' }).click()
  await expect(page.getByText('Order operation recorded.').last()).toBeVisible()
}

test('operator completes picking, packing, and one tracked shipment', async ({ page }) => {
  await mockAdminSession(page)
  let detail = baseDetail('ORD-FULFILL-E2E')
  const bodies: unknown[] = []
  const idempotencyKeys: string[] = []

  await page.route('**/admin/orders/ORD-FULFILL-E2E**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: { data: detail } })
      return
    }

    const body = (await request.postDataJSON()) as {
      carrier?: string
      reason: string
      toStatus: 'packed' | 'picking' | 'shipped'
      trackingNumber?: string
    }
    bodies.push(body)
    idempotencyKeys.push(request.headers()['idempotency-key'] ?? '')
    const next =
      body.toStatus === 'picking' ? 'packed' : body.toStatus === 'packed' ? 'shipped' : undefined
    detail = {
      ...detail,
      allowedActions: {
        ...detail.allowedActions,
        cancel: false,
        fulfill: next ? [next] : [],
      },
      facts: { ...detail.facts, fulfillmentStatus: body.toStatus },
      timeline: [
        {
          actor: 'operations-e2e',
          createdAt: `2026-07-30T00:0${bodies.length}:00.000Z`,
          id: `fulfillment-${bodies.length}`,
          kind: 'fulfillment',
          label: `fulfillment_${body.toStatus}`,
          reason: body.reason,
          status: body.toStatus,
        },
        ...detail.timeline,
      ],
    }
    await route.fulfill({ contentType: 'application/json', json: { data: detail } })
  })

  await page.goto('/orders/ORD-FULFILL-E2E')
  await page.getByRole('button', { name: 'Mark picking' }).click()
  await confirmReason(page, 'Warehouse accepted the order')
  await page.getByRole('button', { name: 'Mark packed' }).click()
  await confirmReason(page, 'Package passed final inspection')
  await page.getByRole('button', { name: 'Add shipment' }).click()
  await page.getByRole('textbox', { name: 'Carrier' }).fill('DHL')
  await page.getByRole('textbox', { name: 'Tracking number' }).fill('DHL-TRACK-001')
  await confirmReason(page, 'Parcel handed to carrier')

  await expect(page.getByText('Fulfillment · shipped')).toBeVisible()
  expect(bodies).toEqual([
    { confirm: true, reason: 'Warehouse accepted the order', toStatus: 'picking' },
    { confirm: true, reason: 'Package passed final inspection', toStatus: 'packed' },
    {
      carrier: 'DHL',
      confirm: true,
      reason: 'Parcel handed to carrier',
      toStatus: 'shipped',
      trackingNumber: 'DHL-TRACK-001',
    },
  ])
  expect(idempotencyKeys).toHaveLength(3)
  expect(idempotencyKeys.every(Boolean)).toBe(true)
  expect(new Set(idempotencyKeys).size).toBe(3)
})

test('operator issues a confirmed partial refund without changing fulfillment', async ({ page }) => {
  await mockAdminSession(page)
  let detail = baseDetail('ORD-REFUND-E2E')
  let refundBody: unknown
  let idempotencyKey = ''

  await page.route('**/admin/orders/ORD-REFUND-E2E**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: { data: detail } })
      return
    }

    refundBody = await request.postDataJSON()
    idempotencyKey = request.headers()['idempotency-key'] ?? ''
    detail = {
      ...detail,
      allowedActions: { ...detail.allowedActions, refundMaximum: 9_900 },
      facts: { ...detail.facts, paymentStatus: 'partially_refunded' },
      timeline: [
        {
          actor: 'operations-e2e',
          createdAt: '2026-07-30T00:01:00.000Z',
          id: 'refund-1',
          kind: 'refund',
          label: 'refund_completed',
          reason: 'Damaged outer packaging',
          status: 'succeeded',
        },
        ...detail.timeline,
      ],
    }
    await route.fulfill({ contentType: 'application/json', json: { data: detail } })
  })

  await page.goto('/orders/ORD-REFUND-E2E')
  await page.getByRole('button', { name: 'Refund' }).click()
  await page.getByRole('spinbutton', { name: /Amount in minor units/ }).fill('3000')
  await confirmReason(page, 'Damaged outer packaging')

  await expect(page.getByText('Payment · partially_refunded')).toBeVisible()
  await expect(page.getByText('Fulfillment · unfulfilled')).toBeVisible()
  expect(refundBody).toEqual({
    amount: 3000,
    confirm: true,
    reason: 'Damaged outer packaging',
  })
  expect(idempotencyKey).toBeTruthy()
})

test('operator confirms cancellation and sees independent terminal states', async ({ page }) => {
  await mockAdminSession(page)
  let detail = baseDetail('ORD-CANCEL-E2E')
  let cancelBody: unknown

  await page.route('**/admin/orders/ORD-CANCEL-E2E**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: { data: detail } })
      return
    }

    cancelBody = await request.postDataJSON()
    detail = {
      ...detail,
      allowedActions: { cancel: false, fulfill: [], refundMaximum: 0 },
      facts: {
        ...detail.facts,
        fulfillmentStatus: 'canceled',
        orderStatus: 'canceled',
        paymentStatus: 'refunded',
      },
      timeline: [
        {
          actor: 'operations-e2e',
          createdAt: '2026-07-30T00:01:00.000Z',
          id: 'order-canceled',
          kind: 'order',
          label: 'order_canceled',
          reason: 'Customer requested cancellation',
          status: 'canceled',
        },
        ...detail.timeline,
      ],
    }
    await route.fulfill({ contentType: 'application/json', json: { data: detail } })
  })

  await page.goto('/orders/ORD-CANCEL-E2E')
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await confirmReason(page, 'Customer requested cancellation')

  await expect(page.getByText('Payment · refunded')).toBeVisible()
  await expect(page.getByText('Order · canceled')).toBeVisible()
  await expect(page.getByText('Fulfillment · canceled')).toBeVisible()
  expect(cancelBody).toEqual({
    confirm: true,
    reason: 'Customer requested cancellation',
  })
})
