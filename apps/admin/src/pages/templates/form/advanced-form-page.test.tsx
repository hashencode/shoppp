import { render } from '../../../test/render-with-app'
import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter } from 'react-router-dom'
import { AdvancedFormPage } from './advanced-form-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

describe('AdvancedFormPage', () => {
  it('renders effective dates as independent controls', () => {
    const { container } = render(
      <MemoryRouter>
        <AdvancedFormPage />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('开始日期')).toBeTruthy()
    expect(screen.getByLabelText('结束日期')).toBeTruthy()
    expect(container.querySelector('.ant-picker-range')).toBeNull()
  })
})
