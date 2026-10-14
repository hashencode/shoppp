import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { ShippingSettingsPage } from './shipping-settings-page'
import {
  assertNativeBrowserAndCss,
  installBrowserApi,
  renderI18nBrowser,
} from '../../test/i18n-browser-fixture'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})
const zone = {
  id: 'shipping-browser-zone',
  name: 'North America and international territories with tracked delivery',
  countries: ['US', 'CA', 'DE'],
  status: 'active',
  methods: [
    {
      id: 'flat-browser',
      name: 'Tracked ground delivery with appointment for oversized parcels',
      calculationType: 'flat',
      currency: 'USD',
      priceAmount: 123456,
      freeThresholdAmount: 250000,
      minWeightGrams: null,
      maxWeightGrams: null,
      status: 'active',
    },
    {
      id: 'weight-browser',
      name: 'International weight-based delivery with insurance and tracking',
      calculationType: 'weight',
      currency: 'EUR',
      priceAmount: 987654,
      freeThresholdAmount: null,
      minWeightGrams: 1000,
      maxWeightGrams: 200000,
      status: 'disabled',
    },
  ],
}

// The page is masked while the dialog is open; exercise an external locale-context update.
const changeContextLocale = async () => {
  const previous = document.documentElement.lang
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
  await waitFor(() => expect(document.documentElement.lang).not.toBe(previous))
}

describe('Shipping zone desktop Drawer', () => {
  it('keeps multiple flat/weight methods readable at 720px and submits every field once', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/settings/shipping')
        return { data: { data: [zone] } }
      if (
        request.method === 'put' &&
        request.url === '/admin/settings/shipping/zones/shipping-browser-zone'
      )
        return { data: { data: zone } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(<ShippingSettingsPage />, ['settings.read', 'settings.write'], 'en-US')
    await expect.element(page.getByText(zone.name, { exact: true })).toBeVisible()
    assertNativeBrowserAndCss()
    expect(window.innerWidth).toBeGreaterThanOrEqual(720)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect.element(page.getByLabel('Method 2')).toHaveValue(zone.methods[1].name)
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    const body = document.querySelector('.ant-drawer-body') as HTMLElement
    await waitFor(() => expect(Math.round(wrapper.getBoundingClientRect().width)).toBe(720))
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
    for (const label of [
      'Method 1',
      'Method 2',
      'Price (minor units)',
      'Currency',
      'Minimum grams',
      'Maximum grams',
    ]) {
      for (const item of Array.from(body.querySelectorAll('label')).filter(
        (item) => item.textContent === label
      )) {
        const bounds = item.getBoundingClientRect()
        expect(bounds.width).toBeGreaterThan(0)
        expect(bounds.right).toBeLessThanOrEqual(body.getBoundingClientRect().right)
      }
    }
    const nameLabel = body.querySelector('label[title="Zone name"]') as HTMLLabelElement
    expect(
      document.getElementById(nameLabel.htmlFor)!.getBoundingClientRect().width
    ).toBeGreaterThan(500)
    await page.getByLabel('Change reason').fill('Reviewed all regional carrier rates')
    const reads = transport.requests.filter((request) => request.method === 'get').length
    await changeContextLocale()
    await changeContextLocale()
    await expect
      .element(page.getByLabel('Change reason'))
      .toHaveValue('Reviewed all regional carrier rates')
    expect(transport.requests.filter((request) => request.method === 'get')).toHaveLength(reads)
    const footer = document.querySelector('.ant-drawer-footer') as HTMLElement
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .element(page.getByRole('dialog', { name: 'Shipping zone saved and audited.' }))
      .toBeVisible()
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    const writes = transport.requests.filter((request) => request.method === 'put')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0].data as string)).toEqual({
      confirm: true,
      reason: 'Reviewed all regional carrier rates',
      zone,
    })
    expect(transport.requests.filter((request) => request.method === 'get')).toHaveLength(reads + 1)
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    expect(transport.requests.filter((request) => request.method === 'get')).toHaveLength(reads + 1)
  })
})
