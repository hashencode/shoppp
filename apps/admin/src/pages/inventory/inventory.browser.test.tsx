import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InventoryPage } from './inventory-page'
import { installBrowserApi, renderI18nBrowser } from '../../test/i18n-browser-fixture'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})
const item = {
  adjusted: 0,
  available: 7,
  onHand: 10,
  oversellLimit: 0,
  productName: 'Oversized tracked carry-on',
  reserved: 3,
  sku: 'CASE-BROWSER',
  variantId: 'variant-browser',
  variantName: 'Black',
  warehouseId: 'warehouse-browser',
  warehouseName: 'Primary warehouse',
}

// The page is masked while the dialog is open; exercise an external locale-context update.
const changeContextLocale = async () => {
  const previous = document.documentElement.lang
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
  await waitFor(() => expect(document.documentElement.lang).not.toBe(previous))
}

describe('Inventory adjustment Modal', () => {
  it('lets Escape close a reverted draft and keeps a dirty draft through Continue editing and locale changes', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/inventory')
        return { data: { data: [item], meta: { total: 1 } } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(<InventoryPage />, ['inventory.read', 'inventory.adjust'], 'en-US')
    await expect.element(page.getByText(item.productName)).toBeVisible()
    await page.getByRole('button', { name: 'Adjust', exact: true }).click()
    await expect.element(page.getByRole('dialog', { name: 'Adjust · CASE-BROWSER' })).toBeVisible()
    expect(document.querySelectorAll('.ant-modal-footer button')).toHaveLength(1)
    await page.getByLabel('Reason', { exact: true }).fill('Cycle count correction')
    await page.getByRole('dialog', { name: 'Adjust · CASE-BROWSER' }).press('Escape')
    await expect.element(page.getByRole('button', { name: 'Continue editing' })).toBeVisible()
    await changeContextLocale()
    await page.getByRole('button', { name: '继续编辑' }).click()
    await waitFor(() => expect(document.querySelector('.ant-modal-confirm-confirm')).toBeNull())
    await changeContextLocale()
    await expect
      .element(page.getByLabel('Reason', { exact: true }))
      .toHaveValue('Cycle count correction')
    await page.getByLabel('Reason', { exact: true }).fill('')
    await page.getByRole('dialog', { name: 'Adjust · CASE-BROWSER' }).press('Escape')
    await expect
      .element(page.getByRole('dialog', { name: 'Adjust · CASE-BROWSER' }))
      .not.toBeVisible()
    expect(transport.requests).toHaveLength(1)
  })
})
