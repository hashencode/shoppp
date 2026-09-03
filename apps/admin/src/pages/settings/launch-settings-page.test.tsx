import React from 'react'
import type {
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
} from '@shoppp/contracts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
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
const renderPage = (writable = true) =>
  renderInLocale(
    <AuthTestProvider
      permissions={writable ? ['settings.read', 'settings.write'] : ['settings.read']}
    >
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/launch?from=setup-guide#payment']}>
          <LaunchSettingsPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthTestProvider>
  )
describe('LaunchSettingsPage', () => {
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
    await screen.findByLabelText('Support email')
    expect(await screen.findByText('Operational health could not be loaded')).toBeTruthy()
    expect(document.getElementById('payment')).toBeTruthy()
    expect(screen.queryByText('Launch readiness')).toBeNull()
    fireEvent.change(screen.getByLabelText('Default currency'), { target: { value: 'EUR' } })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Change default currency' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() =>
      expect(submitted).toEqual([
        {
          configuration: { ...configuration, defaultCurrency: 'EUR' },
          reason: 'Change default currency',
          confirm: true,
        },
      ])
    )
    expect(await screen.findByText('Launch configuration saved and audited.')).toBeTruthy()
    server.use(http.get('*/admin/operations/health', () => HttpResponse.json({ data: health })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry health check' }))
    expect(await screen.findByText('Healthy')).toBeTruthy()
  })
  it('disables fields and hard-blocks a forced readonly form submission', async () => {
    renderPage(false)
    const email = await screen.findByLabelText('Support email')
    expect(email).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save', exact: true })).toBeNull()
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Forced readonly request' },
    })
    fireEvent.submit(email.closest('form')!)
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
    expect(await screen.findByText('Healthy')).toBeTruthy()
    expect(screen.queryByLabelText('Support email')).toBeNull()
    server.use(http.get('*/admin/settings/launch', () => HttpResponse.json({ data: status })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }))
    expect(await screen.findByLabelText('Support email')).toBeTruthy()
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
    await screen.findByLabelText('Support email')
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Keep this reason' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.getByLabelText('Change reason')).toHaveValue('Keep this reason')
    expect(screen.getByRole('button', { name: 'Save', exact: true })).not.toBeDisabled()
  })
})
