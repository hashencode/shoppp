import React, { useState } from 'react'
import type { StorefrontLink } from '@shoppp/contracts'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { useI18n } from '../../shared/contexts/i18n-context'
import { renderInLocale } from '../../test/render-in-locale'
import { StorefrontLinkEditor } from './storefront-link-editor'

void React
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
const Harness = ({ missing = false }: { missing?: boolean }) => {
  const [value, setValue] = useState<StorefrontLink>({
    label: 'Merchant CTA 中文',
    target: {
      kind: 'internal',
      reference: { id: missing ? 'missing-id' : 'page-shop', kind: 'page' },
    },
    targetBehavior: 'same-window',
  })
  const { locale, setLocale } = useI18n()
  return (
    <>
      <button onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
        Switch language
      </button>
      <StorefrontLinkEditor
        disabled={false}
        label="CTA"
        onChange={setValue}
        allowedTargets={['page', 'article', 'external']}
        resources={[
          { id: 'page-shop', kind: 'page', label: 'Shop 中文', path: '/shop/raw-path' },
          { id: 'article-1', kind: 'article', label: 'Story raw', path: '/journal/story' },
        ]}
        value={value}
      />
      <output>{JSON.stringify(value)}</output>
    </>
  )
}
const choose = async (name: string, option: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name }))
  fireEvent.click((await screen.findAllByText(option)).at(-1)!)
}

describe('StorefrontLinkEditor', () => {
  it('should localize destination controls without translating labels, URLs or target behavior values', async () => {
    renderInLocale(<Harness />, 'zh-CN')
    expect((screen.getByRole('textbox', { name: 'CTA 文字' }) as HTMLInputElement).value).toBe(
      'Merchant CTA 中文'
    )
    expect(screen.getByText('Shop 中文 · /shop/raw-path')).toBeTruthy()
    await choose('CTA 资源类型', '文章')
    expect(screen.getByRole('status').textContent).toContain('"kind":"article"')
    await choose('CTA 目标类型', '外部 HTTPS URL')
    fireEvent.change(screen.getByRole('textbox', { name: 'CTA 外部 URL' }), {
      target: { value: 'https://example.test/raw/path?q=Merchant' },
    })
    const before = screen.getByRole('status').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(
      (screen.getByRole('textbox', { name: 'CTA external URL' }) as HTMLInputElement).value
    ).toBe('https://example.test/raw/path?q=Merchant')
    expect(screen.getByRole('status').textContent).toBe(before)
    await choose('CTA open behavior', 'Same window')
    expect(screen.getByRole('status').textContent).toContain('"targetBehavior":"same-window"')
    await choose('CTA destination type', 'Internal resource')
    expect(screen.getByRole('status').textContent).toContain('"id":"page-shop"')
  })
  it('should explain a missing destination and allow a replacement in Chinese', async () => {
    renderInLocale(<Harness missing />, 'zh-CN')
    expect(screen.getByText('当前版本中缺少所选目标。')).toBeTruthy()
    expect(screen.getByText('请先选择替代项，再预览或批准。')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('missing-id')
    await choose('CTA 目标', 'Shop 中文 · /shop/raw-path')
    expect(screen.queryByText('当前版本中缺少所选目标。')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('"id":"page-shop"')
  })
})
