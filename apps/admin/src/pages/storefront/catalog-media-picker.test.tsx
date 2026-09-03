import React, { useState } from 'react'
import type { AssetReference } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useI18n } from '../../shared/contexts/i18n-context'
import { renderInLocale } from '../../test/render-in-locale'
import { CatalogMediaPicker } from './catalog-media-picker'

void React
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
const original: AssetReference = {
  kind: 'theme',
  path: 'assets/hero.webp',
  alt: 'Original hero',
  width: 800,
  height: 600,
}
const item = {
  kind: 'catalog',
  key: 'catalog/merchant.webp',
  alt: 'Merchant English 中文',
  productName: 'Real Product / 名字',
  src: 'https://media.example.test/merchant.webp',
  width: 800,
  height: 600,
}
const requests: URL[] = []
let failed = false
const server = setupServer(
  http.get('*/admin/storefront-experiences/media', ({ request }) => {
    const url = new URL(request.url)
    requests.push(url)
    if (failed)
      return HttpResponse.json(
        { error: { code: 'unknown-media', message: 'Private failure sentence' } },
        { status: 503 }
      )
    return HttpResponse.json({
      data: url.searchParams.get('query') === 'none' ? [] : [item],
      meta: { total: 13 },
    })
  })
)
const Harness = () => {
  const [value, setValue] = useState<AssetReference>(original)
  const { locale, setLocale } = useI18n()
  return (
    <>
      <button onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
        Switch language
      </button>
      <CatalogMediaPicker
        defaultValue={original}
        disabled={false}
        label="hero image"
        onChange={setValue}
        value={value}
      />
      <output>{JSON.stringify(value)}</output>
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

describe('CatalogMediaPicker', () => {
  it('should search, select, page, reset and keep query and selection on language changes', async () => {
    renderInLocale(<Harness />, 'zh-CN')
    await screen.findByRole('button', { name: '选择 Merchant English 中文' })
    fireEvent.click(screen.getByRole('button', { name: '选择 Merchant English 中文' }))
    expect(screen.getByText('Real Product / 名字')).toBeTruthy()
    const search = screen.getByRole('searchbox', { name: 'hero image 搜索已批准的商品目录媒体' })
    fireEvent.change(search, { target: { value: 'merchant' } })
    fireEvent.click(screen.getByRole('button', { name: /^查\s*询$/ }))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('query')).toBe('merchant'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '下一页媒体' }).hasAttribute('disabled')).toBe(
        false
      )
    )
    fireEvent.click(screen.getByRole('button', { name: '下一页媒体' }))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('page')).toBe('2'))
    await screen.findByRole('button', { name: '选择 Merchant English 中文' })
    const count = requests.length
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(requests).toHaveLength(count)
    expect(
      (
        screen.getByRole('searchbox', {
          name: 'hero image Search approved Catalog media',
        }) as HTMLInputElement
      ).value
    ).toBe('merchant')
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('catalog/merchant.webp')
    fireEvent.click(screen.getByRole('button', { name: 'Reset hero image' }))
    expect(screen.getByRole('status').textContent).toContain('assets/hero.webp')
    fireEvent.change(search, { target: { value: 'none' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('No approved Catalog media matches this search.')
    fireEvent.click(screen.getByLabelText('Clear search'))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('query')).toBe(''))
  })
  it('should localize persistent failures and retry without exposing server prose', async () => {
    failed = true
    renderInLocale(<Harness />, 'en-US')
    await screen.findByText('Catalog media could not be loaded')
    const count = requests.length
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await screen.findByText('无法加载商品目录媒体')
    expect(screen.getByText('请求失败，请稍后重试。')).toBeTruthy()
    expect(screen.queryByText('Private failure sentence')).toBeNull()
    expect(requests).toHaveLength(count)
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '重试加载媒体' }))
    await screen.findByRole('button', { name: '选择 Merchant English 中文' })
  })
})
