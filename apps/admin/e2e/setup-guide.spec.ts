import { expect, test } from '@playwright/test'
import type { SetupGuideDestinations } from '@shoppp/contracts'
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
  ],
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
  test(`permission-aware setup index exposes direct authority links on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.route('**/api/admin/settings/setup-guide/destinations', (route) =>
      route.fulfill({ json: { data: guide } })
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
    await expect(page.getByRole('link', { name: 'Store identity' })).toHaveAttribute(
      'href',
      `${appBase}/settings/identity?from=setup-guide`
    )
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
    await expect(page.getByText('Passed automatic checks')).toHaveCount(0)

    await page.getByRole('link', { name: 'Products' }).click()
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
  await page.goto(path('/welcome'))

  await expect(page.getByText('Setup destinations could not be loaded')).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('link', { name: 'Store identity' })).toBeVisible()
})
