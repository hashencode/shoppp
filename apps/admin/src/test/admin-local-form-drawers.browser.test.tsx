import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogFormPage } from '../pages/catalog/catalog-form-page'
import { CollectionListPage } from '../pages/catalog/collection-list-page'
import { ContactSettingsPage } from '../pages/settings/contact-settings-page'
import type { ProductDetail, CatalogCollection } from '../services/catalog/api'
import { installBrowserApi, renderI18nBrowser } from './i18n-browser-fixture'

void React
let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})

const product: ProductDetail = {
  product: {
    id: 'product-001',
    name: 'Carry-on',
    slug: 'carry-on',
    description: 'Travel companion',
    status: 'draft',
    seo_title: 'Carry-on suitcase',
    seo_description: 'Travel companion',
    updated_at: '2026-10-01T00:00:00Z',
    version: 3,
    option_definitions_json: JSON.stringify([
      { name: 'Color', presentation: 'color', values: [{ label: 'Black', swatch: '#111111' }] },
    ]),
    presentation_json: JSON.stringify({
      brand: 'Studio',
      specifications: [
        {
          label: 'Shell material and protective surface finish',
          value: 'Recycled polycarbonate with a textured scratch-resistant outer shell',
        },
      ],
    }),
  },
  variants: [
    {
      id: 'variant-001',
      sku: 'CASE-CARRY-BLK',
      title: 'Black',
      option_values_json: '{"Color":"Black"}',
      weight_grams: 2900,
    },
  ],
  prices: [
    { amount: 12900, currency: 'USD', price_list_code: 'GLOBAL-USD', variant_id: 'variant-001' },
  ],
  media: [
    {
      id: 'media-001',
      alt_text: 'Black carry-on',
      height: 1200,
      width: 1200,
      r2_key: 'catalog/carry-on.webp',
    },
  ],
}
const collection: CatalogCollection = {
  id: 'collection-001',
  name: 'Travel collection',
  slug: 'travel',
  description: 'Travel products',
  status: 'draft',
  version: 2,
  candidate: {
    candidateDigest: null,
    candidateReleaseId: null,
    candidateStaleCause: null,
    liveDigest: null,
    liveReleaseId: null,
    liveStaleCause: null,
  },
  coverAssetId: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  publishedAt: null,
  redirectFromOldSlug: false,
  seo: { title: 'Travel', description: 'Travel products' },
  productIds: ['product-001'],
  products: [
    {
      id: 'product-001',
      name: 'International carry-on with a removable laptop compartment and expandable storage',
      slug: 'carry-on',
      position: 0,
    },
  ],
}
const contact = {
  supportEmail: 'support@example.test',
  privacyContactEmail: 'privacy@example.test',
  launchVersion: 'launch-v1',
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

const checkDrawerLayout = async () => {
  expect(window.innerWidth).toBeGreaterThanOrEqual(720)
  const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
  const body = document.querySelector('.ant-drawer-body') as HTMLElement
  await waitFor(() => expect(Math.round(wrapper.getBoundingClientRect().width)).toBe(720))
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
  expect(
    document.querySelector('.ant-drawer-footer')!.getBoundingClientRect().bottom
  ).toBeLessThanOrEqual(window.innerHeight + 1)
}

describe('Admin local form drawers', () => {
  it('keeps option drafts on cancelled close, resets them and saves product presentation independently', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/catalog/products/product-001')
        return { data: { data: product } }
      if (
        request.method === 'patch' &&
        request.url === '/admin/catalog/products/product-001/presentation'
      )
        return {
          data: {
            data: { presentation: JSON.parse(request.data as string).presentation, version: 4 },
          },
        }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/catalog/products/form?mode=modify&id=product-001']}>
        <CatalogFormPage />
      </MemoryRouter>,
      ['catalog.read', 'catalog.write'],
      'en-US'
    )
    await page.getByLabel('Name', { exact: true }).fill('Unsaved product draft')
    await page.getByRole('button', { name: 'Edit option presentation', exact: true }).click()
    await expect.element(page.getByLabel('Color Black Swatch')).toHaveValue('#111111')
    await checkDrawerLayout()
    await page.getByLabel('Color Black Swatch').fill('#445566')
    await page.getByRole('dialog', { name: 'Option presentation', exact: true }).press('Escape')
    await page.getByRole('button', { name: 'Continue editing', exact: true }).click()
    await expect.element(page.getByLabel('Color Black Swatch')).toHaveValue('#445566')
    await page
      .getByRole('dialog', { name: 'Option presentation', exact: true })
      .getByRole('button', { name: 'Reset', exact: true })
      .click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.element(page.getByLabel('Color Black Swatch')).toHaveValue('#111111')
    await waitFor(() => {
      const confirmation = document.querySelector<HTMLElement>('.ant-popconfirm')
      expect(!confirmation || getComputedStyle(confirmation).display === 'none').toBe(true)
    })
    await page.getByRole('dialog', { name: 'Option presentation', exact: true }).press('Escape')
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    await page.getByRole('button', { name: 'Edit product presentation', exact: true }).click()
    await expect.element(page.getByLabel('Brand', { exact: true })).toHaveValue('Studio')
    await checkDrawerLayout()
    await page.getByLabel('Brand', { exact: true }).fill('Studio travel equipment')
    await page
      .getByRole('dialog', { name: 'Product presentation', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect
      .element(page.getByRole('dialog', { name: 'Product presentation saved', exact: true }))
      .toBeVisible()
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect
      .element(page.getByLabel('Name', { exact: true }))
      .toHaveValue('Unsaved product draft')
    const writes = transport.requests.filter((request) => request.method !== 'get')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0]!.data as string)).toEqual({
      expectedVersion: 3,
      presentation: {
        brand: 'Studio travel equipment',
        specifications: [
          {
            label: 'Shell material and protective surface finish',
            value: 'Recycled polycarbonate with a textured scratch-resistant outer shell',
          },
        ],
      },
    })
  }, 15_000)

  it('applies a validated location to the page draft without writing until the page is saved', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/settings/contact')
        return { data: { data: contact } }
      if (request.method === 'put' && request.url === '/admin/settings/contact')
        return { data: { data: contact } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter>
        <ContactSettingsPage />
      </MemoryRouter>,
      ['settings.read', 'settings.write'],
      'en-US'
    )
    await page.getByRole('button', { name: 'Add location', exact: true }).click()
    await expect
      .element(page.getByRole('dialog', { name: 'New location', exact: true }))
      .toBeVisible()
    await checkDrawerLayout()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await waitFor(() => expect(document.activeElement?.getAttribute('id')).toContain('name'))
    await page
      .getByLabel('Location name', { exact: true })
      .fill('International customer support and collection showroom')
    await page.getByLabel('City', { exact: true }).fill('Shanghai')
    await page
      .getByLabel('Postal address', { exact: true })
      .fill('123 Test Road, Building 2, First Floor, Customer Collection Desk')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .element(page.getByRole('dialog', { name: 'Location added to unsaved changes', exact: true }))
      .toBeVisible()
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    expect(transport.requests.filter((request) => request.method !== 'get')).toHaveLength(0)
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await page.getByRole('button', { name: 'Edit location', exact: true }).click()
    await expect.element(page.getByLabel('City', { exact: true })).toHaveValue('Shanghai')
    await page.getByRole('dialog', { name: 'Edit location', exact: true }).press('Escape')
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    await page.getByRole('button', { name: 'Save contact settings', exact: true }).click()
    await waitFor(() =>
      expect(transport!.requests.filter((request) => request.method === 'put')).toHaveLength(1)
    )
    const payload = JSON.parse(
      transport.requests.find((request) => request.method === 'put')!.data as string
    )
    expect(payload.profile.locations).toEqual([
      {
        id: expect.any(String),
        name: 'International customer support and collection showroom',
        city: 'Shanghai',
        address: '123 Test Road, Building 2, First Floor, Customer Collection Desk',
        phone: null,
        email: null,
        mapUrl: null,
        visible: false,
      },
    ])
  }, 15_000)

  it('edits a collection over its list, retains long member names and refreshes once after saving', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/catalog/collections')
        return { data: { data: [collection], meta: { total: 1 } } }
      if (request.method === 'get' && request.url === '/admin/catalog/collections/collection-001')
        return { data: { data: collection } }
      if (request.method === 'get' && request.url === '/admin/catalog/collections/media')
        return { data: { data: [] } }
      if (request.method === 'get' && request.url === '/admin/catalog/products')
        return { data: { data: collection.products, meta: { total: 1 } } }
      if (request.method === 'put') return { data: { data: { ...collection, version: 3 } } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/catalog/collections']}>
        <CollectionListPage />
      </MemoryRouter>,
      ['catalog.read', 'catalog.write'],
      'en-US'
    )
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect
      .element(page.getByRole('dialog', { name: 'Collection', exact: true }))
      .toBeVisible()
    await checkDrawerLayout()
    await page.getByLabel('Name', { exact: true }).fill('Travel collection updated')
    await page
      .getByRole('dialog', { name: 'Collection', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect
      .element(page.getByRole('dialog', { name: 'Collection saved', exact: true }))
      .toBeVisible()
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    expect(
      transport.requests.filter((request) => request.url === '/admin/catalog/collections')
    ).toHaveLength(2)
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    expect(
      transport.requests.filter((request) => request.url === '/admin/catalog/collections')
    ).toHaveLength(2)
  }, 15_000)
})
