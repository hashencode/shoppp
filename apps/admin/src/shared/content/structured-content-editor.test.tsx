import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, rstest } from '@rstest/core'

import { StructuredContentEditor } from './structured-content-editor'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

describe('StructuredContentEditor', () => {
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
      target: { value: [`a`.repeat(700), ...Array.from({ length: 24 }, (_, index) => `item ${index}`)].join('\n') },
    })

    const emitted = onChange.mock.calls[0]?.[0]?.[0]
    expect(emitted.items).toHaveLength(20)
    expect(emitted.items[0]).toHaveLength(500)
  })

  it('limits publishable Content to the audited sections and emits typed links', () => {
    const onChange = rstest.fn()
    render(
      <StructuredContentEditor contentMode="publishable" value={[]} onChange={onChange} />
    )

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
