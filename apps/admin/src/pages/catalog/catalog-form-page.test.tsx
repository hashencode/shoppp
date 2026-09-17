import React from 'react'
import { App } from 'antd'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import type { ProductDetail, ProductDraftPayload } from '../../services/catalog/api'
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

const detail: ProductDetail = {
  product: {
    id: 'product-001',
    slug: 'carry-on',
    name: 'Carry-on',
    option_definitions_json:
      '[{"name":"color","presentation":"text","values":[{"label":"Black"}]}]',
    description: 'International carry-on',
    status: 'draft',
    seo_title: 'Carry-on suitcase',
    seo_description: 'Shop a lightweight international carry-on.',
    updated_at: '2026-09-16T03:00:00.000Z',
    version: 3,
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
      compare_at_amount: 15900,
      currency: 'USD',
      price_list_code: 'GLOBAL-USD',
      variant_id: 'variant-001',
    },
  ],
  media: [
    {
      alt_text: 'Black carry-on',
      height: 1200,
      id: 'media-001',
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
      <AuthTestProvider permissions={['catalog.read']}>
        <ThemeProvider>
          <App>
            <CatalogFormPage />
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    </MemoryRouter>
  )

const renderModify = (productDetail: ProductDetail = detail) => {
  server.use(
    http.get('*/admin/catalog/products/product-001', () =>
      HttpResponse.json({ data: productDetail })
    )
  )
  return render(
    <MemoryRouter initialEntries={['/catalog/products/form?mode=modify&id=product-001']}>
      <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
        <ThemeProvider>
          <App>
            <CatalogFormPage />
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    </MemoryRouter>
  )
}

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

  it('shows every stored variant, price, and media item without allowing a lossy edit', async () => {
    const productDetail: ProductDetail = {
      ...detail,
      product: { ...detail.product, status: 'published' },
      variants: Array.from({ length: 12 }, (_, index) => ({
        id: `variant-${index + 1}`,
        sku: `SKU-${index + 1}`,
        title: `Variant ${index + 1}`,
        option_values_json: JSON.stringify({ color: `Color ${index + 1}` }),
        weight_grams: 100 + index,
      })),
      prices: Array.from({ length: 12 }, (_, index) => ({
        amount: 1000 + index,
        compare_at_amount: 2000 + index,
        currency: 'USD',
        price_list_code: 'GLOBAL-USD',
        variant_id: `variant-${index + 1}`,
      })),
      media: Array.from({ length: 6 }, (_, index) => ({
        alt_text: `Product view ${index + 1}`,
        height: 765,
        id: `media-${index + 1}`,
        r2_key: `catalog/products/view-${index + 1}.jpg`,
        width: 600,
      })),
    }

    renderModify(productDetail)

    expect(await screen.findByText('此商品结构在简化编辑器中为只读。')).toBeTruthy()
    expect(screen.getByText('SKU-12')).toBeTruthy()
    expect(screen.getByText('catalog/products/view-6.jpg')).toBeTruthy()
    expect(screen.getByText(/12 个变体 · 12 个价格 · 6 个媒体项/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /^保\s*存$/ }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it('round-trips compare-at price for an editable single-variant draft', async () => {
    let submitted: ProductDraftPayload | undefined
    server.use(
      http.put('*/admin/catalog/products/product-001', async ({ request }) => {
        submitted = (await request.json()) as ProductDraftPayload
        return HttpResponse.json({ data: { id: 'product-001', status: 'draft' } })
      })
    )
    renderModify()

    const compareAtInput = await screen.findByLabelText('划线价（最小币种单位）')
    expect((compareAtInput as HTMLInputElement).value).toBe('15900')
    fireEvent.change(compareAtInput, { target: { value: '16900' } })
    fireEvent.click(screen.getByRole('button', { name: /^保\s*存$/ }))

    await waitFor(() => expect(submitted?.variants[0]?.prices[0]?.compareAtAmount).toBe(16900))
  })

  it('authors ordered multi-option swatches through the presentation-only endpoint', async () => {
    const optionDetail: ProductDetail = {
      ...detail,
      product: {
        ...detail.product,
        option_definitions_json: JSON.stringify([
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
        ]),
      },
      variants: [
        { ...detail.variants[0]!, option_values_json: '{"Color":"Blue","Size":"M"}' },
        {
          ...detail.variants[0]!,
          id: 'variant-002',
          option_values_json: '{"Color":"Green","Size":"XL"}',
          sku: 'CASE-CARRY-GRN',
          title: 'Green / XL',
        },
      ],
    }
    let submitted: unknown
    server.use(
      http.patch('*/admin/catalog/products/product-001/option-definitions', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({
          data: {
            id: 'product-001',
            optionDefinitions: (submitted as { optionDefinitions: unknown }).optionDefinitions,
            status: 'draft',
            version: 4,
          },
        })
      })
    )
    renderModify(optionDetail)

    const blue = await screen.findByLabelText('Color Blue 色样')
    expect((blue as HTMLInputElement).value).toBe('#5881bf')
    expect(screen.getByText('Green')).toBeTruthy()
    expect(screen.getByText('XL')).toBeTruthy()
    fireEvent.change(blue, { target: { value: '#ABCDEF' } })
    fireEvent.blur(blue)
    fireEvent.click(screen.getByRole('button', { name: '保存选项展示' }))

    await waitFor(() =>
      expect(submitted).toMatchObject({
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
    )
  })

  it('blocks malformed swatches locally and keeps published definitions readonly', async () => {
    const colorDetail: ProductDetail = {
      ...detail,
      product: {
        ...detail.product,
        option_definitions_json:
          '[{"name":"color","presentation":"color","values":[{"label":"Black","swatch":"#111111"}]}]',
      },
    }
    const editableView = renderModify(colorDetail)
    const swatch = await screen.findByLabelText('color Black 色样')
    fireEvent.change(swatch, { target: { value: 'red' } })
    fireEvent.click(screen.getByRole('button', { name: '保存选项展示' }))
    const error = await screen.findByText('请输入 #rrggbb 格式的不透明颜色。')
    expect(swatch.getAttribute('aria-invalid')).toBe('true')
    expect(swatch.getAttribute('aria-describedby')).toBe(error.id)
    editableView.unmount()

    server.resetHandlers()
    const published = {
      ...colorDetail,
      product: { ...colorDetail.product, status: 'published' as const },
    }
    const view = renderModify(published)
    const button = await screen.findByRole('button', { name: '保存选项展示' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    view.unmount()
  })

  it('authors ordered Product presentation through the versioned aggregate endpoint', async () => {
    const presentationDetail: ProductDetail = {
      ...detail,
      product: {
        ...detail.product,
        presentation_json: JSON.stringify({
          brand: 'Zalando',
          defaultVariantId: 'variant-001',
          detail: {
            body: 'Soft structured finish.',
            bullets: ['Organic cotton', 'Relaxed fit'],
            eyebrow: 'Everyday comfort',
            heading: 'Built for daily wear',
          },
          detailMediaId: 'media-001',
          specifications: [
            { label: 'Material', value: 'Organic cotton' },
            { label: 'Fit', value: 'Relaxed' },
          ],
        }),
      },
    }
    let submitted: unknown
    server.use(
      http.patch('*/admin/catalog/products/product-001/presentation', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({
          data: {
            presentation: (submitted as { presentation: unknown }).presentation,
            version: 4,
          },
        })
      })
    )
    renderModify(presentationDetail)

    const brand = await screen.findByLabelText('Brand')
    expect((brand as HTMLInputElement).value).toBe('Zalando')
    fireEvent.change(brand, { target: { value: 'Shoppp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move specification up 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save product presentation' }))

    await waitFor(() =>
      expect(submitted).toMatchObject({
        expectedVersion: 3,
        presentation: {
          brand: 'Shoppp',
          defaultVariantId: 'variant-001',
          detailMediaId: 'media-001',
          specifications: [
            { label: 'Fit', value: 'Relaxed' },
            { label: 'Material', value: 'Organic cotton' },
          ],
        },
      })
    )
  })
})

const ReturnProbe = () => {
  const location = useLocation()
  return (
    <div>
      {location.pathname}
      {location.search}
    </div>
  )
}
it('returns to the catalog list in the same guide journey', async () => {
  render(
    <AuthTestProvider permissions={['catalog.read']}>
      <ThemeProvider>
        <App>
          <MemoryRouter
            initialEntries={[
              '/catalog/products/form?mode=readonly&id=product-001&from=setup-guide',
            ]}
          >
            <Routes>
              <Route path="/catalog/products/form" element={<CatalogFormPage />} />
              <Route path="/catalog/products" element={<ReturnProbe />} />
            </Routes>
          </MemoryRouter>
        </App>
      </ThemeProvider>
    </AuthTestProvider>
  )
  await screen.findByDisplayValue('Carry-on')
  fireEvent.click(screen.getByLabelText('返回'))
  expect(await screen.findByText('/catalog/products?from=setup-guide')).toBeTruthy()
})
