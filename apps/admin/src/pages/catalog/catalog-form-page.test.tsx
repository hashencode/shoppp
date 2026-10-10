import React from 'react'
import { App } from 'antd'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  http.get('*/admin/catalog/products/product-001', () => HttpResponse.json({ data: detail })),
  http.get('*/admin/catalog/products/product-001/revisions', () =>
    HttpResponse.json({ data: { draft: null, productVersion: 3, published: null } })
  )
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

  it('shows read-only Collection membership and guards the filtered management handoff', async () => {
    const collectionDetail: ProductDetail = {
      ...detail,
      collections: [{ id: 'collection-001', name: 'Travel', slug: 'travel' }],
    }
    server.use(
      http.get('*/admin/catalog/products/product-001', () =>
        HttpResponse.json({ data: collectionDetail })
      )
    )
    render(
      <MemoryRouter
        initialEntries={['/catalog/products/form?mode=modify&id=product-001']}
      >
        <AuthTestProvider permissions={['catalog.read', 'catalog.write']}>
          <ThemeProvider>
            <App>
              <Routes>
                <Route path="/catalog/products/form" element={<CatalogFormPage />} />
                <Route path="/catalog/collections" element={<ReturnProbe />} />
              </Routes>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText('Travel')).toBeTruthy()
    expect(screen.queryByLabelText('Collection slugs')).toBeNull()
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Unsaved Carry-on' } })
    fireEvent.click(screen.getByRole('button', { name: '管理商品集合成员关系' }))
    expect((await screen.findAllByText('放弃未保存的商品更改？')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '打开商品集合管理' }))
    expect(
      await screen.findByText(
        '/catalog/collections?handoffProductId=product-001&returnTo=%2Fcatalog%2Fproducts%2Fform%3Fmode%3Dmodify%26id%3Dproduct-001'
      )
    ).toBeTruthy()
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

  it('stages a published Product revision with its own name and ordered media', async () => {
    const published: ProductDetail = {
      ...detail,
      product: { ...detail.product, status: 'published' },
      media: [
        ...detail.media,
        {
          alt_text: 'Carry-on side',
          height: 1200,
          id: 'media-002',
          r2_key: 'catalog/products/carry-on-side.webp',
          width: 1200,
        },
      ],
    }
    let staged: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/catalog/products/product-001/revisions', () =>
        HttpResponse.json({ data: { draft: null, productVersion: 3, published: null } })
      ),
      http.put('*/admin/catalog/products/product-001/revisions/draft', async ({ request }) => {
        staged = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          data: {
            baseProductVersion: 3,
            basePublishedRevisionId: null,
            content: staged.content,
            id: 'revision-001',
            status: 'draft',
            version: 1,
          },
        })
      }),
      http.get('*/admin/catalog/products/product-001/revisions/preview', () =>
        HttpResponse.json({
          data: {
            product: {
              description: 'International carry-on',
              id: 'product-001',
              media: [
                { alt: 'Carry-on side', id: 'media-002', src: 'https://media.example.test/side' },
                { alt: 'Black carry-on', id: 'media-001', src: 'https://media.example.test/front' },
              ],
              name: 'Revised carry-on',
              slug: 'carry-on',
            },
            revisionId: 'revision-001',
            sourceProductVersion: 3,
          },
        })
      )
    )
    renderModify(published)
    const editor = await screen.findByRole('region', { name: '已发布商品修订' })
    fireEvent.change(within(editor).getByLabelText('名称'), {
      target: { value: 'Revised carry-on' },
    })
    fireEvent.click(within(editor).getByRole('checkbox', { name: /款式选项尚未核实/ }))
    fireEvent.change(within(editor).getByLabelText('详情标题'), {
      target: { value: 'Verified appearance' },
    })
    fireEvent.click(within(editor).getByRole('button', { name: '添加规格' }))
    fireEvent.change(within(editor).getByLabelText('规格名称'), {
      target: { value: 'Color' },
    })
    fireEvent.change(within(editor).getByLabelText('规格内容'), {
      target: { value: 'Black' },
    })
    fireEvent.click(within(editor).getAllByRole('button', { name: /下\s*移/ })[0]!)
    fireEvent.click(within(editor).getByRole('button', { name: '保存暂存修订' }))
    await waitFor(() => {
      expect(staged).toMatchObject({
        expectedProductVersion: 3,
        expectedPublishedRevisionId: null,
        content: {
          name: 'Revised carry-on',
          media: [{ id: 'media-002' }, { id: 'media-001' }],
          presentation: {
            purchaseStatus: 'unverified',
            detail: { heading: 'Verified appearance' },
            specifications: [{ label: 'Color', value: 'Black' }],
          },
        },
      })
    })
    fireEvent.click(within(editor).getByRole('button', { name: '检查已保存修订' }))
    expect(await within(editor).findByRole('region', { name: '已保存修订数据' })).toBeTruthy()
  })

  it.each([false, true])('reports only a started revision build or its failure (fails: %s)', async (fails) => {
    const content = { name: 'Revised carry-on', description: 'New description', media: [], seoTitle: '', seoDescription: '', presentation: null }
    let publication: unknown
    server.use(
      http.get('*/admin/catalog/products/product-001', () => HttpResponse.json({ data: { ...detail, product: { ...detail.product, status: 'published' } } })),
      http.get('*/admin/catalog/products/product-001/revisions', () => HttpResponse.json({ data: { draft: { id: 'revision-1', status: 'draft', version: 1, content }, productVersion: 3, published: null } })),
      http.post('*/admin/catalog/products/product-001/revisions/publish', async ({ request }) => {
        publication = await request.json()
        return fails
          ? HttpResponse.json({ error: { code: 'build_failed', message: 'Publication could not start. Retry publishing.' } }, { status: 503 })
          : HttpResponse.json({ data: { releaseId: 'release-1', buildCorrelationId: 'build-1', status: 'queued' } })
      })
    )
    render(<MemoryRouter initialEntries={['/catalog/products/form?mode=modify&id=product-001']}><AuthTestProvider permissions={['catalog.read', 'catalog.write', 'catalog.publish']}><ThemeProvider><App><CatalogFormPage /></App></ThemeProvider></AuthTestProvider></MemoryRouter>)
    const editor = await screen.findByRole('region', { name: '已发布商品修订' })
    await waitFor(() => expect(within(editor).getByLabelText('名称')).toHaveValue('Revised carry-on'))
    fireEvent.change(within(editor).getByLabelText('发布原因'), { target: { value: 'Publish reviewed revision' } })
    fireEvent.click(within(editor).getByRole('button', { name: '发布暂存修订' }))
    await waitFor(() => expect(publication).toMatchObject({ expectedDraftVersion: 1, expectedProductVersion: 3, expectedPublishedRevisionId: null, revisionId: 'revision-1', reason: 'Publish reviewed revision' }))
    if (fails) {
      expect(await within(editor).findByText('Publication could not start. Retry publishing.')).toBeTruthy()
      expect(within(editor).queryByText('修订发布已开始，店铺展示将在部署后更新。')).toBeNull()
    } else {
      expect(await within(editor).findByText('修订发布已开始，店铺展示将在部署后更新。')).toBeTruthy()
    }
    expect(within(editor).queryByText('已上线')).toBeNull()
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

    const brand = await screen.findByLabelText('品牌')
    expect((brand as HTMLInputElement).value).toBe('Zalando')
    fireEvent.change(brand, { target: { value: 'Shoppp' } })
    fireEvent.click(screen.getByRole('button', { name: '上移规格 2' }))
    fireEvent.click(screen.getByRole('button', { name: '保存商品展示' }))

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
