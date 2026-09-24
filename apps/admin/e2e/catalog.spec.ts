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
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByPlaceholder('Publication reason').fill('Approved representative seed product')
  await page.locator('.ant-modal').getByRole('button', { name: 'Publish', exact: true }).click()

  await expect(page.getByText('Build started: build-e2e-001')).toBeVisible()
  expect(publishCount).toBe(1)
})

test('operator can author ordered product swatches without rewriting variants', async ({
  page,
}) => {
  await mockAdminSession(page)
  const optionDefinitions = [
    {
      name: 'Color',
      presentation: 'color',
      values: [
        { label: 'Blue', swatch: '#5881bf' },
        { label: 'Green', swatch: '#87a968' },
      ],
    },
    {
      name: 'Size',
      presentation: 'text',
      values: [{ label: 'M' }, { label: 'XL' }],
    },
  ]
  const variants = [
    {
      id: 'variant-blue-m',
      sku: 'CASE-BLUE-M',
      title: 'Blue / M',
      option_values_json: '{"Color":"Blue","Size":"M"}',
      weight_grams: 2900,
    },
    {
      id: 'variant-green-xl',
      sku: 'CASE-GREEN-XL',
      title: 'Green / XL',
      option_values_json: '{"Color":"Green","Size":"XL"}',
      weight_grams: 2950,
    },
  ]
  let patchBody: unknown
  let presentationPatchBody: unknown
  let fullProductWriteCount = 0
  await page.route('**/admin/catalog/products/product-e2e-001', async (route) => {
    if (route.request().method() !== 'GET') {
      fullProductWriteCount += 1
      await route.abort()
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: {
          product: {
            id: 'product-e2e-001',
            slug: 'carry-on',
            name: 'Carry-on',
            option_definitions_json: JSON.stringify(optionDefinitions),
            presentation_json: JSON.stringify({
              brand: 'Zalando',
              defaultVariantId: 'variant-blue-m',
              detail: { bullets: ['Durable shell'], heading: 'Designed for the journey' },
              detailMediaId: 'media-blue',
              specifications: [
                { label: 'Material', value: 'Polycarbonate' },
                { label: 'Capacity', value: '38 L' },
              ],
            }),
            description: 'International carry-on',
            status: 'draft',
            seo_title: 'Carry-on suitcase',
            seo_description: 'Shop a lightweight international carry-on.',
            updated_at: '2026-09-16T03:00:00.000Z',
            version: 3,
          },
          variants,
          prices: variants.map((variant, index) => ({
            amount: 12900 + index,
            compare_at_amount: 15900,
            currency: 'USD',
            price_list_code: 'GLOBAL-USD',
            variant_id: variant.id,
          })),
          media: [
            {
              alt_text: 'Blue carry-on',
              height: 1200,
              id: 'media-blue',
              r2_key: 'catalog/products/carry-on.webp',
              width: 1200,
            },
          ],
        },
      },
    })
  })
  await page.route(
    '**/admin/catalog/products/product-e2e-001/option-definitions',
    async (route) => {
      patchBody = await route.request().postDataJSON()
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            id: 'product-e2e-001',
            optionDefinitions: (patchBody as { optionDefinitions: unknown }).optionDefinitions,
            status: 'draft',
            version: 4,
          },
        },
      })
    }
  )
  await page.route(
    '**/admin/catalog/products/product-e2e-001/presentation',
    async (route) => {
      presentationPatchBody = await route.request().postDataJSON()
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            presentation: (presentationPatchBody as { presentation: unknown }).presentation,
            version: 5,
          },
        },
      })
    }
  )

  await page.goto('/catalog/products/form?mode=modify&id=product-e2e-001')

  await expect(page.getByRole('region', { name: 'Option presentation' })).toBeVisible()
  await expect(page.getByText('XL', { exact: true })).toBeVisible()
  const blueSwatch = page.getByLabel('Color Blue swatch')
  await expect(blueSwatch).toHaveValue('#5881bf')
  await blueSwatch.fill('#ABCDEF')
  await page.getByRole('button', { name: 'Save option presentation' }).click()

  await expect(page.getByText('Option presentation saved')).toBeVisible()
  expect(patchBody).toMatchObject({
    expectedVersion: 3,
    optionDefinitions: [
      {
        name: 'Color',
        presentation: 'color',
        values: [
          { label: 'Blue', swatch: '#abcdef' },
          { label: 'Green', swatch: '#87a968' },
        ],
      },
      { name: 'Size', presentation: 'text' },
    ],
  })
  await expect(page.getByRole('region', { name: 'Product presentation' })).toBeVisible()
  await page.getByLabel('Brand').fill('Shoppp')
  await page.getByRole('button', { name: 'Move specification up 2' }).click()
  await page.getByRole('button', { name: 'Save product presentation' }).click()
  await expect(page.getByText('Product presentation saved')).toBeVisible()
  expect(presentationPatchBody).toMatchObject({
    expectedVersion: 4,
    presentation: {
      brand: 'Shoppp',
      defaultVariantId: 'variant-blue-m',
      detailMediaId: 'media-blue',
      specifications: [
        { label: 'Capacity', value: '38 L' },
        { label: 'Material', value: 'Polycarbonate' },
      ],
    },
  })
  expect(fullProductWriteCount).toBe(0)
})
