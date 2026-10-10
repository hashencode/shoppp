import React from 'react'
import type {
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
} from '@shoppp/contracts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { PermissionKey } from '../../infrastructure/auth/permissions'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { renderInLocale } from '../../test/render-in-locale'
import { LaunchSettingsPage } from './launch-settings-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}
const configuration: LaunchConfiguration = {
  defaultCurrency: 'USD',
  legalApproved: true,
  orderNumberPrefix: 'SH',
  oversellPolicy: 'deny',
  paymentMode: 'test',
  paymentProvider: 'stripe',
  policies: {
    contact: 'https://shop.example.com/contact',
    cookies: 'https://shop.example.com/cookies',
    privacy: 'https://shop.example.com/privacy',
    returns: 'https://shop.example.com/returns',
    shipping: 'https://shop.example.com/shipping',
    terms: 'https://shop.example.com/terms',
  },
  privacyContactEmail: 'privacy@example.com',
  providerConfigured: true,
  reservationTtlMinutes: 15,
  sellableCurrencies: ['USD', 'EUR'],
  shippingCountries: ['US'],
  shippingMethodIds: ['ship_01J00000000000000000000001'],
  supportEmail: 'support@example.com',
  taxMode: 'zero',
  webhookConfigured: true,
}
const status: LaunchConfigurationStatus = {
  configuration,
  environment: 'staging',
  issues: [],
  ready: true,
  updatedAt: '2026-09-03T00:00:00.000Z',
}
const health: OperationalHealth = {
  checkedAt: '2026-09-03T00:00:00.000Z',
  environment: 'staging',
  failures: { catalogBuilds: 0, deadLetterJobs: 0, paymentEvents: 0, reportExports: 0 },
  status: 'ok',
}
let submitted: unknown[] = []
const server = setupServer(
  http.get('*/admin/settings/launch', () => HttpResponse.json({ data: status })),
  http.get('*/admin/operations/health', () => HttpResponse.json({ data: health })),
  http.put('*/admin/settings/launch', async ({ request }) => {
    submitted.push(await request.json())
    return HttpResponse.json({ data: status })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  submitted = []
  server.resetHandlers()
})
afterAll(() => server.close())
const LocationProbe = () => {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="location">
        {location.pathname}
        {location.search}
        {location.hash}
      </output>
      <button onClick={() => navigate(-1)}>Browser back</button>
    </>
  )
}
const renderPage = (
  writable = true,
  initialEntry = '/settings/launch?from=setup-guide#payment',
  permissions: PermissionKey[] = writable
    ? ['settings.read', 'settings.write', 'policies.read']
    : ['settings.read']
) =>
  renderInLocale(
    <AuthTestProvider permissions={permissions}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LaunchSettingsPage />
          <LocationProbe />
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>
  )
describe('LaunchSettingsPage', () => {
  it('does not show environment or setup-guide promotion', async () => {
    renderPage(true, '/settings/launch')
    expect(screen.getByRole('heading', { level: 4, name: 'Commercial settings' })).toBeTruthy()
    expect(screen.queryByLabelText('Back')).toBeNull()
    await screen.findByRole('link', { name: 'Contact settings' })
    expect(screen.queryByLabelText('Support email')).toBeNull()
    expect(screen.queryByText('Staging')).toBeNull()
    expect(screen.queryByRole('link', { name: 'View store setup checks' })).toBeNull()
  })
  it('saves the complete configuration and reason even when health fails', async () => {
    server.use(
      http.get('*/admin/operations/health', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
          { status: 500 }
        )
      )
    )
    renderPage()
    await screen.findByRole('link', { name: 'Contact settings' })
    expect(await screen.findByText('Operational health could not be loaded')).toBeTruthy()
    expect(document.getElementById('payment')).toBeTruthy()
    expect(screen.queryByText('Launch readiness')).toBeNull()
    fireEvent.change(screen.getByLabelText('Default currency'), { target: { value: 'EUR' } })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Change default currency' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toEqual([
        {
          configuration: { ...configuration, defaultCurrency: 'EUR' },
          reason: 'Change default currency',
          confirm: true,
          preserveContactEmails: true,
        },
      ])
    )
    expect(await screen.findByText('Business settings saved.')).toBeTruthy()
    server.use(http.get('*/admin/operations/health', () => HttpResponse.json({ data: health })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry health check' }))
    expect(await screen.findByText('Healthy')).toBeTruthy()
  })
  it('opens the unique setting owners without prompting for loaded values and preserves the return query', async () => {
    renderPage(true, '/settings/launch?from=setup-guide&task=payment#payment')
    await screen.findByLabelText('Default currency')
    const targets = [
      ['Contact settings', '/settings/contact'],
      ['Shipping settings', '/settings/shipping'],
      ['Edit policy content', '/settings/policies'],
    ]
    for (const [label, path] of targets) {
      const link = screen.getByRole('link', { name: label })
      expect(link.getAttribute('href')).toBe(`${path}?from=setup-guide&task=payment`)
      fireEvent.click(link)
      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          `${path}?from=setup-guide&task=payment`
        )
      )
      expect(screen.queryByText('Leave with unsaved business settings?')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/settings/launch?from=setup-guide&task=payment#payment'
        )
      )
    }
    expect(submitted).toEqual([])
  })
  it('keeps the current route and edits when an owner-link confirmation is cancelled', async () => {
    renderPage()
    const currency = await screen.findByLabelText('Default currency')
    fireEvent.change(currency, { target: { value: 'EUR' } })
    fireEvent.click(screen.getByRole('link', { name: 'Shipping settings' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Leave with unsaved business settings?',
    })
    expect(screen.getByTestId('location').textContent).toBe(
      '/settings/launch?from=setup-guide#payment'
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect((currency as HTMLInputElement).value).toBe('EUR')
    expect(screen.getByTestId('location').textContent).toBe(
      '/settings/launch?from=setup-guide#payment'
    )
    expect(submitted).toEqual([])
  })
  it('opens the requested owner only after confirming that edits will be discarded', async () => {
    renderPage()
    const currency = await screen.findByLabelText('Default currency')
    fireEvent.change(currency, { target: { value: 'EUR' } })
    fireEvent.click(screen.getByRole('link', { name: 'Contact settings' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Leave with unsaved business settings?',
    })
    expect(screen.getByTestId('location').textContent).toBe(
      '/settings/launch?from=setup-guide#payment'
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes and continue' }))
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/settings/contact?from=setup-guide')
    )
    expect(submitted).toEqual([])
  })
  it('does not warn after edits are reverted, reset, or successfully saved', async () => {
    renderPage()
    const currency = await screen.findByLabelText('Default currency')
    fireEvent.change(currency, { target: { value: 'EUR' } })
    fireEvent.change(currency, { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('link', { name: 'Contact settings' }))
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/settings/contact?from=setup-guide')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    fireEvent.change(currency, { target: { value: 'EUR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect((currency as HTMLInputElement).value).toBe('USD'))
    fireEvent.click(screen.getByRole('link', { name: 'Contact settings' }))
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/settings/contact?from=setup-guide')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Keep current configuration' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Business settings saved.')
    fireEvent.click(screen.getByRole('link', { name: 'Contact settings' }))
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/settings/contact?from=setup-guide')
    )
    expect(screen.queryByText('Leave with unsaved business settings?')).toBeNull()
  })
  it('uses original owner read permissions and shows the runtime boundary by Save', async () => {
    renderPage(true, '/settings/launch', ['settings.read', 'settings.write'])
    await screen.findByLabelText('Default currency')
    expect(screen.getByRole('link', { name: 'Contact settings' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Shipping settings' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Edit policy content' })).toBeNull()
    const boundary = screen.getByText(
      'Changes apply to new checkout requests in the current environment.'
    )
    expect(boundary.closest('.ax-fixed-toolbar')).toBeTruthy()
  })
  it('keeps invalid policy URLs in the form without submitting', async () => {
    renderPage()
    const privacy = await screen.findByLabelText('privacy policy URL')
    fireEvent.change(privacy, { target: { value: 'invalid-url' } })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Update policy links' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(privacy.getAttribute('aria-invalid')).toBe('true'))
    expect((privacy as HTMLInputElement).value).toBe('invalid-url')
    expect(submitted).toEqual([])
  })
  it('disables fields and hard-blocks a forced readonly form submission', async () => {
    renderPage(false)
    const currency = await screen.findByLabelText('Default currency')
    expect((currency as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Forced readonly request' },
    })
    fireEvent.submit(currency.closest('form')!)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(submitted).toEqual([])
  })
  it('recovers configuration independently while health remains available', async () => {
    server.use(
      http.get('*/admin/settings/launch', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
          { status: 500 }
        )
      )
    )
    renderPage()
    expect(await screen.findByText('Form details could not be loaded')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Commercial settings' })).toBeTruthy()
    expect(await screen.findByText('Healthy')).toBeTruthy()
    expect(screen.queryByLabelText('Default currency')).toBeNull()
    server.use(http.get('*/admin/settings/launch', () => HttpResponse.json({ data: status })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByLabelText('Default currency')).toBeTruthy()
  })
  it('keeps the route heading above permission and loading states', async () => {
    const permissionView = renderInLocale(
      <AuthTestProvider permissions={[]}>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/settings/launch']}>
            <LaunchSettingsPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    expect(screen.getByRole('heading', { level: 4, name: 'Commercial settings' })).toBeTruthy()
    expect(screen.getByText('Access denied')).toBeTruthy()
    permissionView.unmount()

    server.use(
      http.get('*/admin/settings/launch', async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 100))
        return HttpResponse.json({ data: status })
      })
    )
    renderPage()
    expect(screen.getByRole('heading', { level: 4, name: 'Commercial settings' })).toBeTruthy()
    expect(screen.getByText('Loading form details…')).toBeTruthy()
  })
  it('keeps unsaved inputs and offers recovery when saving fails', async () => {
    server.use(
      http.put('*/admin/settings/launch', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Save failed' } },
          { status: 500 }
        )
      )
    )
    renderPage()
    await screen.findByLabelText('Default currency')
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Keep this reason' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect((screen.getByLabelText('Change reason') as HTMLTextAreaElement).value).toBe(
      'Keep this reason'
    )
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
