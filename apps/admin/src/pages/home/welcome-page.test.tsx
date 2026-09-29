import React from 'react'
import {
  SETUP_GUIDE_CHECKS,
  type AdminPermission,
  type SetupGuideCheck,
  type SetupGuideSummary,
} from '@shoppp/contracts'
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
  { href: '/settings/shipping?from=setup-guide', id: 'shipping' },
  { href: '/settings/launch?from=setup-guide', id: 'commerce' },
  { href: '/inventory?from=setup-guide', id: 'inventory' },
  { href: '/orders?from=setup-guide', id: 'orders' },
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
    server.use(http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary })))
    renderGuide()

    expect(await screen.findByText('Passed automatic checks')).toBeTruthy()
    await waitFor(() =>
      expect(document.querySelector('.ant-statistic-content')?.textContent).toBe('12/13')
    )
    expect(
      screen.getByText(
        'Default configuration has not been confirmed. Review and save commercial settings.'
      )
    ).toBeTruthy()
    expect(
      screen
        .getByText('1. Basics and contacts')
        .closest('.ant-collapse-header')
        ?.getAttribute('aria-expanded')
    ).toBe('true')
    expect(screen.getByRole('img', { name: 'Needs action' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Go to Commercial settings' }).getAttribute('href')
    ).toBe('/settings/launch?from=setup-guide#sales')
    expect(screen.queryByRole('link', { name: 'Go to Contact settings' })).toBeNull()
    expect(
      (await screen.findByRole('link', { name: 'Go to Store identity' })).getAttribute('href')
    ).toBe('/settings/identity?from=setup-guide')
    fireEvent.click(screen.getByText('5. Storefront and policies'))
    expect(screen.getByRole('link', { name: 'Go to Policies' }).getAttribute('href')).toBe(
      '/settings/policies?from=setup-guide'
    )
    fireEvent.click(screen.getByText('2. Prepare products'))
    expect(screen.getByRole('link', { name: 'Go to Collections' }).getAttribute('href')).toBe(
      '/catalog/collections?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Go to Pages' }).getAttribute('href')).toBe(
      '/content/pages?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Go to Navigation' }).getAttribute('href')).toBe(
      '/storefront/navigation?from=setup-guide'
    )
    expect(
      screen.getByRole('link', { name: 'Go to Themes and preview' }).getAttribute('href')
    ).toBe('/storefront/themes?from=setup-guide')
    expect(
      screen.getByText(
        'These 13 checks cover initial store setup. Open each editor to review draft, published, candidate and live state.'
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

    fireEvent.click(screen.getByText('1. Basics and contacts'))
    expect(
      (await screen.findByRole('link', { name: 'Go to Store identity' })).getAttribute('href')
    ).toBe('/admin/settings/identity?from=setup-guide')
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
    expect(screen.queryByRole('link', { name: 'Go to Store identity' })).toBeNull()
    fail = false
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })))
    fireEvent.click(screen.getByText('1. Basics and contacts'))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Go to Store identity' })).toBeTruthy()
    )
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
      expect((screen.getByRole('button', { name: /Recheck/ }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )
    fireEvent.click(screen.getByRole('button', { name: /Recheck/ }))

    expect(await screen.findByText('Setup checks could not be loaded.')).toBeTruthy()
    expect(document.querySelector('.ant-statistic-content')?.textContent).toBe('—/13')
    expect(
      screen.queryByText(
        'Current configuration checks passed; manual verification is still required.'
      )
    ).toBeNull()
  })

  it('explains operator-owned checks without offering a misleading editor shortcut', async () => {
    const summary = checkedSummary()
    summary.checks = summary.checks.map((check) => {
      if (check.id === 'payment_configuration') {
        return { ...check, status: 'needs_action', reasons: [{ code: 'payment_provider_missing' }] }
      }
      if (check.id === 'turnstile_configuration') {
        return { ...check, status: 'needs_action', reasons: [{ code: 'turnstile_secret_missing' }] }
      }
      if (check.id === 'backup_configuration') {
        return { ...check, status: 'needs_action', reasons: [{ code: 'backup_export_missing' }] }
      }
      return check
    })
    server.use(http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary })))
    renderGuide()

    expect(
      await screen.findByText('The payment provider credential is not configured.')
    ).toBeTruthy()
    expect(
      screen
        .getByText('Ask the deployment maintainer to configure the environment credentials.')
        .closest('li')?.textContent
    ).toContain('Payment configuration')
    const runtimeActions = screen.getAllByText(
      'Ask the deployment maintainer to configure the missing runtime bindings.'
    )
    expect(runtimeActions.map((action) => action.closest('li')?.textContent)).toEqual([
      expect.stringContaining('Turnstile configuration'),
      expect.stringContaining('Backup configuration'),
    ])
    expect(screen.queryByRole('link', { name: 'Go to Commercial settings' })).toBeNull()
  })

  it('keeps every action beside its check or manual task instead of the step description', async () => {
    renderGuide()

    expect(await screen.findByText('Passed automatic checks')).toBeTruthy()
    fireEvent.click(screen.getByText('5. Storefront and policies'))
    const storefrontDescription = screen.getByText(
      'Review storefront presentation and commercial policy accuracy.'
    )
    expect(storefrontDescription.querySelector('a')).toBeNull()
    const preview = screen.getByText('Storefront preview and policy content').closest('li')
    expect(screen.queryByText('Manual verification (not counted in automatic checks)')).toBeNull()
    expect(preview?.textContent).toContain('Manual check')
    expect(preview?.textContent).toContain(
      'Confirm brand content and policy text in the storefront preview.'
    )
    expect(preview?.querySelector('a[href="/storefront/themes?from=setup-guide"]')).toBeTruthy()
    expect(preview?.querySelector('a[href="/settings/policies?from=setup-guide"]')).toBeTruthy()

    fireEvent.click(screen.getByText('6. Review before launch'))
    const reviewDescription = screen.getByText(
      'Review inventory and runtime settings. Production release follows the existing process.'
    )
    expect(reviewDescription.querySelector('a')).toBeNull()
    const testOrder = screen.getByText('Complete shopping journey').closest('li')
    expect(testOrder?.textContent).toContain('Manual check')
    expect(testOrder?.querySelector('a[href="/orders?from=setup-guide"]')).toBeTruthy()
    expect(testOrder?.querySelectorAll('a')).toHaveLength(1)
  })

  it('sends actionable checks to the relevant section of the authorized editor', async () => {
    const summary = checkedSummary()
    const reasons: Partial<Record<SetupGuideCheck['id'], string>> = {
      shipping_countries: 'shipping_country_unavailable',
      payment_configuration: 'production_payment_mode_not_live',
      policy_configuration: 'legal_approval_missing',
    }
    summary.checks = summary.checks.map((check) => {
      const reason = reasons[check.id]
      return reason
        ? { ...check, status: 'needs_action' as const, reasons: [{ code: reason }] }
        : check
    })
    server.use(http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary })))
    renderGuide()

    expect(
      (await screen.findByRole('link', { name: 'Go to Shipping settings' })).getAttribute('href')
    ).toBe('/settings/shipping?from=setup-guide')
    expect(screen.getByRole('link', { name: 'Go to Payments' }).getAttribute('href')).toBe(
      '/settings/launch?from=setup-guide#payment'
    )
    expect(screen.getByRole('link', { name: 'Go to Policy settings' }).getAttribute('href')).toBe(
      '/settings/launch?from=setup-guide#policies'
    )
  })

  it('does not expose an inline action when its destination is outside the permission snapshot', async () => {
    const summary = checkedSummary()
    summary.checks[0] = {
      ...summary.checks[0]!,
      status: 'needs_action',
      reasons: [{ code: 'configuration_not_saved' }],
    }
    server.use(
      http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary })),
      http.get('*/admin/settings/setup-guide/destinations', () =>
        HttpResponse.json({ data: { destinations: destinations.slice(0, 2) } })
      )
    )
    renderGuide(['settings.read', 'identity.read'])

    expect(
      await screen.findByText(
        'Default configuration has not been confirmed. Review and save commercial settings.'
      )
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Go to Commercial settings' })).toBeNull()
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
    expect(await screen.findByRole('link', { name: 'Go to Products' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Collections' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Go to Contact settings' })).toBeNull()
    expect(screen.getByText('Setup checks are not authorized.')).toBeTruthy()
    expect(checkRequests).toBe(0)
  })

  it('should show only the destinations returned for the current permission snapshot', async () => {
    server.use(
      http.get('*/admin/settings/setup-guide/destinations', () =>
        HttpResponse.json({ data: { destinations: [destinations[0], destinations[2]] } })
      )
    )
    renderGuide(['settings.read', 'identity.read', 'policies.read'])

    fireEvent.click(screen.getByText('1. Basics and contacts'))
    expect(await screen.findByRole('link', { name: 'Go to Store identity' })).toBeTruthy()
    fireEvent.click(screen.getByText('5. Storefront and policies'))
    expect(screen.getByRole('link', { name: 'Go to Policies' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Go to Collections' })).toBeNull()
  })
})
