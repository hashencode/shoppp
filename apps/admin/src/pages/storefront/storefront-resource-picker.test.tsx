import React, { useState } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useI18n } from '../../shared/contexts/i18n-context'
import { renderInLocale } from '../../test/render-in-locale'
import { StorefrontResourcePicker } from './storefront-resource-picker'

void React
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
const selected = {
  id: 'outside-results',
  kind: 'product' as const,
  name: 'Merchant original',
  path: '/products/original',
}
const replacement = {
  id: 'replacement-id',
  kind: 'product' as const,
  name: 'New Product 中文',
  path: '/products/new-path',
}
const requests: URL[] = []
let failed = false
const server = setupServer(
  http.get('*/admin/storefront-experiences/catalog-releases/:id/resources', ({ request }) => {
    const url = new URL(request.url)
    requests.push(url)
    if (failed)
      return HttpResponse.json(
        { error: { code: 'catalog_release_unavailable', message: 'Raw private sentence' } },
        { status: 422 }
      )
    return HttpResponse.json({
      data: url.searchParams.get('query') === 'none' ? [] : [replacement],
      page: Number(url.searchParams.get('page')),
      pageSize: 12,
      total: 13,
    })
  })
)
const Harness = () => {
  const [value, setValue] = useState<string | undefined>(selected.id)
  const [missing, setMissing] = useState(false)
  const { locale, setLocale } = useI18n()
  return (
    <>
      <button onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
        Switch language
      </button>
      <button onClick={() => setMissing(true)}>Lose reference</button>
      <StorefrontResourcePicker
        disabled={false}
        kind="product"
        label="Featured product"
        missing={missing}
        onChange={(next) => {
          setValue(next)
          setMissing(false)
        }}
        releaseId="release-A"
        selected={value === selected.id ? selected : undefined}
        value={value}
      />
      <output>{value ?? 'cleared'}</output>
    </>
  )
}
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  requests.length = 0
  failed = false
  server.resetHandlers()
})
afterAll(() => server.close())

describe('StorefrontResourcePicker', () => {
  it('should retain an off-page selection, search and pagination through language changes and clear selection', async () => {
    renderInLocale(<Harness />, 'zh-CN')
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Featured product' }).hasAttribute('disabled')
      ).toBe(false)
    )
    expect(screen.getByText('Merchant original · /products/original')).toBeTruthy()
    const search = screen.getByRole('searchbox', { name: 'Featured product 搜索' })
    fireEvent.change(search, { target: { value: 'merchant' } })
    fireEvent.click(screen.getByRole('button', { name: /^查\s*询$/ }))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('query')).toBe('merchant'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '下一页引用' }).hasAttribute('disabled')).toBe(
        false
      )
    )
    fireEvent.click(screen.getByRole('button', { name: '下一页引用' }))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('page')).toBe('2'))
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Featured product' }).hasAttribute('disabled')
      ).toBe(false)
    )
    const count = requests.length
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(requests).toHaveLength(count)
    expect(
      (screen.getByRole('searchbox', { name: 'Featured product Search' }) as HTMLInputElement).value
    ).toBe('merchant')
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(screen.getByText('Merchant original · /products/original')).toBeTruthy()
    fireEvent.mouseDown(screen.getByLabelText('Clear selection'))
    expect(screen.getByRole('status').textContent).toBe('cleared')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Featured product' }))
    fireEvent.click((await screen.findAllByText('New Product 中文 · /products/new-path')).at(-1)!)
    expect(screen.getByRole('status').textContent).toBe('replacement-id')
    fireEvent.change(search, { target: { value: 'none' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('No matching Product references.')
  })

  it('should retranslate a failed request and recover missing references using the existing selector', async () => {
    failed = true
    renderInLocale(<Harness />, 'en-US')
    await screen.findByText('References could not be loaded')
    const count = requests.length
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await screen.findByText('无法加载引用')
    expect(screen.getByText('请选择已部署的商品目录版本。')).toBeTruthy()
    expect(requests).toHaveLength(count)
    expect(screen.queryByText('Raw private sentence')).toBeNull()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '重试加载引用' }))
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Featured product' }).hasAttribute('disabled')
      ).toBe(false)
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lose reference' }))
    await screen.findByText('当前版本中缺少所选引用，请选择替代项。')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Featured product' }))
    fireEvent.click((await screen.findAllByText('New Product 中文 · /products/new-path')).at(-1)!)
    expect(screen.getByRole('status').textContent).toBe('replacement-id')
    expect(screen.queryByText('当前版本中缺少所选引用，请选择替代项。')).toBeNull()
  })
})
