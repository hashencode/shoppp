import React from 'react'
import type { AdminPermission } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { WelcomePage } from './welcome-page'

void React

const destinations = [
  { href: '/settings/identity?from=setup-guide', id: 'identity' },
  { href: '/settings/contact?from=setup-guide', id: 'contact' },
  { href: '/settings/policies?from=setup-guide', id: 'policies' },
  { href: '/catalog/products?from=setup-guide', id: 'products' },
  { href: '/catalog/collections?from=setup-guide', id: 'collections' },
  { href: '/content/pages?from=setup-guide', id: 'pages' },
  { href: '/content/articles?from=setup-guide', id: 'articles' },
  { href: '/storefront/navigation?from=setup-guide', id: 'navigation' },
  { href: '/storefront/themes?from=setup-guide', id: 'themes' },
]

const server = setupServer(
  http.get('*/admin/settings/setup-guide/destinations', () =>
    HttpResponse.json({ data: { destinations } })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const renderGuide = (permissions?: readonly AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider permissions={permissions}>
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    </AuthTestProvider>
  )

describe('WelcomePage setup guide', () => {
  it('should render only server-authorized direct editor links without readiness conclusions', async () => {
    renderGuide()

    expect((await screen.findByRole('link', { name: 'Store identity' })).getAttribute('href')).toBe(
      '/settings/identity?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Policies' }).getAttribute('href')).toBe(
      '/settings/policies?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Collections' }).getAttribute('href')).toBe(
      '/catalog/collections?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Pages' }).getAttribute('href')).toBe(
      '/content/pages?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Navigation' }).getAttribute('href')).toBe(
      '/storefront/navigation?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Themes and preview' }).getAttribute('href')).toBe(
      '/storefront/themes?from=setup-guide'
    )
    expect(screen.queryByText('Passed automatic checks')).toBeNull()
    expect(screen.queryByText(/Needs action|Unable to check|No permission to check/)).toBeNull()
    expect(
      screen.getByText(
        'Each editor shows its own saved, candidate, live, stale, and next-action state.'
      )
    ).toBeTruthy()
  })

  it('should preserve the application basename for every returned deep link', async () => {
    renderInLocale(
      <AuthTestProvider>
        <MemoryRouter basename="/admin" initialEntries={['/admin/welcome']}>
          <WelcomePage />
        </MemoryRouter>
      </AuthTestProvider>
    )

    expect((await screen.findByRole('link', { name: 'Store identity' })).getAttribute('href')).toBe(
      '/admin/settings/identity?from=setup-guide'
    )
  })

  it('should expose a retryable error without stale destinations', async () => {
    let fail = true
    server.use(
      http.get('*/admin/settings/setup-guide/destinations', () =>
        fail
          ? HttpResponse.json({ error: { message: 'Unavailable' } }, { status: 500 })
          : HttpResponse.json({ data: { destinations } })
      )
    )
    renderGuide()

    expect(await screen.findByText('Setup destinations could not be loaded')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Store identity' })).toBeNull()
    fail = false
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    await waitFor(() => expect(screen.getByRole('link', { name: 'Store identity' })).toBeTruthy())
  })

  it('should show only the destinations returned for the current permission snapshot', async () => {
    server.use(
      http.get('*/admin/settings/setup-guide/destinations', () =>
        HttpResponse.json({ data: { destinations: destinations.slice(0, 2) } })
      )
    )
    renderGuide(['settings.read', 'identity.read'])

    expect(await screen.findByRole('link', { name: 'Store identity' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact settings' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Policies' })).toBeNull()
  })
})
