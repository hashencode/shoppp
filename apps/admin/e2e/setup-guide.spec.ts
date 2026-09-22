import { test, expect, type Page } from '@playwright/test'
import {
  SETUP_GUIDE_CHECKS,
  updateContactSettingsRequestSchema,
  updateLaunchConfigurationRequestSchema,
  type ContactSettings,
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
  await page.route('**/api/admin/settings/contact', async (route) => {
    await route.fulfill({
      json: {
        data: {
          supportEmail: configuration.supportEmail,
          privacyContactEmail: configuration.privacyContactEmail,
          launchVersion: 'browser-launch-version',
          profileVersion: null,
          updatedAt: null,
          profile: {
            publishSupportEmail: false,
            publishPrivacyEmail: false,
            publicPhone: null,
            serviceHours: null,
            timeZone: null,
            locations: [],
            socials: [],
          },
          publicContact: {
            supportEmail: null,
            privacyEmail: null,
            publicPhone: null,
            serviceHours: null,
            timeZone: null,
            locations: [],
            socials: [],
          },
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

test('store settings navigation supports expanded and collapsed sidebar paths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockAdminSession(page)
  await mockCommerce(page)

  await page.goto(path('/settings/contact'))

  const storeSettings = page.getByRole('menuitem', { name: /Store settings/ })
  await expect(storeSettings).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menuitem', { name: 'Contact settings' })).toHaveClass(
    /ant-menu-item-selected/
  )
  await expect(page.locator('.ant-breadcrumb')).toContainText('Store settings/Contact settings')

  const storeSettingsGroup = storeSettings.locator('xpath=ancestor::li[1]')
  await expect(storeSettingsGroup.locator(':scope > ul > li[role="menuitem"]')).toHaveText([
    'Commercial settings',
    'Contact settings',
    'Shipping settings',
  ])

  await storeSettings.click()
  await expect(page).toHaveURL(new RegExp(`${appBase}/settings/contact$`))
  await expect(storeSettings).toHaveAttribute('aria-expanded', 'false')
  await storeSettings.click()

  await page.getByRole('menuitem', { name: 'Commercial settings' }).click()
  await expect(page).toHaveURL(new RegExp(`${appBase}/settings/launch$`))
  await expect(page.getByRole('heading', { name: 'Commercial settings' })).toBeVisible()

  await page.getByRole('img', { name: 'menu-fold' }).locator('..').click()
  await expect(page.locator('.ant-layout-sider')).toHaveClass(/ant-layout-sider-collapsed/)
  await page.getByRole('menuitem', { name: /Store settings/ }).click()

  const collapsedPopup = page.locator('.ant-menu-submenu-popup')
  await expect(collapsedPopup).toBeVisible()
  await collapsedPopup.getByRole('menuitem', { name: 'Contact settings' }).click()
  await expect(page).toHaveURL(new RegExp(`${appBase}/settings/contact$`))
  await expect(page.getByRole('heading', { name: 'Contact settings' })).toBeVisible()
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
    await expect(page.getByText('Passed automatic checks')).toBeVisible()
    await expect(page.locator('.ant-statistic-content')).toHaveText('13/13')
    await expect(page.locator('.ant-collapse-header[aria-expanded="true"]')).toHaveCount(0)
    await expect(page.getByText(/Environment:|Default currency:/)).toHaveCount(0)
    await expect(
      page.getByText('Current configuration checks passed; manual verification is still required.')
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Store setup guide' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Commerce dashboard' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Collapse guide' })).toHaveCount(0)
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
    await page.getByText('2. Prepare products', { exact: true }).click()
    await expect(page.getByRole('list').filter({ hasText: 'At least one sellable SKU' })).toHaveCSS(
      'list-style-type',
      'disc'
    )
    const salesLink = page.getByRole('link', { name: 'Sales settings', exact: true })
    await expect(salesLink).toHaveClass(/ant-btn-default/)
    await expect(salesLink).not.toHaveClass(/ant-btn-(sm|lg)/)
    await expect(salesLink).toHaveCSS('height', '32px')
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
    await expect(page.locator('.ant-statistic-content')).toHaveText('12/13')
    await expect(page.getByText(/Environment:|Default currency:/)).toHaveCount(0)
    await expect(
      page.getByText(
        'No published SKU has a current price and available stock in the default currency.'
      )
    ).toBeVisible()
    expect(fixture.checks()).toBeGreaterThanOrEqual(2)
    await page.goBack()
    await expect(page.getByLabel('Default currency', { exact: true })).toHaveValue('EUR')
    await page.goForward()
    await expect(page.locator('.ant-statistic-content')).toHaveText('12/13')
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
  await expect(page.locator('.ant-statistic-content')).toHaveText('10/13')
  await expect(page.getByText(/Needs action:|Unable to check:|No permission:/)).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.ant-layout-content')].every(
        (element) => element.scrollWidth <= element.clientWidth
      )
    )
  ).toBe(true)
  await expect(page.getByRole('link', { name: 'Manage products' })).toHaveCount(0)
  await page.getByText('1. Basics and contacts', { exact: true }).click()
  await page.getByRole('link', { name: 'Contact settings' }).click()
  await expect(page.getByLabel('Support email', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Save contact settings', exact: true })
  ).toHaveCount(0)
  await expect(page.locator('.ax-fixed-toolbar')).toHaveCount(0)
  expect(fixture.saves()).toBe(0)
  await page.goto(path('/settings/launch?from=https://example.invalid'))
  await expect(page.getByLabel('Default currency', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('link', { name: 'Back to store setup guide', exact: true })
  ).toHaveCount(0)
})

for (const variant of [
  { name: 'desktop', width: 1440, locale: 'English' },
  { name: 'mobile Chinese', width: 390, locale: 'Chinese' },
]) {
  test(`contact editor saves reordered details on ${variant.name}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: 844 })
    await mockAdminSession(page)
    await mockCommerce(page)
    let contact: ContactSettings = {
      supportEmail: 'support@example.test',
      privacyContactEmail: 'privacy@example.test',
      launchVersion: 'browser-launch-version',
      profileVersion: null,
      updatedAt: null,
      profile: {
        publishSupportEmail: false,
        publishPrivacyEmail: false,
        publicPhone: null,
        serviceHours: null,
        timeZone: null,
        locations: [],
        socials: [],
      },
      publicContact: {
        supportEmail: null,
        privacyEmail: null,
        publicPhone: null,
        serviceHours: null,
        timeZone: null,
        locations: [],
        socials: [],
      },
    }
    let saves = 0
    await page.route('**/api/admin/settings/contact', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = updateContactSettingsRequestSchema.parse(route.request().postDataJSON())
        saves += 1
        contact = {
          ...contact,
          supportEmail: body.supportEmail,
          privacyContactEmail: body.privacyContactEmail,
          profile: body.profile,
          profileVersion: '23e73533-f18c-4591-bf6b-8e5ca078a60e',
          publicContact: {
            supportEmail: body.profile.publishSupportEmail ? body.supportEmail : null,
            privacyEmail: body.profile.publishPrivacyEmail ? body.privacyContactEmail : null,
            publicPhone: body.profile.publicPhone,
            serviceHours: body.profile.serviceHours,
            timeZone: body.profile.timeZone,
            locations: body.profile.locations.filter((location) => location.visible),
            socials: body.profile.socials.filter((social) => social.visible),
          },
        }
      }
      await route.fulfill({ json: { data: contact } })
    })
    const chinese = variant.locale === 'Chinese'
    const label = (english: string, translated: string) => (chinese ? translated : english)
    await page.goto(path('/settings/contact'))
    await expect(
      page.getByRole('heading', { name: label('Contact settings', '联系方式设置') })
    ).toBeVisible()
    const globalCard = page
      .locator('.ant-card')
      .filter({
        has: page.getByText(label('Global contact channels', '全局联系渠道'), { exact: true }),
      })
      .first()
    const locationsCard = page
      .locator('.ant-card')
      .filter({
        has: page.getByText(label('Physical locations', '实体地点'), { exact: true }),
      })
      .first()
    await expect(page.locator('.ax-fixed-toolbar')).toBeVisible()

    if (!chinese) {
      const geometry = await globalCard.evaluate((card) => {
        const content = card.closest('.ant-layout-content')
        const compactBody = card.querySelector('.ant-card-body')
        if (!content || !compactBody) throw new Error('Contact layout is incomplete')
        const cardRect = card.getBoundingClientRect()
        const compactRect = compactBody.getBoundingClientRect()
        return {
          cardWidth: cardRect.width,
          contentWidth: content.clientWidth,
          compactWidth: compactRect.width,
          compactLeftInset: compactRect.left - cardRect.left,
          compactRightInset: cardRect.right - compactRect.right,
        }
      })
      const locationsWidth = await locationsCard
        .locator('.ant-card-body')
        .evaluate((body) => body.getBoundingClientRect().width)
      expect(geometry.cardWidth).toBeGreaterThan(geometry.contentWidth * 0.9)
      expect(geometry.compactWidth).toBeLessThanOrEqual(802)
      expect(Math.abs(locationsWidth - geometry.compactWidth)).toBeLessThanOrEqual(2)
      expect(Math.abs(geometry.compactLeftInset - geometry.compactRightInset)).toBeLessThanOrEqual(
        2
      )

      await page.locator('header .ant-avatar').click()
      await page.getByText('Form alignment', { exact: true }).hover()
      await page.getByText('Left aligned', { exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-form-content-align', 'left')
      expect(
        await globalCard.evaluate((card) => {
          const body = card.querySelector('.ant-card-body')
          if (!body) throw new Error('Contact card body is missing')
          return Math.abs(body.getBoundingClientRect().left - card.getBoundingClientRect().left)
        })
      ).toBeLessThanOrEqual(2)
    }
    await page.getByRole('button', { name: label('Add location', '添加地点') }).click()
    await page.getByRole('button', { name: label('Add location', '添加地点') }).click()
    const names = page.getByLabel(label('Location name', '地点名称'))
    await names.nth(0).fill('North')
    await names.nth(1).fill('South')
    await page
      .getByRole('button', { name: chinese ? /上\s*移/ : 'Move up' })
      .nth(1)
      .click()
    await expect(names.nth(0)).toHaveValue('South')
    await page.getByRole('button', { name: label('Add service hours', '添加服务时间') }).click()
    await expect(page.getByRole('combobox', { name: label('Start weekday', '开始星期') })).toBeVisible()
    const timeZone = page.getByRole('combobox', { name: label('Time zone', '时区') })
    await timeZone.fill('Asia/Shanghai')
    await page.locator('.ant-select-item-option-content', { hasText: 'Asia/Shanghai' }).click()
    await page.getByRole('button', { name: label('Add social link', '添加社交链接') }).click()
    await page
      .getByRole('combobox', { name: label('Platform', '平台') })
      .locator(
        'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select ")]'
      )
      .click()
    await page.locator('.ant-select-item-option-content', { hasText: 'Instagram' }).click()
    await page.getByLabel(label('Destination URL', '目标网址')).fill('https://instagram.com/shoppp')
    await page.getByRole('button', { name: label('Save contact settings', '保存联系方式') }).click()
    await expect(page.getByLabel(label('City', '城市')).nth(0)).toBeFocused()
    await page.getByLabel(label('City', '城市')).nth(0).fill('Shanghai')
    await page.getByLabel(label('City', '城市')).nth(1).fill('Beijing')
    await page.getByLabel(label('Postal address', '邮寄地址')).nth(0).fill('123 South Road')
    await page.getByLabel(label('Postal address', '邮寄地址')).nth(1).fill('456 North Road')
    await page.getByRole('button', { name: label('Save contact settings', '保存联系方式') }).click()
    await expect.poll(() => saves).toBe(1)
    expect(contact.profile.locations.map((location) => location.name)).toEqual(['South', 'North'])
    expect(contact.profile.serviceHours).toMatchObject({
      kind: 'weekly',
      ranges: [
        {
          startDay: 'monday',
          endDay: 'friday',
          startTime: '09:00',
          endTime: '18:00',
        },
      ],
    })
    expect(contact.profile.timeZone).toBe('Asia/Shanghai')
    await page.reload()
    await expect(page.getByLabel(label('Location name', '地点名称')).nth(0)).toHaveValue('South')
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          [...document.querySelectorAll('.ant-layout-content')].every(
            (element) => element.scrollWidth <= element.clientWidth
          )
      )
    ).toBe(true)
  })
}

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
  await expect(page.locator('.ant-statistic-content')).toHaveText('13/13')
  fixture.deny()
  await page.getByRole('button', { name: 'Recheck', exact: true }).click()
  await expect(page.locator('.ant-statistic-content')).toHaveText('0/13')
  await expect(
    page.getByText('Needs action: 0 · Unable to check: 0 · No permission: 13')
  ).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Contact settings' })).toHaveCount(0)
  await expect(page.getByText(/Default currency:/)).toHaveCount(0)
})

test('Chinese dark guide remains readable on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAdminSession(page, ['settings.read'])
  await mockCommerce(page, true)
  await page.goto(path('/welcome'))
  await expect(page.getByText('已通过检查项')).toBeVisible()
  await expect(page.locator('.ant-statistic-content')).toHaveText('10/13')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByText('1. 基础与联系方式')).toBeVisible()
  await expect(
    page.locator('.ant-collapse-header').filter({ hasText: '1. 基础与联系方式' })
  ).toHaveAttribute('aria-expanded', 'false')
  await expect(
    page.locator('.ant-collapse-header').filter({ hasText: '2. 准备商品' })
  ).toHaveAttribute('aria-expanded', 'true')
  await expect(
    page.locator('.ant-collapse-header').filter({ hasText: '6. 上线前复核' })
  ).toHaveAttribute('aria-expanded', 'true')
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.ant-layout-content')].every(
        (element) => element.scrollWidth <= element.clientWidth
      )
    )
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('guide-mobile-zh-dark.png'), fullPage: true })
  await expect(page.getByRole('button', { name: '折叠指南', exact: true })).toHaveCount(0)
  await page.getByText('1. 基础与联系方式', { exact: true }).click()
  await expect(page.getByRole('link', { name: '联系方式设置' })).toHaveClass(/ant-btn-default/)
  await page.getByText('5. 店面与政策', { exact: true }).click()
  await page.getByRole('link', { name: '政策设置' }).scrollIntoViewIfNeeded()
  await expect(page.getByText('预览店面并确认品牌内容与政策正文。')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('guide-mobile-zh-dark-policies.png'),
    fullPage: true,
  })
})
