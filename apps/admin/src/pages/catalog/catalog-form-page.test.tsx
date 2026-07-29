import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { CatalogFormPage } from './catalog-form-page'

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

const detail = {
  product: {
    id: 'product-001',
    slug: 'carry-on',
    name: 'Carry-on',
    description: 'International carry-on',
    status: 'draft',
    seo_title: 'Carry-on suitcase',
    seo_description: 'Shop a lightweight international carry-on.',
  },
  variants: [
    {
      id: 'variant-001',
      sku: 'CASE-CARRY-BLK',
      title: 'Black',
      option_values_json: '{"color":"Black"}',
      weight_grams: 2900,
    },
  ],
  prices: [
    {
      amount: 12900,
      currency: 'USD',
      price_list_code: 'GLOBAL-USD',
      variant_id: 'variant-001',
    },
  ],
  media: [
    {
      alt_text: 'Black carry-on',
      height: 1200,
      r2_key: 'catalog/products/carry-on.webp',
      width: 1200,
    },
  ],
}

const server = setupServer(
  http.get('*/admin/catalog/products/product-001', () => HttpResponse.json({ data: detail }))
)

const renderReadonly = () =>
  render(
    <MemoryRouter initialEntries={['/catalog/products/form?mode=readonly&id=product-001']}>
      <AuthProvider>
        <ThemeProvider>
          <CatalogFormPage />
        </ThemeProvider>
      </AuthProvider>
    </MemoryRouter>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('CatalogFormPage', () => {
  it('loads a product in readonly mode without mutation controls', async () => {
    renderReadonly()
    await waitFor(() => expect(screen.getByDisplayValue('Carry-on')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('shows the standard not-found state when detail loading fails', async () => {
    server.use(
      http.get('*/admin/catalog/products/product-001', () =>
        HttpResponse.json(
          { error: { code: 'product_not_found', message: 'The product was not found.' } },
          { status: 404 }
        )
      )
    )
    renderReadonly()
    await waitFor(() => expect(screen.getByText('请返回列表重新选择记录。')).toBeTruthy())
  })
})
