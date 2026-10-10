import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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

let requestedProductId: string | null = null
const server = setupServer(
  http.get('*/admin/catalog/collections', ({ request }) => {
    requestedProductId = new URL(request.url).searchParams.get('productId')
    return HttpResponse.json({
      data: [
        {
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
        },
      ],
      meta: { total: 1 },
    })
  })
)

const LocationProbe = () => {
  const location = useLocation()
  return <div>{location.pathname}{location.search}</div>
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  requestedProductId = null
  server.resetHandlers()
})
afterAll(() => server.close())

describe('CollectionListPage', () => {
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
              <Route path="/catalog/collections" element={<CollectionListPage />} />
              <Route path="/catalog/collections/form" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )

    await waitFor(() => expect(requestedProductId).toBe('product-001'))
    expect(screen.getByText('Carry-on')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.queryByText(/Candidate included/)).toBeNull()
    expect(screen.queryByText('Live stale: saved version is newer')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(
      await screen.findByText(
        '/catalog/collections/form?mode=modify&id=collection-001&handoffProductId=product-001&returnTo=%2Fcatalog%2Fproducts%2Fform%3Fmode%3Dmodify%26id%3Dproduct-001'
      )
    ).toBeTruthy()
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
              <Route path="/catalog/collections" element={<CollectionListPage />} />
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
    expect(
      await screen.findByText(
        '/catalog/collections/form?mode=modify&id=collection-001&handoffProductId=product-001&returnTo=%2Fcatalog%2Fproducts%2Fform%3Fmode%3Dmodify%26id%3Dproduct-001'
      )
    ).toBeTruthy()
  })

  it('hides Collection mutation actions without catalog.write', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['catalog.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <CollectionListPage />
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
