import type { ReportExport, ReportOrderRow, ReportingQuery, RevenueReport } from '@shoppp/contracts'
import { expect, test } from '@playwright/test'
import { mockAdminSession } from './support'

const readReportingQuery = (url: string): ReportingQuery => {
  const searchParams = new URL(url).searchParams
  return {
    currency: searchParams.get('currency') ?? '',
    endDate: searchParams.get('endDate') ?? '',
    startDate: searchParams.get('startDate') ?? '',
    timeZone: searchParams.get('timeZone') ?? '',
  }
}

const buildRevenueReport = (): RevenueReport => ({
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
})

test('operator reconciles the labeled dashboard, drills down, and confirms a scoped export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('shoppp.admin.locale')) {
      window.localStorage.setItem('shoppp.admin.locale', 'en-US')
    }
  })
  await mockAdminSession(page)
  const reportFixture = buildRevenueReport()
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
  let releaseQueriedReport!: () => void
  let releaseStaleReport!: () => void
  const queriedReportGate = new Promise<void>((resolve) => {
    releaseQueriedReport = resolve
  })
  const staleReportGate = new Promise<void>((resolve) => {
    releaseStaleReport = resolve
  })
  const revenueRequests: ReportingQuery[] = []
  const orderRequests: ReportingQuery[] = []
  const chooseFilterOption = async (label: 'Currency' | 'Time zone', option: string) => {
    await page.getByRole('combobox', { name: label }).click()
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
      .filter({ hasText: option })
      .first()
      .click()
  }

  await page.route('**/admin/reporting/revenue**', async (route) => {
    const query = readReportingQuery(route.request().url())
    revenueRequests.push(query)
    if (query.currency === 'EUR') await queriedReportGate
    if (query.currency === 'USD') await staleReportGate
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: {
          ...reportFixture,
          currency: query.currency,
          timeZone: query.timeZone,
          current: {
            ...reportFixture.current,
            startDate: query.startDate,
            endDate: query.endDate,
          },
        },
      },
    })
  })
  await page.route('**/admin/reporting/orders**', async (route) => {
    orderRequests.push(readReportingQuery(route.request().url()))
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
  await expect(page.getByText('Gross sales (CN¥)')).toBeVisible()
  await expect.poll(() => revenueRequests.length).toBe(1)
  const defaultScope = revenueRequests[0]!

  const filterForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Query' }) })
  await expect(filterForm.locator('button').filter({ hasText: /^(Reset|Query)$/ })).toHaveText([
    'Reset',
    'Query',
  ])
  await chooseFilterOption('Currency', 'EUR')
  await chooseFilterOption('Time zone', 'Europe/London')
  await page.waitForTimeout(100)
  expect(revenueRequests).toHaveLength(1)

  await page.getByRole('button', { name: 'Query' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => revenueRequests.length).toBe(2)
  expect(revenueRequests[1]).toEqual({
    ...defaultScope,
    currency: 'EUR',
    timeZone: 'Europe/London',
  })
  await expect(page.getByText('Loading report…')).toBeVisible()
  releaseQueriedReport()
  await expect(page.getByText('Gross sales (€)')).toBeVisible()

  await chooseFilterOption('Currency', 'USD')
  await page.waitForTimeout(100)
  expect(revenueRequests).toHaveLength(2)

  await page.getByRole('button', { name: 'View underlying orders' }).click()
  await expect(page).toHaveURL(/\/reports\/orders\?/)
  await expect.poll(() => orderRequests.length).toBe(1)
  expect(orderRequests[0]).toEqual(revenueRequests[1])
  await expect(page.getByText('ORD-REPORT01')).toBeVisible()
  await expect(page.getByText('shopper@example.test')).toBeVisible()
  await page.getByRole('button', { name: 'Export CSV' }).click()
  await page.getByRole('textbox', { name: 'Export reason' }).fill('Finance close reconciliation')
  await page.getByRole('button', { name: 'Confirm export' }).click()

  await expect(page.getByText('Download export (1 rows)')).toBeVisible()
  expect(exportBody).toMatchObject({
    confirm: true,
    currency: 'EUR',
    reason: 'Finance close reconciliation',
  })
  expect(idempotencyKey).toMatch(/^report-export-/)

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Commerce dashboard' })).toBeVisible()
  await expect.poll(() => revenueRequests.length).toBe(3)
  await expect(page.getByText('Gross sales (CN¥)')).toBeVisible()
  await chooseFilterOption('Currency', 'USD')
  await page.getByRole('button', { name: 'Query' }).click()
  await expect.poll(() => revenueRequests.length).toBe(4)
  await expect(page.getByText('Loading report…')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(() => revenueRequests.length).toBe(5)
  expect(revenueRequests[4]).toEqual(defaultScope)
  await expect(page.getByText('Gross sales (CN¥)')).toBeVisible()
  const staleResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/admin/reporting/revenue') &&
      new URL(response.url()).searchParams.get('currency') === 'USD'
  )
  releaseStaleReport()
  await staleResponse
  await expect(page.getByText('Gross sales (CN¥)')).toBeVisible()
  await expect(page.getByText('Gross sales ($)')).toHaveCount(0)
  expect(revenueRequests).toHaveLength(5)
})

test('dashboard keeps Chinese filters readable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => window.localStorage.setItem('shoppp.admin.locale', 'zh-CN'))
  await mockAdminSession(page)
  await page.route('**/admin/reporting/revenue**', async (route) => {
    const query = readReportingQuery(route.request().url())
    const report = buildRevenueReport()
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: {
          ...report,
          currency: query.currency,
          timeZone: query.timeZone,
          current: { ...report.current, startDate: query.startDate, endDate: query.endDate },
        },
      },
    })
  })

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: '商业仪表盘' })).toBeVisible()
  const chineseFilterForm = page.locator('form').first()
  const chineseResetButton = chineseFilterForm.locator('button').filter({ hasText: '重' })
  const chineseQueryButton = chineseFilterForm.locator('button').filter({ hasText: '查' })
  await expect(chineseResetButton).toBeVisible()
  await expect(chineseQueryButton).toBeVisible()
  expect(
    await chineseFilterForm
      .locator('button')
      .evaluateAll((buttons) =>
        buttons
          .map((button) => button.textContent?.replace(/\s/g, '') ?? '')
          .filter((text) => text === '重置' || text === '查询')
      )
  ).toEqual(['重置', '查询'])
  await expect(page.getByRole('combobox', { name: '币种' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '时区' })).toBeVisible()
  await expect(page.getByPlaceholder('开始日期')).toBeVisible()
  await expect(page.getByPlaceholder('结束日期')).toBeVisible()
  await expect(chineseResetButton).toBeInViewport()
  await expect(chineseQueryButton).toBeInViewport()
  await expect(page.getByText('销售总额 (¥)')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(
    await page.locator('.ant-table-content').evaluate((element) => {
      return element.scrollWidth > element.clientWidth
    })
  ).toBe(true)
})
