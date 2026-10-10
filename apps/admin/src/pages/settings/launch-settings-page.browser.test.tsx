import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, screen, waitFor } from '@testing-library/react'
import type { LaunchConfiguration, LaunchConfigurationStatus } from '@shoppp/contracts'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
} from '../../test/i18n-browser-fixture'
import { LaunchSettingsPage } from './launch-settings-page'

void React

const configuration: LaunchConfiguration = {
  defaultCurrency: 'USD',
  legalApproved: true,
  orderNumberPrefix: 'SH',
  oversellPolicy: 'deny',
  paymentMode: 'test',
  paymentProvider: 'stripe',
  policies: Object.fromEntries(
    ['contact', 'cookies', 'privacy', 'returns', 'shipping', 'terms'].map((kind) => [
      kind,
      `https://shop.example.test/${kind}`,
    ])
  ) as LaunchConfiguration['policies'],
  privacyContactEmail: 'privacy@example.test',
  providerConfigured: true,
  reservationTtlMinutes: 15,
  sellableCurrencies: ['USD', 'EUR'],
  shippingCountries: ['US'],
  shippingMethodIds: ['ship_01J00000000000000000000001'],
  supportEmail: 'support@example.test',
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
let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})
const Destination = () => {
  const location = useLocation()
  return (
    <output data-testid="destination">
      {location.pathname}
      {location.search}
    </output>
  )
}
const renderSettings = () => {
  transport = installBrowserApi((request) => {
    if (request.url === '/admin/settings/launch') return { data: { data: status } }
    if (request.url === '/admin/operations/health')
      return {
        data: {
          data: {
            checkedAt: status.updatedAt,
            environment: 'staging',
            failures: { catalogBuilds: 0, deadLetterJobs: 0, paymentEvents: 0, reportExports: 0 },
            status: 'ok',
          },
        },
      }
    throw new Error(`Unexpected browser request ${request.method} ${request.url}`)
  })
  renderI18nBrowser(
    <MemoryRouter initialEntries={['/settings/launch?from=setup-guide&task=payment']}>
      <Routes>
        <Route path="/settings/launch" element={<LaunchSettingsPage />} />
        <Route path="/settings/contact" element={<Destination />} />
        <Route path="/settings/shipping" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
    ['settings.read', 'settings.write', 'policies.read'],
    'en-US'
  )
}

describe('business settings in a native browser', () => {
  it('retains edits on cancel and leaves only after explicit discard, preserving guide provenance', async () => {
    renderSettings()
    await screen.findByLabelText('Default currency')
    assertNativeBrowserAndCss()
    await page.getByRole('textbox', { name: 'Default currency' }).fill('EUR')
    await page.getByRole('link', { name: 'Shipping settings' }).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((screen.getByLabelText('Default currency') as HTMLInputElement).value).toBe('EUR')
    await page.getByRole('link', { name: 'Contact settings' }).click()
    await page.getByRole('button', { name: 'Discard changes and continue' }).click()
    await waitFor(() =>
      expect(screen.getByTestId('destination').textContent).toBe(
        '/settings/contact?from=setup-guide&task=payment'
      )
    )
    expect(transport!.requests.filter(({ method }) => method === 'put')).toHaveLength(0)
  })

  it('saves one runtime configuration with the contact preservation flag and shows the effect by Save', async () => {
    renderSettings()
    await screen.findByLabelText('Default currency')
    assertNativeBrowserAndCss()
    assertWithinViewport(
      screen.getByText('Changes apply to new checkout requests in the current environment.')
    )
    await page
      .getByRole('textbox', { name: 'Change reason' })
      .fill('Verify current business settings')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await screen.findByText('Business settings saved.')
    const writes = transport!.requests.filter(({ method }) => method === 'put')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0].data as string)).toEqual({
      configuration,
      confirm: true,
      preserveContactEmails: true,
      reason: 'Verify current business settings',
    })
    await page.getByRole('link', { name: 'Contact settings' }).click()
    await waitFor(() =>
      expect(screen.getByTestId('destination').textContent).toBe(
        '/settings/contact?from=setup-guide&task=payment'
      )
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
