import React from 'react'
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
        <CatalogListPage />
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
  it('should offer only supported page sizes and request at most 100 products', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(requestedPageSizes).toEqual([10])

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

  it('hides all mutation actions from a view-only operator', async () => {
    renderPage(['catalog.read'])
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())

    expect(screen.queryByRole('button', { name: 'New product' })).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.queryByText('Publish')).toBeNull()
    expect(screen.getByText('View')).toBeTruthy()
  })
})
