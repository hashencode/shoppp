import type { AdminStorefrontTheme } from '@shoppp/contracts'
import React from 'react'
import { screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { ThemesPage } from './themes-page'

void React

const theme: AdminStorefrontTheme = {
  componentRegistry: { blocks: [], sections: [] },
  configurationSchemaVersion: 1,
  fixtureBindings: [],
  id: 'fashion-store',
  platformCompatibility: { maxExclusive: '2.0.0', min: '1.0.0' },
  platformContractVersion: '1.0.0',
  presetDefinitions: [{ id: 'editorial', label: 'Editorial', templates: [] }],
  presets: ['editorial'],
  supportedPageTemplates: ['home'],
  themeVersion: '1.0.0',
}

const server = setupServer(
  http.get('*/admin/storefront-experiences/themes', () => HttpResponse.json({ data: [theme] })),
  http.get('*/admin/storefront-experiences/drafts', () => HttpResponse.json({ data: [] }))
)

const renderPage = () =>
  renderInLocale(
    <AuthTestProvider permissions={['themes.read', 'themes.write']}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/storefront/themes']}>
          <ThemesPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ThemesPage', () => {
  it('keeps the route title and creation action in the normal state', async () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 4, name: 'Storefront themes' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'New experience draft' })).toBeTruthy()
    expect(
      screen.queryByText(
        'Saving or approving a design does not update the storefront. Approved designs await formal release.'
      )
    ).toBeNull()
    expect(
      screen.queryByText(
        'Configure fixture-backed Fashion and Decor experiences. Production keeps its current theme.'
      )
    ).toBeNull()
  })

  it('keeps the route title while loading', () => {
    server.use(
      http.get('*/admin/storefront-experiences/themes', async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 100))
        return HttpResponse.json({ data: [theme] })
      })
    )
    renderPage()

    expect(screen.getByRole('heading', { level: 4, name: 'Storefront themes' })).toBeTruthy()
    expect(screen.getByText('Loading storefront themes…')).toBeTruthy()
  })

  it('keeps the route title in error and empty states', async () => {
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json(
          { error: { code: 'unavailable', message: 'Unavailable' } },
          { status: 503 }
        )
      )
    )
    const errorView = renderPage()

    expect(await screen.findByText('Storefront themes could not be loaded')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Storefront themes' })).toBeTruthy()
    errorView.unmount()

    server.use(
      http.get('*/admin/storefront-experiences/themes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/storefront-experiences/drafts', () => HttpResponse.json({ data: [] }))
    )
    renderPage()

    expect(
      await screen.findByText(
        'A source-controlled package must pass compatibility and release validation before it appears here.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Storefront themes' })).toBeTruthy()
  })
})
