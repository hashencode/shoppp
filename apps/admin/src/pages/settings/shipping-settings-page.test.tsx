import React from 'react'
import type { UpsertShippingZoneRequest } from '@shoppp/contracts'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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

const zone = {
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
    {
      calculationType: 'weight',
      currency: 'EUR',
      freeThresholdAmount: null,
      id: 'ship_weight',
      minWeightGrams: 1000,
      maxWeightGrams: 20000,
      name: 'International tracked oversized parcels with delivery appointment',
      priceAmount: 123456,
      status: 'disabled',
    },
  ],
  name: 'North America',
  status: 'active',
}

const server = setupServer(
  http.get('*/admin/settings/shipping', () =>
    HttpResponse.json({
      data: [zone],
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
    expect(screen.getAllByLabelText('Price (minor units)')[0]).toBeTruthy()
    expect(screen.getAllByLabelText('Free threshold')[0]).toBeTruthy()
    expect(screen.getAllByLabelText('Minimum grams')[0]).toBeTruthy()
    expect(screen.getAllByLabelText('Maximum grams')[0]).toBeTruthy()
    expect(screen.getByLabelText('Change reason')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    const boundary = screen.getByText(
      'Saving updates shipping options and rates for new checkout requests in the current environment.'
    )
    expect(boundary.closest('.ant-drawer')).toBeTruthy()
    expect(document.querySelector('.ant-drawer-content-wrapper')?.getAttribute('style')).toContain(
      '720px'
    )
    expect(await screen.findByDisplayValue(zone.methods[1]!.name)).toBeTruthy()
    expect(screen.getAllByLabelText('Price (minor units)')).toHaveLength(2)
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(submitted).toBeDefined())
    expect(submitted).toEqual({ confirm: true, reason: 'Confirm launch carrier rates', zone })
    expect(idempotencyKey).toMatch(/^shipping-zone-zone_.*-[0-9a-f-]{36}$/)
  })
  it('resets method edits and additions to the complete zone baseline without writing', async () => {
    let writes = 0
    server.use(
      http.put('*/admin/settings/shipping/zones/:id', () => {
        writes += 1
        return HttpResponse.json({ data: zone })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['settings.read', 'settings.write']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('North America')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Method 2'), {
      target: { value: 'Changed oversized service' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add shipping method' }))
    expect(screen.getAllByLabelText('Price (minor units)')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(await screen.findByDisplayValue(zone.methods[1]!.name)).toBeTruthy()
    expect(screen.getAllByLabelText('Price (minor units)')).toHaveLength(2)
    fireEvent.click(document.querySelector('.ant-drawer-close') as HTMLElement)
    expect(screen.queryByText('Unsaved changes')).toBeNull()
    expect(writes).toBe(0)
  })

  it('closes after one write and retries only the shipping read if refresh fails', async () => {
    let writes = 0
    let reads = 0
    let failRead = false
    server.use(
      http.get('*/admin/settings/shipping', () => {
        reads += 1
        return failRead
          ? HttpResponse.json(
              { error: { code: 'unavailable', message: 'Shipping temporarily unavailable.' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: [zone] })
      }),
      http.put('*/admin/settings/shipping/zones/:id', async ({ request }) => {
        writes += 1
        expect(await request.json()).toEqual({
          confirm: true,
          reason: 'Confirm carrier rates',
          zone,
        })
        failRead = true
        return HttpResponse.json({ data: zone })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['settings.read', 'settings.write']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('North America')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Confirm carrier rates' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('List could not be loaded')
    expect(writes).toBe(1)
    expect(reads).toBe(2)
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    await waitFor(() => expect(wrapper.className).toContain('leave-active'))
    fireEvent.transitionEnd(wrapper)
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    const success = document.querySelector('.ant-modal-confirm-success') as HTMLElement
    expect(within(success).getAllByText('Shipping zone saved and audited.').length).toBeGreaterThan(
      0
    )
    fireEvent.click(within(success).getByRole('button', { name: 'Confirm' }))
    expect(reads).toBe(2)
    failRead = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(reads).toBe(3))
    expect(writes).toBe(1)
  })
  it('creates a complete new zone without an ID and normalizes country and currency values', async () => {
    let submitted: unknown
    let key: string | null = null
    server.use(
      http.post('*/admin/settings/shipping/zones', async ({ request }) => {
        submitted = await request.json()
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json({ data: zone }, { status: 201 })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['settings.read', 'settings.write']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('North America')
    fireEvent.click(screen.getByRole('button', { name: 'New zone' }))
    fireEvent.change(screen.getByLabelText('Zone name'), { target: { value: 'New area' } })
    const country = screen.getByRole('combobox', { name: 'Country allowlist' })
    fireEvent.change(country, { target: { value: 'us' } })
    fireEvent.keyDown(country, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 })
    fireEvent.blur(country)
    fireEvent.change(screen.getByLabelText('Method 1'), { target: { value: 'Tracked service' } })
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'eur' } })
    fireEvent.change(screen.getByLabelText('Change reason'), {
      target: { value: 'Add carrier area' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(submitted).toBeDefined())
    await waitFor(() =>
      expect(submitted).toEqual({
        confirm: true,
        reason: 'Add carrier area',
        zone: {
          countries: ['US'],
          name: 'New area',
          status: 'active',
          methods: [
            {
              calculationType: 'flat',
              currency: 'EUR',
              freeThresholdAmount: null,
              maxWeightGrams: null,
              minWeightGrams: null,
              name: 'Tracked service',
              priceAmount: 0,
              status: 'active',
            },
          ],
        },
      })
    )
    expect(key).toMatch(/^shipping-zone-create-[0-9a-f-]{36}$/)
  })

  it('shows zone facts with no creation or edit write path for a readonly operator', async () => {
    let writes = 0
    server.use(
      http.post('*/admin/settings/shipping/zones', () => {
        writes += 1
        return HttpResponse.json({ data: zone })
      }),
      http.put('*/admin/settings/shipping/zones/:id', () => {
        writes += 1
        return HttpResponse.json({ data: zone })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['settings.read']}>
        <ThemeProvider>
          <ShippingSettingsPage />
        </ThemeProvider>
      </AuthTestProvider>
    )
    await screen.findByText('North America')
    expect(screen.queryByRole('button', { name: 'New zone' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(writes).toBe(0)
  })
})
