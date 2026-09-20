import React from 'react'
import { screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { PrivacyPage } from './privacy-page'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const server = setupServer(
  http.get('*/admin/privacy/requests', () => HttpResponse.json({ data: [] }))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('PrivacyPage', () => {
  it('keeps verification guidance with the operation controls under one recipe heading', async () => {
    renderInLocale(
      <AuthTestProvider>
        <ThemeProvider>
          <MemoryRouter>
            <PrivacyPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )

    const heading = screen.getByRole('heading', { level: 4, name: 'Privacy requests' })
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Record verified request' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    const guidance = screen.getByText(
      'Verified access, correction, and deletion operations with immutable retention decisions.'
    )
    expect(heading.parentElement?.contains(guidance)).toBe(false)
    expect((await screen.findAllByText('No data')).length).toBeGreaterThan(0)
  })
})
