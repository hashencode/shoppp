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

    expect(screen.getByRole('button', { name: 'Add heading' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add paragraph' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add image' })).toBeTruthy()
    expect(screen.queryByText(/HTML|embed|script/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add paragraph' }))
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

    fireEvent.change(screen.getByRole('textbox', { name: 'List 1' }), {
      target: { value: [`a`.repeat(700), ...Array.from({ length: 24 }, (_, index) => `item ${index}`)].join('\n') },
    })

    const emitted = onChange.mock.calls[0]?.[0]?.[0]
    expect(emitted.items).toHaveLength(20)
    expect(emitted.items[0]).toHaveLength(500)
  })
})
