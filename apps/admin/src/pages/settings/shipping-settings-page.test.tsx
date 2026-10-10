import React from 'react'
import type { UpsertShippingZoneRequest } from '@shoppp/contracts'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import { AuthTestProvider } from '../../test/auth-context-fixture'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { renderInLocale } from '../../test/render-in-locale'
import { ShippingSettingsPage } from './shipping-settings-page'

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

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const server = setupServer(
  http.get('*/admin/settings/shipping', () =>
    HttpResponse.json({
      data: [
        {
          countries: ['US', 'CA'],
          id: 'zone_01J0000000000000000000000',
          methods: [
            {
              calculationType: 'flat',
              currency: 'USD',
              freeThresholdAmount: 10000,
              id: 'ship_01J00000000000000000000001',
              maxWeightGrams: null,
              minWeightGrams: null,
              name: 'Tracked ground',
              priceAmount: 900,
              status: 'active',
            },
          ],
          name: 'North America',
          status: 'active',
        },
      ],
    })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ShippingSettingsPage', () => {
  it('renders authoritative zones and opens a complete reasoned editor', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['settings.read', 'settings.write']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )

    expect(screen.getByRole('heading', { level: 4, name: 'Shipping settings' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(
      screen.queryByText('Country zones, flat or weight-based rates, thresholds, and eligibility.')
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'New zone' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('North America')).toBeTruthy())
    expect(screen.getByText('US')).toBeTruthy()
    expect(screen.getByText('CA')).toBeTruthy()
    expect(screen.getByText(/Tracked ground · flat · 900 USD/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await waitFor(() => expect(screen.getByText('Edit shipping zone')).toBeTruthy())
    expect(screen.getByLabelText('Country allowlist')).toBeTruthy()
    expect(screen.getByLabelText('Price (minor units)')).toBeTruthy()
    expect(screen.getByLabelText('Free threshold')).toBeTruthy()
    expect(screen.getByLabelText('Minimum grams')).toBeTruthy()
    expect(screen.getByLabelText('Maximum grams')).toBeTruthy()
    expect(screen.getByLabelText('Change reason')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm and save' })).toBeTruthy()
    const boundary = screen.getByText(
      'Saving updates shipping options and rates for new checkout requests in the current environment.'
    )
    expect(boundary.closest('.ant-modal')).toBeTruthy()
  })

  it('submits the complete reasoned update with an idempotency key', async () => {
    let submitted: UpsertShippingZoneRequest | undefined
    let idempotencyKey: string | null = null
    server.use(
      http.put('*/admin/settings/shipping/zones/:id', async ({ request }) => {
        submitted = (await request.json()) as UpsertShippingZoneRequest
        idempotencyKey = request.headers.get('Idempotency-Key')
        return HttpResponse.json({ data: submitted.zone })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['settings.read', 'settings.write']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )

    await waitFor(() => expect(screen.getByText('North America')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Confirm launch carrier rates' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }))

    await waitFor(() => expect(submitted).toBeDefined())
    expect(submitted).toMatchObject({
      confirm: true,
      reason: 'Confirm launch carrier rates',
      zone: {
        countries: ['US', 'CA'],
        id: 'zone_01J0000000000000000000000',
        name: 'North America',
      },
    })
    expect(idempotencyKey).toMatch(/^shipping-zone-zone_.*-[0-9a-f-]{36}$/)
  })
})
