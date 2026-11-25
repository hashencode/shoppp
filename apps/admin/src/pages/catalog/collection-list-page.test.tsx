import React from 'react'
import { App, ConfigProvider } from 'antd'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { CollectionListPage } from './collection-list-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const collection = {
  candidate: {
    candidateDigest: 'a'.repeat(64),
    candidateReleaseId: 'candidate-001',
    candidateStaleCause: null,
    liveDigest: null,
    liveReleaseId: null,
    liveStaleCause: 'saved_version_newer',
  },
  coverAssetId: null,
  createdAt: '2026-09-23T00:00:00.000Z',
  description: 'Travel products',
  id: 'collection-001',
  name: 'Travel',
  productIds: ['product-001'],
  products: [{ id: 'product-001', name: 'Carry-on', position: 0, slug: 'carry-on' }],
  publishedAt: null,
  seo: { description: 'Travel products', title: 'Travel' },
  slug: 'travel',
  status: 'draft',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 2,
}

const TestListPage = () => (
  <ConfigProvider theme={{ token: { motion: false } }}>
    <App>
      <CollectionListPage />
    </App>
  </ConfigProvider>
)
let reads = 0
let submitted: unknown
let failSave = false
let requestedProductId: string | null = null
const server = setupServer(
  http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
  http.get('*/admin/catalog/collections/collection-001', () =>
    HttpResponse.json({ data: collection })
  ),
  http.get('*/admin/catalog/products', () =>
    HttpResponse.json({ data: collection.products, meta: { total: 1 } })
  ),
  http.put('*/admin/catalog/collections/collection-001', async ({ request }) => {
    submitted = await request.json()
    return failSave
      ? HttpResponse.json(
          { error: { code: 'conflict', message: 'Keep this collection draft' } },
          { status: 409 }
        )
      : HttpResponse.json({ data: { ...collection, version: 3 } })
  }),
  http.get('*/admin/catalog/collections', ({ request }) => {
    reads += 1
    requestedProductId = new URL(request.url).searchParams.get('productId')
    return HttpResponse.json({
      data: [collection],
      meta: { total: 1 },
    })
  })
)

const LocationProbe = () => {
  const location = useLocation()
  return (
    <div>
      {location.pathname}
      {location.search}
    </div>
  )
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  reads = 0
  submitted = undefined
  failSave = false
  requestedProductId = null
  server.resetHandlers()
})
afterAll(() => server.close())

describe('CollectionListPage', () => {
  it('saves the full collection from its drawer and refreshes the same list once', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
        <ThemeProvider>
          <MemoryRouter>
            <TestListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('Travel')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const drawer = await screen.findByRole('dialog')
    expect(drawer.querySelector('.ant-drawer-title')?.textContent).toBe('Collection')
    await within(drawer).findByLabelText('Name')
    fireEvent.change(within(drawer).getByLabelText('Name'), { target: { value: 'Updated Travel' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    await screen.findAllByText('Collection saved')
    expect(submitted).toEqual({
      coverAssetId: null,
      description: 'Travel products',
      expectedVersion: 2,
      name: 'Updated Travel',
      productIds: ['product-001'],
      reason: '',
      redirectFromOldSlug: false,
      seoDescription: 'Travel products',
      seoTitle: 'Travel',
      slug: 'travel',
      status: 'draft',
    })
    await waitFor(() => expect(reads).toBe(2))
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    fireEvent.click(
      within(document.querySelector('.ant-modal-confirm-success') as HTMLElement).getByRole(
        'button',
        { name: 'Confirm' }
      )
    )
    expect(reads).toBe(2)
  })

  it('keeps failed collection edits inside the drawer without refreshing or replaying the write', async () => {
    failSave = true
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
        <ThemeProvider>
          <MemoryRouter>
            <TestListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('Travel')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const drawer = await screen.findByRole('dialog')
    expect(drawer.querySelector('.ant-drawer-title')?.textContent).toBe('Collection')
    const name = await within(drawer).findByLabelText('Name')
    fireEvent.change(name, { target: { value: 'Retained draft' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    await within(drawer).findByText('Keep this collection draft')
    expect((name as HTMLInputElement).value).toBe('Retained draft')
    expect(reads).toBe(1)
  })

  it('filters by the handed-off Product and retains the Product return target', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
        <ThemeProvider>
          <MemoryRouter
            initialEntries={[
              '/catalog/collections?handoffProductId=product-001&returnTo=%2Fcatalog%2Fproducts%2Fform%3Fmode%3Dmodify%26id%3Dproduct-001',
            ]}
          >
            <Routes>
              <Route path="/catalog/collections" element={<TestListPage />} />
              <Route path="/catalog/collections/form" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )

    await waitFor(() => expect(requestedProductId).toBe('product-001'))
    expect(screen.getByText('Carry-on')).toBeTruthy()
    expect(
      screen.getByText('Showing Collections that contain the selected Product').closest('.ant-card')
    ).toBeNull()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.queryByText(/Candidate included/)).toBeNull()
    expect(screen.queryByText('Live stale: saved version is newer')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const drawer = await screen.findByRole('dialog')
    expect(drawer.querySelector('.ant-drawer-title')?.textContent).toBe('Collection')
    expect(((await within(drawer).findByLabelText('Name')) as HTMLInputElement).value).toBe(
      'Travel'
    )
    expect(within(drawer).getByText('Carry-on')).toBeTruthy()
    expect(screen.queryByText('/catalog/collections/form?mode=modify')).toBeNull()
  })

  it('shows all Collections without dropping the Product handoff context', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read', 'catalog.write', 'catalog.publish']}>
        <ThemeProvider>
          <MemoryRouter
            initialEntries={[
              '/catalog/collections?handoffProductId=product-001&returnTo=%2Fcatalog%2Fproducts%2Fform%3Fmode%3Dmodify%26id%3Dproduct-001',
            ]}
          >
            <Routes>
              <Route path="/catalog/collections" element={<TestListPage />} />
              <Route path="/catalog/collections/form" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await waitFor(() => expect(requestedProductId).toBe('product-001'))
    fireEvent.click(screen.getByRole('button', { name: 'Show all Collections' }))
    await waitFor(() => expect(requestedProductId).toBeNull())
    expect(screen.getByText('Choose any Collection to add the selected Product')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const drawer = await screen.findByRole('dialog')
    expect(drawer.querySelector('.ant-drawer-title')?.textContent).toBe('Collection')
    expect(((await within(drawer).findByLabelText('Name')) as HTMLInputElement).value).toBe(
      'Travel'
    )
    expect(within(drawer).getByText('Carry-on')).toBeTruthy()
    expect(screen.queryByText('/catalog/collections/form?mode=modify')).toBeNull()
  })

  it('hides Collection mutation actions without catalog.write', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <TestListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    expect(await screen.findByText('Travel')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'New collection' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()
  })
})
