import { test, expect, type Page } from '@playwright/test'
import {
  SETUP_GUIDE_CHECKS,
  updateLaunchConfigurationRequestSchema,
  type LaunchConfiguration,
  type SetupGuideSummary,
} from '@shoppp/contracts'
import { mockAdminSession } from './support'
import { normalizeAppBasePath } from '../src/shared/utils/normalize-app-base-path'

const appBase = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)
const path = (suffix: string) => `${appBase}${suffix}`
const configurationFixture = (): LaunchConfiguration => ({
  defaultCurrency: 'USD',
  sellableCurrencies: ['USD', 'EUR'],
  orderNumberPrefix: 'SHOP',
  reservationTtlMinutes: 30,
  oversellPolicy: 'deny',
  paymentMode: 'test',
  paymentProvider: 'stripe',
  providerConfigured: true,
  webhookConfigured: true,
  taxMode: 'zero',
  legalApproved: true,
  shippingCountries: ['US'],
  shippingMethodIds: ['ship_01J00000000000000000000001'],
  supportEmail: 'support@example.test',
  privacyContactEmail: 'privacy@example.test',
  policies: {
    contact: 'https://example.test/contact',
    cookies: 'https://example.test/cookies',
    privacy: 'https://example.test/privacy',
    returns: 'https://example.test/returns',
    shipping: 'https://example.test/shipping',
    terms: 'https://example.test/terms',
  },
})

// Explicit browser fixtures prove UI behavior; Workers tests cover real authorization and queries.
async function mockCommerce(page: Page, restricted = false) {
  let configuration = configurationFixture()
  let checks = 0
  let saves = 0
  let denied = false
  await page.route('**/api/admin/settings/setup-guide', async (route) => {
    checks += 1
    if (denied) {
      await route.fulfill({
        status: 403,
        json: { error: { code: 'permission_denied', message: 'Permission removed.' } },
      })
      return
    }
    const data: SetupGuideSummary = {
      checkedAt: new Date().toISOString(),
      environment: 'staging',
      configuration: {
        defaultCurrency: configuration.defaultCurrency,
        updatedAt: '2026-09-03T00:00:00.000Z',
      },
      checks: SETUP_GUIDE_CHECKS.map((check) => {
        if (
          restricted &&
          ['sellable_sku', 'sellable_currencies', 'oversell_policy'].includes(check.id)
        )
          return { ...check, status: 'restricted', reasons: [{ code: 'permission_denied' }] }
        if (check.id === 'sellable_sku' && configuration.defaultCurrency === 'EUR')
          return { ...check, status: 'needs_action', reasons: [{ code: 'no_sellable_sku' }] }
        return { ...check, status: 'passed', reasons: [] }
      }),
    }
    await route.fulfill({ json: { data } })
  })
  await page.route('**/api/admin/settings/launch', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = updateLaunchConfigurationRequestSchema.parse(route.request().postDataJSON())
      expect(body.reason).toBe('Verify default currency from guide')
      expect(route.request().headers()['idempotency-key']).toMatch(/^launch-settings-/)
      configuration = body.configuration
      saves += 1
    }
    await route.fulfill({
      json: {
        data: {
          configuration,
          environment: 'staging',
          updatedAt: '2026-09-03T00:00:00.000Z',
          ready: true,
          issues: [],
        },
      },
    })
  })
  await page.route('**/api/admin/operations/health', async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: { code: 'health_unavailable', message: 'Health fixture unavailable.' } },
    })
  })
  return {
    checks: () => checks,
    saves: () => saves,
    deny: () => {
      denied = true
    },
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(
    ({ locale, mode }) => {
      window.localStorage.setItem('shoppp.admin.locale', locale)
      window.localStorage.setItem('admin-theme-mode', mode)
    },
    {
      locale: testInfo.title.includes('Chinese') ? 'zh-CN' : 'en-US',
      mode: testInfo.title.includes('dark') ? 'dark' : 'light',
    }
  )
})

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`guide settings return journey on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await mockAdminSession(page)
    const fixture = await mockCommerce(page)
    await page.goto(path('/'))
    await expect(page).toHaveURL(new RegExp(`${appBase}/welcome$`))
    await expect(page.getByText('Automatic checks passed: 13/13')).toBeVisible()
    await expect(
      page.getByText('Current configuration checks passed; manual verification is still required.')
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Store setup guide' })).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          [...document.querySelectorAll('.ant-layout-content')].every(
            (element) => element.scrollWidth <= element.clientWidth
          )
      )
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`guide-${viewport.name}.png`),
      fullPage: true,
    })
    const salesLink = page.getByRole('link', { name: 'Sales settings', exact: true })
    await salesLink.focus()
    await expect(salesLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${appBase}/settings/launch\\?from=setup-guide#sales$`))
    await expect(page.getByLabel('Default currency', { exact: true })).toHaveValue('USD')
    await page.getByLabel('Default currency', { exact: true }).fill('EUR')
    await page
      .getByLabel('Change reason', { exact: true })
      .fill('Verify default currency from guide')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(fixture.saves).toBe(1)
    await page.getByRole('link', { name: 'Back to store setup guide', exact: true }).click()
    await expect(page.getByText('Automatic checks passed: 12/13')).toBeVisible()
    await expect(page.getByText(/Default currency: EUR/)).toBeVisible()
    await expect(
      page.getByText(
        'No published SKU has a current price and available stock in the default currency.'
      )
    ).toBeVisible()
    expect(fixture.checks()).toBeGreaterThanOrEqual(2)
    await page.goBack()
    await expect(page.getByLabel('Default currency', { exact: true })).toHaveValue('EUR')
    await page.goForward()
    await expect(page.getByText('Automatic checks passed: 12/13')).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          [...document.querySelectorAll('.ant-layout-content')].every(
            (element) => element.scrollWidth <= element.clientWidth
          )
      )
    ).toBe(true)
  })
}

test('settings reader has fixed restricted progress and a readonly commercial form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAdminSession(page, ['settings.read'])
  const fixture = await mockCommerce(page, true)
  await page.goto(path('/welcome'))
  await expect(page.getByText('Automatic checks passed: 10/13')).toBeVisible()
  await expect(
    page.getByText('Needs action: 0 · Unable to check: 0 · No permission: 3')
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.ant-layout-content')].every(
        (element) => element.scrollWidth <= element.clientWidth
      )
    )
  ).toBe(true)
  await expect(page.getByRole('link', { name: 'Manage products' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Contact settings' }).click()
  await expect(page.getByLabel('Support email', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  expect(fixture.saves()).toBe(0)
  await page.goto(path('/settings/launch?from=https://example.invalid'))
  await expect(page.getByLabel('Support email', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('link', { name: 'Back to store setup guide', exact: true })
  ).toHaveCount(0)
})

test('a staff account without settings access retains its authorized home', async ({ page }) => {
  await mockAdminSession(page, ['catalog.read'])
  await page.route('**/api/admin/catalog/products*', async (route) =>
    route.fulfill({ json: { data: [], meta: { total: 0 } } })
  )
  await page.goto(path('/'))
  await expect(page).toHaveURL(new RegExp(`${appBase}/catalog/products$`))
  await expect(page.getByRole('menuitem', { name: /Store setup guide/ })).toHaveCount(0)
  await page.goto(path('/welcome'))
  await expect(page.getByRole('link', { name: 'Contact settings' })).toHaveCount(0)
})

test('revoked guide access clears previous success and all guide destinations', async ({
  page,
}) => {
  await mockAdminSession(page)
  const fixture = await mockCommerce(page)
  await page.goto(path('/welcome'))
  await expect(page.getByText('Automatic checks passed: 13/13')).toBeVisible()
  fixture.deny()
  await page.getByRole('button', { name: 'Recheck', exact: true }).click()
  await expect(page.getByText('Automatic checks passed: 0/13')).toBeVisible()
  await expect(
    page.getByText('Needs action: 0 · Unable to check: 0 · No permission: 13')
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contact settings' })).toHaveCount(0)
  await expect(page.getByText(/Default currency:/)).toHaveCount(0)
})

test('Chinese dark guide remains readable on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAdminSession(page, ['settings.read'])
  await mockCommerce(page, true)
  await page.goto(path('/welcome'))
  await expect(page.getByText('自动检查已通过：10/13')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByText('1. 基础与联系方式')).toBeVisible()
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.ant-layout-content')].every(
        (element) => element.scrollWidth <= element.clientWidth
      )
    )
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('guide-mobile-zh-dark.png'), fullPage: true })
  await page.getByRole('button', { name: '折叠指南', exact: true }).click()
  await expect(page.getByText('自动检查已通过：10/13')).toBeVisible()
  await expect(page.getByRole('link', { name: '联系方式设置' })).toHaveCount(0)
  await page.getByRole('button', { name: '展开指南', exact: true }).click()
  await page.getByRole('link', { name: '政策设置' }).scrollIntoViewIfNeeded()
  await expect(page.getByText('预览店面并确认品牌内容与政策正文。')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('guide-mobile-zh-dark-policies.png'),
    fullPage: true,
  })
})
