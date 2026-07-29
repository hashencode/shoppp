import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import {
  FORM_CONTENT_ALIGN_STORAGE_KEY,
  SEARCH_COMPACT_LAYOUT_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from './theme-context'

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

const ThemeProbe = () => {
  const {
    formContentAlign,
    searchCompactLayout,
    setFormContentAlign,
    setSearchCompactLayout,
  } = useTheme()

  return (
    <div>
      <span>{`form-align-${formContentAlign}`}</span>
      <span>{searchCompactLayout ? 'compact-on' : 'compact-off'}</span>
      <button type="button" onClick={() => setFormContentAlign('left')}>
        align-left
      </button>
      <button type="button" onClick={() => setSearchCompactLayout(!searchCompactLayout)}>
        toggle-compact
      </button>
    </div>
  )
}

describe('theme-context', () => {
  it('defaults form content alignment to center without stored preference', () => {
    window.localStorage.removeItem(FORM_CONTENT_ALIGN_STORAGE_KEY)

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    expect(screen.getByText('form-align-center')).toBeTruthy()
    expect(document.documentElement.getAttribute('data-form-content-align')).toBe('center')
  })

  it('persists form content alignment preference', () => {
    window.localStorage.setItem(FORM_CONTENT_ALIGN_STORAGE_KEY, 'right')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    expect(screen.getByText('form-align-right')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'align-left' }))

    expect(screen.getByText('form-align-left')).toBeTruthy()
    expect(window.localStorage.getItem(FORM_CONTENT_ALIGN_STORAGE_KEY)).toBe('left')
    expect(document.documentElement.getAttribute('data-form-content-align')).toBe('left')
  })

  it('hydrates and persists search compact layout preference', () => {
    window.localStorage.setItem(SEARCH_COMPACT_LAYOUT_STORAGE_KEY, 'true')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )

    expect(screen.getByText('compact-on')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'toggle-compact' }))

    expect(screen.getByText('compact-off')).toBeTruthy()
    expect(window.localStorage.getItem(SEARCH_COMPACT_LAYOUT_STORAGE_KEY)).toBe('false')
  })
})
