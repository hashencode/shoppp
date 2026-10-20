import type { AdminStorefrontTheme } from '@shoppp/contracts'
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { ThemesPage } from './themes-page'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

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
  it('creates the selected package and preset with the complete draft request after a recoverable failure', async () => {
    let fail = true
    const requests: unknown[] = []
    const keys: (string | null)[] = []
    server.use(
      http.post('*/admin/storefront-experiences/drafts', async ({ request }) => {
        requests.push(await request.json())
        keys.push(request.headers.get('Idempotency-Key'))
        return fail
          ? HttpResponse.json(
              { error: { code: 'draft_create_failed', message: 'Retry draft creation.' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: { id: 'draft.created' } }, { status: 201 })
      })
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'New experience draft' }))
    const reason = await screen.findByRole('textbox', { name: 'Notes (optional)' })
    fireEvent.change(reason, { target: { value: 'Selected editorial preset' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }))
    await screen.findByText('Retry draft creation.')
    expect((reason as HTMLTextAreaElement).value).toBe('Selected editorial preset')
    const expected = {
      draft: {
        bindings: [],
        experienceId: 'storefront-fashion-store',
        overrides: [],
        presetId: 'editorial',
        themeId: 'fashion-store',
        themeVersion: '1.0.0',
      },
      reason: 'Selected editorial preset',
    }
    expect(requests).toEqual([expected])
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }))
    await waitFor(() => expect(requests).toEqual([expected, expected]))
    for (const key of keys) expect(key).toMatch(/^theme-draft-create-[0-9a-f-]{36}$/)
  })

  it('keeps draft creation unavailable without theme-write permission and sends no write', async () => {
    let writes = 0
    server.use(
      http.post('*/admin/storefront-experiences/drafts', () => {
        writes += 1
        return HttpResponse.json({ data: { id: 'unexpected' } })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['themes.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <ThemesPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('Read-only theme access')
    expect(screen.queryByRole('button', { name: 'New experience draft' })).toBeNull()
    expect(writes).toBe(0)
  })
})
