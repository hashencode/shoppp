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
  http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
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
          <MemoryRouter initialEntries={[entry]}>
            <CollectionFormPage />
          </MemoryRouter>
        </App>
      </ThemeProvider>
    </AuthTestProvider>
  )

describe('CollectionFormPage', () => {
  it('shows a published collection as a future source and keeps historical deployment in closed details', async () => {
    server.use(
      http.get('*/admin/catalog/collections/collection-001', () =>
        HttpResponse.json({
          data: {
            ...collection,
            status: 'published',
            candidate: {
              ...collection.candidate,
              liveReleaseId: 'historical-release',
              liveStaleCause: null,
            },
          },
        })
      )
    )
    renderPage('/catalog/collections/form?mode=readonly&id=collection-001')
    expect(
      await screen.findByText('发布后，此系列可供后续店铺版本使用；当前店铺展示不变。')
    ).toBeTruthy()
    expect(screen.getByText('系列版本详情').closest('details')?.open).toBe(false)
    expect(screen.getByText('此来源曾被已部署的店铺版本使用。')).toBeTruthy()
    expect(screen.queryByText('已上线')).toBeNull()
    expect(screen.queryByRole('button', { name: /^保\s*存$/ })).toBeNull()
  })

  it('searches beyond the first media page and submits the selected cover stable ID', async () => {
    const queries: string[] = []
    server.use(
      http.get('*/admin/catalog/collections/media', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query') ?? ''
        queries.push(query)
        return HttpResponse.json({
          data:
            query === 'Archive'
              ? [{ id: 'media.archive-cover', productName: 'Archive', alt: 'Travel cover' }]
              : Array.from({ length: 100 }, (_, index) => ({
                  id: `media.recent-${index}`,
                  productName: 'Recent',
                  alt: `Cover ${index}`,
                })),
        })
      })
    )
    renderPage()
    const cover = await screen.findByRole('combobox', { name: '封面素材' })
    await waitFor(() => expect(queries).toEqual(['']))
    fireEvent.mouseDown(cover)
    fireEvent.change(cover, { target: { value: 'Archive' } })
    fireEvent.click(await screen.findByText('Archive · Travel cover'))
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() =>
      expect(submitted).toMatchObject({ coverAssetId: 'media.archive-cover', expectedVersion: 2 })
    )
    expect(queries).toContain('Archive')
  })

  it('clears an existing cover through the form and submits null', async () => {
    server.use(
      http.get('*/admin/catalog/collections/collection-001', () =>
        HttpResponse.json({ data: { ...collection, coverAssetId: 'media.existing-cover' } })
      ),
      http.get('*/admin/catalog/collections/media', () =>
        HttpResponse.json({
          data: [{ id: 'media.existing-cover', productName: 'Travel', alt: 'Existing cover' }],
        })
      )
    )
    renderPage()
    const cover = await screen.findByRole('combobox', { name: '封面素材' })
    await waitFor(() =>
      expect(cover.closest('.ant-select')?.textContent).toContain('Travel · Existing cover')
    )
    const clear = cover.closest('.ant-select')?.querySelector<HTMLElement>('.ant-select-clear')
    expect(clear).toBeTruthy()
    fireEvent.mouseDown(clear!)
    fireEvent.click(clear!)
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() => expect(submitted).toMatchObject({ coverAssetId: null, expectedVersion: 2 }))
  })

  it('prefills a new English slug and leaves SEO and notes optional', async () => {
    server.use(
      http.post('*/admin/catalog/collections', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: collection }, { status: 201 })
      })
    )
    renderPage('/catalog/collections/form?mode=add')
    const name = await screen.findByLabelText('名称')
    fireEvent.change(name, { target: { value: 'Travel Essentials' } })
    fireEvent.blur(name)
    expect((screen.getByLabelText('标识') as HTMLInputElement).value).toBe('travel-essentials')
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() =>
      expect(submitted).toMatchObject({
        name: 'Travel Essentials',
        slug: 'travel-essentials',
        seoTitle: '',
        reason: '',
        status: 'draft',
      })
    )
  })

  it('still requires a reason for a currently published Collection', async () => {
    server.use(
      http.get('*/admin/catalog/collections/collection-001', () =>
        HttpResponse.json({ data: { ...collection, status: 'published' } })
      )
    )
    renderPage()
    const reason = await screen.findByLabelText('变更原因')
    expect(reason.getAttribute('aria-required')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() => expect(reason.getAttribute('aria-invalid')).toBe('true'))
    expect(submitted).toBeUndefined()
  })

  it('saves ordered membership with the loaded expectedVersion', async () => {
    renderPage()
    expect(await screen.findByText('Carry-on')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '上移Checked luggage' }))
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))
    await waitFor(() =>
      expect(submitted).toMatchObject({
        expectedVersion: 2,
        productIds: ['product-002', 'product-001'],
        reason: '',
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
    fireEvent.change(screen.getByLabelText('备注（选填）'), {
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
    fireEvent.change(screen.getByLabelText('备注（选填）'), {
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
