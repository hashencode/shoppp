import React from 'react'
import { SETUP_GUIDE_CHECKS, type AdminPermission, type SetupGuideSummary } from '@shoppp/contracts'
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

const checkedSummary = (): SetupGuideSummary => ({
  checkedAt: '2026-09-28T08:00:00.000Z',
  environment: 'staging',
  configuration: { updatedAt: '2026-09-28T07:00:00.000Z', defaultCurrency: 'USD' },
  checks: SETUP_GUIDE_CHECKS.map((check) => ({ ...check, status: 'passed', reasons: [] })),
})

const server = setupServer(
  http.get('*/admin/settings/setup-guide/destinations', () =>
    HttpResponse.json({ data: { destinations } })
  ),
  http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: checkedSummary() }))
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
  it('shows checked completion, missing configuration and the next editor within guided steps', async () => {
    const summary = checkedSummary()
    summary.checks[0] = {
      ...summary.checks[0]!,
      status: 'needs_action',
      reasons: [{ code: 'configuration_not_saved' }],
    }
    server.use(
      http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary }))
    )
    renderGuide()

    expect(await screen.findByText('Passed automatic checks')).toBeTruthy()
    await waitFor(() =>
      expect(document.querySelector('.ant-statistic-content')?.textContent).toBe('12/13')
    )
    expect(screen.getByText('Default configuration has not been confirmed. Review and save commercial settings.')).toBeTruthy()
    expect(screen.getByText('1. Basics and contacts').closest('.ant-collapse-header')?.getAttribute('aria-expanded')).toBe('true')
    expect((await screen.findByRole('link', { name: 'Store identity' })).getAttribute('href')).toBe(
      '/settings/identity?from=setup-guide'
    )
    fireEvent.click(screen.getByText('5. Storefront and policies'))
    expect(screen.getByRole('link', { name: 'Policies' }).getAttribute('href')).toBe(
      '/settings/policies?from=setup-guide'
    )
    fireEvent.click(screen.getByText('2. Prepare products'))
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
    expect(screen.getByText('These 13 checks cover initial store setup. Open each editor to review draft, published, candidate and live state.')).toBeTruthy()
  })

  it('should preserve the application basename for every returned deep link', async () => {
    renderInLocale(
      <AuthTestProvider>
        <MemoryRouter basename="/admin" initialEntries={['/admin/welcome']}>
          <WelcomePage />
        </MemoryRouter>
      </AuthTestProvider>
    )

    fireEvent.click(screen.getByText('1. Basics and contacts'))
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
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    fireEvent.click(screen.getByText('1. Basics and contacts'))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Store identity' })).toBeTruthy())
  })

  it('clears an earlier completion count when a recheck cannot load current checks', async () => {
    renderGuide()
    await waitFor(() =>
      expect(document.querySelector('.ant-statistic-content')?.textContent).toBe('13/13')
    )
    server.use(
      http.get('*/admin/settings/setup-guide', () =>
        HttpResponse.json({ error: { message: 'Unavailable' } }, { status: 503 })
      )
    )
    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Recheck/ }) as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(screen.getByRole('button', { name: /Recheck/ }))

    expect(await screen.findByText('Setup checks could not be loaded.')).toBeTruthy()
    expect(document.querySelector('.ant-statistic-content')?.textContent).toBe('—/13')
    expect(screen.queryByText('Current configuration checks passed; manual verification is still required.')).toBeNull()
  })

  it('keeps permitted guidance without requesting checks when settings access is absent', async () => {
    let checkRequests = 0
    server.use(
      http.get('*/admin/settings/setup-guide', () => {
        checkRequests += 1
        return HttpResponse.json({ data: checkedSummary() })
      }),
      http.get('*/admin/settings/setup-guide/destinations', () =>
        HttpResponse.json({ data: { destinations: destinations.slice(3, 5) } })
      )
    )
    renderGuide(['catalog.read'])

    fireEvent.click(screen.getByText('2. Prepare products'))
    expect(await screen.findByRole('link', { name: 'Products' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Collections' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Contact settings' })).toBeNull()
    expect(screen.getByText('Setup checks are not authorized.')).toBeTruthy()
    expect(checkRequests).toBe(0)
  })

  it('should show only the destinations returned for the current permission snapshot', async () => {
    server.use(
      http.get('*/admin/settings/setup-guide/destinations', () =>
        HttpResponse.json({ data: { destinations: destinations.slice(0, 2) } })
      )
    )
    renderGuide(['settings.read', 'identity.read'])

    fireEvent.click(screen.getByText('1. Basics and contacts'))
    expect(await screen.findByRole('link', { name: 'Store identity' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact settings' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Policies' })).toBeNull()
  })
})
