import React from 'react'
import { App } from 'antd'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { CollectionFormPage } from './collection-form-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
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
    candidateReleaseId: 'candidate-1',
    candidateStaleCause: null,
    liveDigest: null,
    liveReleaseId: null,
    liveStaleCause: 'saved_version_newer' as const,
  },
  coverAssetId: null,
  createdAt: '2026-09-23T00:00:00.000Z',
  description: 'Travel products',
  id: 'collection-001',
  name: 'Travel',
  productIds: ['product-001', 'product-002'],
  products: [
    { id: 'product-001', name: 'Carry-on', position: 0, slug: 'carry-on' },
    { id: 'product-002', name: 'Checked luggage', position: 1, slug: 'checked-luggage' },
  ],
  publishedAt: null,
  seo: { description: 'Travel products', title: 'Travel' },
  slug: 'travel',
  status: 'draft' as const,
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 2,
}

let submitted: unknown
const server = setupServer(
  http.get('*/admin/catalog/collections/collection-001', () =>
    HttpResponse.json({ data: collection })
  ),
  http.get('*/admin/catalog/products', () =>
    HttpResponse.json({
      data: [
        { id: 'product-001', name: 'Carry-on', slug: 'carry-on', status: 'draft', version: 1 },
        {
          id: 'product-002',
          name: 'Checked luggage',
          slug: 'checked-luggage',
          status: 'draft',
          version: 1,
        },
      ],
      meta: { total: 2 },
    })
  ),
  http.put('*/admin/catalog/collections/collection-001', async ({ request }) => {
    submitted = await request.json()
    return HttpResponse.json({ data: { ...collection, version: 3 } })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  submitted = undefined
  server.resetHandlers()
})
afterAll(() => server.close())

const renderPage = (entry = '/catalog/collections/form?mode=modify&id=collection-001') =>
  render(
    <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
      <ThemeProvider>
        <App>
          <MemoryRouter
            initialEntries={[entry]}
          >
            <CollectionFormPage />
          </MemoryRouter>
        </App>
      </ThemeProvider>
    </AuthTestProvider>
  )

describe('CollectionFormPage', () => {
  it('saves ordered membership with the loaded expectedVersion', async () => {
    renderPage()
    expect(await screen.findByText('Carry-on')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Move Checked luggage up' }))
    fireEvent.change(screen.getByLabelText('变更原因'), {
      target: { value: 'Prioritize checked luggage' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() =>
      expect(submitted).toMatchObject({
        expectedVersion: 2,
        productIds: ['product-002', 'product-001'],
        reason: 'Prioritize checked luggage',
      })
    )
  })

  it('keeps edited fields when a stale writer is rejected', async () => {
    server.use(
      http.put('*/admin/catalog/collections/collection-001', () =>
        HttpResponse.json(
          { error: { code: 'stale_collection_version', message: 'Reload before saving.' } },
          { status: 409 }
        )
      )
    )
    renderPage()
    const name = await screen.findByLabelText('名称')
    fireEvent.change(name, { target: { value: 'Unsaved travel edit' } })
    fireEvent.change(screen.getByLabelText('变更原因'), {
      target: { value: 'Concurrent edit test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    expect(await screen.findByText('Reload before saving.')).toBeTruthy()
    expect((name as HTMLInputElement).value).toBe('Unsaved travel edit')
  })

  it('merges a handed-off nonmember Product into an existing Collection save', async () => {
    renderPage(
      '/catalog/collections/form?mode=modify&id=collection-001&handoffProductId=product-003'
    )
    expect(await screen.findByText('product-003')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('变更原因'), {
      target: { value: 'Add handed-off Product' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() =>
      expect(submitted).toMatchObject({
        expectedVersion: 2,
        productIds: ['product-001', 'product-002', 'product-003'],
      })
    )
  })
})
