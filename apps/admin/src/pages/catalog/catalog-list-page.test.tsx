import React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AdminPermission } from '@shoppp/contracts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { CatalogListPage } from './catalog-list-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

let requestCount = 0
let requestedPageSizes: number[] = []
const server = setupServer(
  http.get('*/admin/catalog/products', ({ request }) => {
    requestCount += 1
    requestedPageSizes.push(Number(new URL(request.url).searchParams.get('pageSize')))
    return HttpResponse.json({
      data: [
        {
          id: 'product-001',
          name: 'Carry-on',
          slug: 'carry-on',
          status: 'draft',
          version: 1,
          updated_at: '2026-07-30T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    })
  })
)

const renderPage = (
  permissions: readonly AdminPermission[] = ['catalog.read', 'catalog.write', 'catalog.publish']
) =>
  renderInLocale(
    <AuthTestProvider role="catalog_operator" permissions={permissions}>
      <ThemeProvider>
        <MemoryRouter>
          <CatalogListPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  requestCount = 0
  requestedPageSizes = []
  server.resetHandlers()
})
afterAll(() => server.close())

describe('CatalogListPage', () => {
  it('keeps private store preview preparation out of the product list', async () => {
    renderPage([
      'catalog.read',
      'catalog.publish',
      'identity.read',
      'policies.read',
      'content.read',
      'navigation.read',
      'settings.read',
    ])
    await screen.findByText('Carry-on')
    expect(screen.queryByText('Private preview candidate')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Build preview candidate' })).toBeNull()
  })

  it('should offer only supported page sizes and request at most 100 products', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(requestedPageSizes).toEqual([10])
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Page Size' }))
    await waitFor(() => expect(screen.getByText('100 per page')).toBeTruthy())
    expect(screen.queryByText('All data')).toBeNull()
    fireEvent.click(screen.getByText('100 per page'))

    await waitFor(() => expect(requestedPageSizes).toEqual([10, 100]))
  })

  it('loads products and only queries changed filters after submit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(requestCount).toBe(1)

    fireEvent.change(screen.getByPlaceholderText('Search name or slug'), {
      target: { value: 'carry' },
    })
    expect(requestCount).toBe(1)
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(requestCount).toBe(2))
  })

  it('starts an explicit public build without claiming the storefront is updated', async () => {
    let publication: unknown
    server.use(
      http.post('*/admin/catalog/products/product-001/publish', async ({ request }) => {
        publication = await request.json()
        return HttpResponse.json({
          data: { buildCorrelationId: 'build-1', releaseId: 'release-1', status: 'queued' },
        })
      })
    )
    renderPage()
    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(
      await screen.findByText(
        'Publishing starts a public storefront build. Changes appear only after deployment.'
      )
    ).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Publication reason'), {
      target: { value: 'Publish reviewed product' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!)
    await waitFor(() =>
      expect(publication).toEqual({ reason: 'Publish reviewed product', expectedVersion: 1 })
    )
    expect(
      await screen.findByText(
        'Product publication started. The storefront changes after deployment.'
      )
    ).toBeTruthy()
    expect(screen.queryByText('Deployed to storefront')).toBeNull()
  })

  it('keeps the publication reason after write failure and does not read or resubmit until asked', async () => {
    let writes = 0
    let payload: unknown
    server.use(
      http.post('*/admin/catalog/products/product-001/publish', async ({ request }) => {
        writes += 1
        payload = await request.json()
        return HttpResponse.json(
          { error: { code: 'publication_rejected', message: 'Publication rejected.' } },
          { status: 422 }
        )
      })
    )
    renderPage()
    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    fireEvent.change(screen.getByPlaceholderText('Publication reason'), {
      target: { value: ' Reviewed regional publication ' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!)
    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect((screen.getByPlaceholderText('Publication reason') as HTMLTextAreaElement).value).toBe(
      ' Reviewed regional publication '
    )
    expect(payload).toEqual({ reason: 'Reviewed regional publication', expectedVersion: 1 })
    expect(writes).toBe(1)
    expect(requestCount).toBe(1)
    expect(document.querySelector('.ant-modal-wrap')?.className).not.toContain(
      'ant-modal-wrap-hidden'
    )
  })

  it('hides all mutation actions from a view-only operator', async () => {
    renderPage(['catalog.read'])
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())

    expect(screen.queryByRole('button', { name: 'New product' })).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.queryByText('Publish')).toBeNull()
    expect(screen.getByText('View')).toBeTruthy()
  })
})

const NavigationProbe = () => {
  const location = useLocation()
  return (
    <div>
      {location.pathname}
      {location.search}
    </div>
  )
}
describe('Catalog setup navigation', () => {
  it.each([
    ['New product', 'add'],
    ['Edit', 'modify'],
    ['View', 'readonly'],
  ])('keeps the fixed guide marker for %s in this tab', async (label, mode) => {
    renderInLocale(
      <AuthTestProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/catalog/products?from=setup-guide']}>
            <Routes>
              <Route path="/catalog/products" element={<CatalogListPage />} />
              <Route path="/catalog/products/form" element={<NavigationProbe />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() =>
      expect(
        screen.getByText(
          `/catalog/products/form?mode=${mode}&from=setup-guide${mode === 'add' ? '' : '&id=product-001'}`
        )
      ).toBeTruthy()
    )
  })
})
