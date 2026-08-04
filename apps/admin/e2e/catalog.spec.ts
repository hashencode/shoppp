import { expect, test } from '@playwright/test'
import { mockAdminSession } from './support'

test('operator can publish a catalog draft and triggers exactly one build request', async ({
  page,
}) => {
  await mockAdminSession(page)
  let publishCount = 0
  await page.route('**/admin/catalog/products**', async (route) => {
    const request = route.request()
    if (request.url().endsWith('/publish') && request.method() === 'POST') {
      publishCount += 1
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            buildCorrelationId: 'build-e2e-001',
            releaseId: 'release-e2e-001',
            status: 'building',
          },
        },
      })
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: [
          {
            id: 'product-e2e-001',
            name: 'Carry-on',
            slug: 'carry-on',
            status: 'draft',
            updated_at: '2026-07-30T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      },
    })
  })

  await page.goto('/catalog/products')

  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Carry-on', exact: true })).toBeVisible()
  await page.getByText('Publish').click()
  await page.getByPlaceholder('Publication reason').fill('Approved representative seed product')
  await page.locator('.ant-modal').getByRole('button', { name: 'Publish', exact: true }).click()

  await expect(page.getByText('Build started: build-e2e-001')).toBeVisible()
  expect(publishCount).toBe(1)
})
