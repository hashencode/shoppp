import { expect, test } from '@playwright/test'
import {
  SETUP_GUIDE_CHECKS,
  type SetupGuideDestinations,
  type SetupGuideSummary,
} from '@shoppp/contracts'
import { mockAdminSession } from './support'
import { normalizeAppBasePath } from '../src/shared/utils/normalize-app-base-path'

const appBase = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)
const path = (suffix: string) => `${appBase}${suffix}`

const guide: SetupGuideDestinations = {
  destinations: [
    { href: '/settings/identity?from=setup-guide', id: 'identity' },
    { href: '/settings/contact?from=setup-guide', id: 'contact' },
    { href: '/settings/policies?from=setup-guide', id: 'policies' },
    { href: '/catalog/products?from=setup-guide', id: 'products' },
    { href: '/catalog/collections?from=setup-guide', id: 'collections' },
    { href: '/content/pages?from=setup-guide', id: 'pages' },
    { href: '/content/articles?from=setup-guide', id: 'articles' },
    { href: '/storefront/navigation?from=setup-guide', id: 'navigation' },
    { href: '/storefront/themes?from=setup-guide', id: 'themes' },
    { href: '/settings/shipping?from=setup-guide', id: 'shipping' },
    { href: '/settings/launch?from=setup-guide', id: 'commerce' },
    { href: '/inventory?from=setup-guide', id: 'inventory' },
    { href: '/orders?from=setup-guide', id: 'orders' },
  ],
}
const guideSummary: SetupGuideSummary = {
  checkedAt: '2026-09-28T08:00:00.000Z',
  environment: 'staging',
  configuration: { updatedAt: '2026-09-28T07:00:00.000Z', defaultCurrency: 'USD' },
  checks: SETUP_GUIDE_CHECKS.map((check) => ({ ...check, status: 'passed', reasons: [] })),
}
guideSummary.checks[0] = {
  ...guideSummary.checks[0]!,
  status: 'needs_action',
  reasons: [{ code: 'configuration_not_saved' }],
}
guideSummary.checks[2] = {
  ...guideSummary.checks[2]!,
  status: 'needs_action',
  reasons: [{ code: 'no_sellable_sku' }],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('shoppp.admin.locale', 'en-US')
  })
  await mockAdminSession(page)
})

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`setup guide shows completion and guided authority links on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.route('**/api/admin/settings/setup-guide/destinations', (route) =>
      route.fulfill({ json: { data: guide } })
    )
    await page.route('**/api/admin/settings/setup-guide', (route) =>
      route.fulfill({ json: { data: guideSummary } })
    )
    await page.route('**/api/admin/catalog/products**', (route) =>
      route.fulfill({
        json: {
          data: [
            {
              id: 'product-setup-guide',
              name: 'Setup guide product',
              slug: 'setup-guide-product',
              status: 'draft',
              updated_at: '2026-09-24T00:00:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1 },
        },
      })
    )
    await page.goto(path('/welcome'))

    await expect(page.getByRole('heading', { name: 'Store setup guide' })).toBeVisible()
    await expect(page.locator('.ant-statistic-content')).toHaveText('11/13')
    await expect(
      page.getByText(
        'Default configuration has not been confirmed. Review and save commercial settings.'
      )
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to Commercial settings' })).toHaveAttribute(
      'href',
      `${appBase}/settings/launch?from=setup-guide#sales`
    )
    await expect(page.getByRole('link', { name: 'Store identity' })).toHaveAttribute(
      'href',
      `${appBase}/settings/identity?from=setup-guide`
    )
    await page.getByText('5. Storefront and policies').click()
    await expect(page.getByRole('link', { name: 'Policies' })).toHaveAttribute(
      'href',
      `${appBase}/settings/policies?from=setup-guide`
    )
    await expect(page.getByRole('link', { name: 'Navigation' })).toHaveAttribute(
      'href',
      `${appBase}/storefront/navigation?from=setup-guide`
    )
    await expect(page.getByRole('link', { name: 'Themes and preview' })).toHaveAttribute(
      'href',
      `${appBase}/storefront/themes?from=setup-guide`
    )
    await expect(
      page.getByText(/Manually preview the storefront to confirm brand content and policy text/)
    ).toBeVisible()
    await page.getByText('6. Review before launch').click()
    await expect(
      page.getByText(
        /Manually place a test order in the test storefront to verify delivery, payment and order confirmation/
      )
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /Manually place a test order in the test storefront to verify delivery, payment and order confirmation/
        )
        .getByRole('link', { name: 'Orders' })
    ).toHaveAttribute('href', `${appBase}/orders?from=setup-guide`)
    await page.getByRole('link', { name: 'Go to Products' }).click()
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Setup guide product' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to store setup guide' }).click()
    await expect(page.getByRole('heading', { name: 'Store setup guide' })).toBeVisible()
  })
}

test('setup index recovers from an unavailable destination response', async ({ page }) => {
  let requests = 0
  await page.route('**/api/admin/settings/setup-guide/destinations', (route) => {
    requests += 1
    return requests === 1
      ? route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } })
      : route.fulfill({ json: { data: guide } })
  })
  await page.route('**/api/admin/settings/setup-guide', (route) =>
    route.fulfill({ json: { data: guideSummary } })
  )
  await page.goto(path('/welcome'))

  await expect(page.getByText('Setup destinations could not be loaded')).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText('Setup destinations could not be loaded')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Store identity' })).toBeVisible()
})

test('recheck keeps the expanded guide height while replacing old results', async ({ page }) => {
  let requests = 0
  let releaseRecheck!: () => void
  const pendingRecheck = new Promise<void>((resolve) => {
    releaseRecheck = resolve
  })
  await page.route('**/api/admin/settings/setup-guide/destinations', (route) =>
    route.fulfill({ json: { data: guide } })
  )
  await page.route('**/api/admin/settings/setup-guide', async (route) => {
    requests += 1
    if (requests === 2) await pendingRecheck
    const result =
      requests === 1
        ? guideSummary
        : {
            ...guideSummary,
            checks: SETUP_GUIDE_CHECKS.map((check) => ({
              ...check,
              status: 'passed' as const,
              reasons: [],
            })),
          }
    await route.fulfill({ json: { data: result } })
  })
  await page.goto(path('/welcome'))
  await expect(page.locator('.ant-statistic-content')).toHaveText('11/13')
  await expect(
    page.getByText(
      'Default configuration has not been confirmed. Review and save commercial settings.'
    )
  ).toBeVisible()
  await page.waitForTimeout(450)
  const card = page.locator('.ant-card').first()
  const guidePanel = page.locator('.ant-collapse')
  const cardBefore = await card.evaluate((element) => element.getBoundingClientRect().height)
  const before = await guidePanel.evaluate((element) => element.getBoundingClientRect().height)

  await page.getByRole('button', { name: 'Recheck' }).click()
  await expect.poll(() => requests).toBe(2)
  await expect(
    page.getByText(
      'Default configuration has not been confirmed. Review and save commercial settings.'
    )
  ).toBeHidden()
  await page.waitForTimeout(450)
  const cardDuring = await card.evaluate((element) => element.getBoundingClientRect().height)
  const during = await guidePanel.evaluate((element) => element.getBoundingClientRect().height)
  expect(cardDuring).toBeGreaterThanOrEqual(cardBefore - 1)
  expect(during).toBeGreaterThanOrEqual(before - 1)

  releaseRecheck()
  await expect(page.locator('.ant-statistic-content')).toHaveText('13/13')
})
