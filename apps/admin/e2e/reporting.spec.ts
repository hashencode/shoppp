import type { ReportExport, ReportOrderRow, RevenueReport } from '@shoppp/contracts'
import { expect, test } from '@playwright/test'

test('operator reconciles the labeled dashboard, drills down, and confirms a scoped export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('codex-admin-auth', '1')
    window.localStorage.setItem('codex-admin-account', 'reporting-e2e')
  })
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
  const row: ReportOrderRow = {
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
    id: 'rex_e2e_001',
    rowCount: 1,
    startDate: '2026-07-01',
    status: 'ready',
    timeZone: 'UTC',
  }
  let exportBody: unknown
  let idempotencyKey = ''

  await page.route('**/admin/reporting/revenue**', async (route) => {
    await route.fulfill({ contentType: 'application/json', json: { data: report } })
  })
  await page.route('**/admin/reporting/orders**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { data: [row], meta: { page: 1, pageSize: 20, total: 1 } },
    })
  })
  await page.route('**/admin/reporting/exports', async (route) => {
    exportBody = await route.request().postDataJSON()
    idempotencyKey = route.request().headers()['idempotency-key'] ?? ''
    await route.fulfill({
      contentType: 'application/json',
      json: { data: readyExport },
      status: 202,
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Commerce dashboard' })).toBeVisible()
  await expect(
    page.getByText('USD · America/New_York · 2026-07-01–2026-07-30')
  ).toBeVisible()
  await expect(page.getByText('$35.00').first()).toBeVisible()
  await expect(page.getByText('Previous 2026-06-01–2026-06-30: $20.00')).toBeVisible()

  await page.getByRole('button', { name: 'View underlying orders' }).click()
  await expect(page).toHaveURL(/\/reports\/orders\?/)
  await expect(page.getByText('ORD-REPORT01')).toBeVisible()
  await expect(page.getByText('shopper@example.test')).toBeVisible()
  await page.getByRole('button', { name: 'Export CSV' }).click()
  await page.getByRole('textbox', { name: 'Export reason' }).fill('Finance close reconciliation')
  await page.getByRole('button', { name: 'Confirm export' }).click()

  await expect(page.getByText('Download export (1 rows)')).toBeVisible()
  expect(exportBody).toMatchObject({
    confirm: true,
    currency: 'USD',
    reason: 'Finance close reconciliation',
  })
  expect(idempotencyKey).toMatch(/^report-export-/)
})
