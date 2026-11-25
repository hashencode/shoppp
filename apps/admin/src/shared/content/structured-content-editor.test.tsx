import React from 'react'
import type { StorefrontContentSection } from '@shoppp/contracts'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, rstest } from '@rstest/core'

import { StructuredContentEditor } from './structured-content-editor'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

describe('StructuredContentEditor', () => {
  it('names image selection and preserves typed image/link edits through labelled fields', () => {
    const onChange = rstest.fn()
    const sections: StorefrontContentSection[] = [
      { id: 'section.image', kind: 'image', assetId: 'media.hero', alt: 'Studio' },
      {
        id: 'section.link',
        kind: 'link',
        link: {
          label: 'Visit',
          target: { kind: 'external', url: 'https://example.com' },
          targetBehavior: 'new-window',
        },
      },
    ]
    const { rerender } = render(<StructuredContentEditor value={sections} onChange={onChange} />)
    expect(screen.getByRole('combobox', { name: '图片素材' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('图片替代文本'), {
      target: { value: 'Studio entrance' },
    })
    expect(onChange.mock.calls[0]?.[0]).toEqual([
      { ...sections[0], alt: 'Studio entrance' },
      sections[1],
    ])
    fireEvent.change(screen.getByLabelText('HTTPS URL'), {
      target: { value: 'https://example.com/studio' },
    })
    expect(onChange.mock.calls[1]?.[0]?.[1]).toEqual({
      id: 'section.link',
      kind: 'link',
      link: {
        label: 'Visit',
        target: { kind: 'external', url: 'https://example.com/studio' },
        targetBehavior: 'new-window',
      },
    })
    const internal: StorefrontContentSection = {
      ...sections[1],
      kind: 'link',
      link: {
        label: 'Visit',
        target: { kind: 'internal', reference: { kind: 'page', id: 'page.about' } },
        targetBehavior: 'same-window',
      },
    }
    rerender(<StructuredContentEditor value={[internal]} onChange={onChange} />)
    expect(screen.getByRole('combobox', { name: '资源类型' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('资源 ID'), {
      target: { value: 'page.contact' },
    })
    expect(onChange.mock.calls[2]?.[0]?.[0]).toEqual({
      ...internal,
      link: {
        ...internal.link,
        target: { kind: 'internal', reference: { kind: 'page', id: 'page.contact' } },
      },
    })
  })

  it('offers only the bounded v1 section set and emits plain text edits', () => {
    const onChange = rstest.fn()
    render(<StructuredContentEditor value={[]} onChange={onChange} />)

    expect(screen.getByRole('button', { name: '添加标题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '添加段落' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '添加列表' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '添加图片' })).toBeTruthy()
    expect(screen.queryByText(/HTML|embed|script/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '添加段落' }))
    const paragraph = onChange.mock.calls[0]?.[0]
    expect(paragraph).toMatchObject([{ kind: 'paragraph', text: '' }])
  })

  it('clamps pasted list content to the section contract', () => {
    const onChange = rstest.fn()
    render(
      <StructuredContentEditor
        value={[{ id: 'section.list', kind: 'list', items: [''] }]}
        onChange={onChange}
      />
    )

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: [`a`.repeat(700), ...Array.from({ length: 24 }, (_, index) => `item ${index}`)].join(
          '\n'
        ),
      },
    })

    const emitted = onChange.mock.calls[0]?.[0]?.[0]
    expect(emitted.items).toHaveLength(20)
    expect(emitted.items[0]).toHaveLength(500)
  })

  it('limits publishable Content to the audited sections and emits typed links', () => {
    const onChange = rstest.fn()
    render(<StructuredContentEditor contentMode="publishable" value={[]} onChange={onChange} />)

    expect(screen.queryByRole('button', { name: '添加列表' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '添加链接' }))
    expect(onChange.mock.calls[0]?.[0]).toMatchObject([
      {
        kind: 'link',
        link: { target: { kind: 'external' }, targetBehavior: 'same-window' },
      },
    ])
  })
})
