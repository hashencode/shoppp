import React from 'react'
import { afterEach, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { ShippingSettingsPage } from '../pages/settings/shipping-settings-page'
import { FulfillmentPage } from '../pages/fulfillment/fulfillment-page'
import { PrivacyPage } from '../pages/privacy/privacy-page'
import { PoliciesPage } from '../pages/settings/policies-page'
import { UserDetailPage } from '../pages/iam/user-detail-page'
import { CatalogFormPage } from '../pages/catalog/catalog-form-page'
import { installBrowserApi, renderI18nBrowser } from './i18n-browser-fixture'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
  localStorage.clear()
})

const zone = { id: 'zone-1', name: 'ROW-1', countries: ['US'], status: 'active', methods: [] }
const order = {
  publicReference: 'ROW-1',
  email: 'shopper@example.test',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  createdAt: '2026-10-01T00:00:00Z',
  currency: 'USD',
  grandTotal: 100,
  orderStatus: 'confirmed',
}
const privacy = {
  id: 'privacy-1',
  subjectReference: 'ROW-1',
  type: 'access',
  status: 'completed',
  decision: 'export_created',
  completedAt: '2026-10-01T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
  expiresAt: null,
}

it.each(['shipping', 'fulfillment', 'privacy'] as const)(
  'uses real table controls without paginating or rereading the %s list',
  async (kind) => {
    const rows = Array.from({ length: 31 }, (_, index) =>
      kind === 'shipping'
        ? { ...zone, id: `zone-${index}`, name: `ROW-${index}` }
        : kind === 'fulfillment'
          ? { ...order, publicReference: `ROW-${index}` }
          : { ...privacy, id: `privacy-${index}`, subjectReference: `ROW-${index}` }
    )
    transport = installBrowserApi((request) => {
      const url = {
        shipping: '/admin/settings/shipping',
        fulfillment: '/admin/orders',
        privacy: '/admin/privacy/requests',
      }[kind]
      if (request.method === 'get' && request.url === url)
        return {
          data: {
            data: rows,
            ...(kind === 'fulfillment' ? { meta: { page: 1, pageSize: 100, total: 31 } } : {}),
          },
        }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter>
        {kind === 'shipping' ? (
          <ShippingSettingsPage />
        ) : kind === 'fulfillment' ? (
          <FulfillmentPage />
        ) : (
          <PrivacyPage />
        )}
      </MemoryRouter>,
      ['settings.read', 'orders.read', 'privacy.manage'],
      'en-US'
    )
    await screen.findByText('ROW-30')
    const row = document.querySelector('.ant-table-row')!
    const originalHeight = row.getBoundingClientRect().height
    await page.getByRole('button', { name: 'Density', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Compact', exact: true }).click()
    await waitFor(() => expect(row.getBoundingClientRect().height).toBeLessThan(originalHeight))
    await page.getByRole('button', { name: 'Column settings', exact: true }).click()
    const label = { shipping: 'Countries', fulfillment: 'Customer', privacy: 'Request type' }[kind]
    await page.getByRole('checkbox', { name: label, exact: true }).uncheck()
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: label })).toBeNull())
    await page.getByRole('checkbox', { name: label, exact: true }).check()
    await screen.findByRole('columnheader', { name: label })
    expect(transport.requests).toHaveLength(1)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  }
)

const policy = {
  id: 'policy.returns',
  kind: 'returns',
  status: 'draft',
  title: 'Returns policy',
  slug: 'returns',
  version: 1,
  effectiveDate: '2026-10-01',
  sections: [{ id: 'summary', kind: 'paragraph', text: 'Returns in 30 days.' }],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}
const role = {
  id: 'role_support',
  key: 'support',
  name: 'Support',
  description: '',
  permissions: ['iam.users.read'],
  enabled: true,
  protected: false,
  system: false,
  version: 1,
}
const user = {
  id: 'identity_target',
  displayName: 'Target user',
  email: 'user@example.test',
  role,
  status: 'active',
  version: 2,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

it.each(['policy', 'user'] as const)(
  'validates and resets the %s form from its fixed toolbar',
  async (kind) => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/settings/policies')
        return { data: { data: [policy] } }
      if (request.method === 'get' && request.url === '/admin/iam/users/identity_target')
        return { data: { data: user } }
      if (request.method === 'get' && request.url === '/admin/iam/roles')
        return { data: { data: { items: [role], page: 1, pageSize: 100, total: 1 } } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/access/users/identity_target']}>
        <Routes>
          <Route
            path="/access/users/:id"
            element={kind === 'policy' ? <PoliciesPage /> : <UserDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
      ['policies.read', 'policies.write', 'iam.users.read', 'iam.users.write', 'iam.roles.read'],
      'en-US'
    )
    const label = kind === 'policy' ? 'Title' : 'Display name'
    const value = kind === 'policy' ? policy.title : user.displayName
    await screen.findByDisplayValue(value)
    const input = screen.getByLabelText(label)
    expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(800)
    const toolbar = document.querySelector('.ax-fixed-toolbar')!
    expect(getComputedStyle(toolbar).position).toBe('fixed')
    expect(Math.round(toolbar.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    await page.getByLabel(label, { exact: true }).fill('')
    await page
      .getByRole('button', { name: kind === 'policy' ? 'Save draft' : 'Save', exact: true })
      .click()
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    await waitFor(() => expect(document.activeElement).toBe(input))
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await waitFor(() =>
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value)
    )
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).not.toBe('true')
    expect(transport.requests.every((request) => request.method === 'get')).toBe(true)
  }
)

it('keeps ordinary product fields compact with native validation and a visible fixed toolbar', async () => {
  transport = installBrowserApi((request) => {
    throw new Error(`Unexpected request ${request.method} ${request.url}`)
  })
  renderI18nBrowser(
    <MemoryRouter initialEntries={['/catalog/products/form?mode=add']}>
      <CatalogFormPage />
    </MemoryRouter>,
    ['catalog.read', 'catalog.write'],
    'en-US'
  )
  const input = await screen.findByLabelText('Name')
  for (const label of ['Name', 'SKU', 'SEO title']) {
    const field = screen.getByLabelText(label)
    expect(field.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(field.getBoundingClientRect().width).toBeLessThanOrEqual(800)
    expect(getComputedStyle(field.closest('.ant-card-body')!).maxWidth).toBe('800px')
    expect(field.closest('.ant-card')!.getBoundingClientRect().width).toBeGreaterThan(
      field.getBoundingClientRect().width
    )
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
  await waitFor(() => expect(document.activeElement).toBe(input))
  const bounds = input.getBoundingClientRect()
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThan(
    document.querySelector('.ax-fixed-toolbar')!.getBoundingClientRect().top
  )
  expect(transport.requests).toHaveLength(0)
})
