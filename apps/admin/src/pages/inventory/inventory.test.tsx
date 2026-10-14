import React from 'react'
import type { AdminPermission } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { useI18n } from '../../shared/contexts/i18n-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { templateRoutes } from '../../routes/routes.config'
import { InventoryPage } from './inventory-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

let adjustmentBody: unknown
let adjustmentRequests = 0
let adjustmentIdempotencyKey: string | null = null
let inventoryQueries: Record<string, string>[] = []
let inventoryRequestCount = 0
let adjustmentGate: Promise<void> | null = null
let releaseAdjustment: (() => void) | null = null
const item = {
  adjusted: 2,
  available: 7,
  onHand: 10,
  oversellLimit: 0,
  productName: 'Carry-on',
  reserved: 3,
  sku: 'CASE-BLK',
  variantId: 'var_carry_on_black',
  variantName: 'Black',
  warehouseId: 'wh_primary',
  warehouseName: 'Primary warehouse',
}
const server = setupServer(
  http.get('*/admin/inventory', ({ request }) => {
    inventoryRequestCount += 1
    inventoryQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
    return HttpResponse.json({ data: [item], meta: { total: 40 } })
  }),
  http.get('*/admin/inventory/:variantId/:warehouseId', () =>
    HttpResponse.json({
      data: {
        history: [
          {
            actor_name: 'Operator',
            created_at: '2026-07-30T00:00:00.000Z',
            id: 'sl_1',
            quantity_delta: 2,
            reason: 'Cycle count',
            reference_id: 'sl_1',
            reference_type: 'manual_adjustment',
          },
        ],
        position: { available: 7, onHand: 10, oversellLimit: 0, reserved: 3 },
      },
    })
  ),
  http.post('*/admin/inventory/:variantId/:warehouseId/adjustments', async ({ request }) => {
    adjustmentRequests += 1
    adjustmentIdempotencyKey = request.headers.get('Idempotency-Key')
    adjustmentBody = await request.json()
    await adjustmentGate
    return HttpResponse.json({ data: { history: [], position: item } }, { status: 201 })
  })
)

const renderPage = (permissions: readonly AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider role="inventory_operator" permissions={permissions}>
      <ThemeProvider>
        <InventoryPage />
      </ThemeProvider>
    </AuthTestProvider>
  )

const LocaleSwitch = () => {
  const { setLocale } = useI18n()
  return <button onClick={() => setLocale('zh-CN')}>Switch language</button>
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  adjustmentBody = undefined
  adjustmentRequests = 0
  adjustmentIdempotencyKey = null
  inventoryQueries = []
  inventoryRequestCount = 0
  adjustmentGate = null
  releaseAdjustment = null
  server.resetHandlers()
  window.localStorage.clear()
})
afterAll(() => server.close())

describe('InventoryPage', () => {
  it('retranslates without refetching the committed inventory query', async () => {
    renderInLocale(
      <AuthTestProvider role="inventory_operator" permissions={['inventory.read']}>
        <ThemeProvider>
          <LocaleSwitch />
          <InventoryPage />
        </ThemeProvider>
      </AuthTestProvider>,
      'en-US'
    )

    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(inventoryQueries).toEqual([{ page: '1', pageSize: '20' }])
  })

  it('keeps the inventory route guarded by the read permission', () => {
    expect(templateRoutes.find(({ key }) => key === 'inventory')).toMatchObject({
      path: '/inventory',
      permission: 'inventory.read',
    })
  })

  it('uses the accepted page size, preserves read-only inventory facts, and exposes history', async () => {
    renderPage(['inventory.read'])
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(inventoryQueries).toEqual([{ page: '1', pageSize: '20' }])
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Adjust' })).toBeNull()
    expect(
      screen.queryByText('On-hand, reserved, available, and append-only adjustments.')
    ).toBeNull()
    expect(screen.getAllByRole('heading', { level: 4, name: 'Inventory' })).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'History' }).closest('[data-list-row-actions-row]')
    ).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Page Size' }))
    expect(await screen.findByRole('option', { name: '20 per page' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '50 per page' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '100 per page' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'All data' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Page Size' }), { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await waitFor(() => expect(screen.getByText('Cycle count')).toBeTruthy())
    expect(screen.getByText('Operator')).toBeTruthy()
  })

  it('commits draft search only on Search, resets it, and paginates with the committed scope', async () => {
    renderPage(['inventory.read'])
    await screen.findByText('Carry-on')

    fireEvent.change(screen.getByLabelText('Search inventory'), {
      target: { value: ' CASE-BLK ' },
    })
    expect(inventoryQueries).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() => expect(inventoryQueries).toHaveLength(2), { timeout: 3_000 })
    expect(inventoryQueries[1]).toEqual({ page: '1', pageSize: '20', query: 'CASE-BLK' })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_100))
    })

    fireEvent.change(screen.getByLabelText('Search inventory'), {
      target: { value: 'unsubmitted' },
    })
    fireEvent.click(document.querySelector('.ant-pagination-next button')!)
    await waitFor(() => expect(inventoryQueries.at(-1)?.page).toBe('2'))
    expect(inventoryQueries.at(-1)).toEqual({ page: '2', pageSize: '20', query: 'CASE-BLK' })

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(inventoryQueries.at(-1)).toEqual({ page: '1', pageSize: '20' }), {
      timeout: 3_000,
    })
  })

  it('validates adjustment input and reloads authoritative data with the latest committed query', async () => {
    adjustmentGate = new Promise<void>((resolve) => {
      releaseAdjustment = resolve
    })
    renderPage(['inventory.read', 'inventory.adjust'])
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(
      screen.getByRole('button', { name: 'Adjust' }).closest('[data-list-row-actions-row]')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity delta' }), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }))
    expect(await screen.findByText('Quantity delta cannot be zero.')).toBeTruthy()
    expect(await screen.findByText('Use at least 3 characters.')).toBeTruthy()
    expect(adjustmentBody).toBeUndefined()

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity delta' }), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Cycle count correction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }))

    await waitFor(() =>
      expect(adjustmentBody).toEqual({
        quantityDelta: 2,
        reason: 'Cycle count correction',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /Apply adjustment/ }))
    fireEvent.click(document.querySelector('.ant-modal-close') as HTMLElement)
    expect(screen.queryByText('Unsaved changes')).toBeNull()
    expect(screen.getByDisplayValue('Cycle count correction')).toBeTruthy()
    expect(adjustmentRequests).toBe(1)
    expect(adjustmentIdempotencyKey).toMatch(/^inventory-adjust-/)

    fireEvent.change(screen.getByLabelText('Search inventory'), {
      target: { value: ' latest committed ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() =>
      expect(inventoryQueries.at(-1)).toEqual({
        page: '1',
        pageSize: '20',
        query: 'latest committed',
      })
    )

    await act(async () => {
      releaseAdjustment?.()
    })
    await waitFor(() => expect(inventoryRequestCount).toBe(3))
    expect(inventoryQueries.at(-1)).toEqual({
      page: '1',
      pageSize: '20',
      query: 'latest committed',
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Adjust · CASE-BLK/ })).toBeNull()
    )
  })

  it('keeps the adjustment modal open and does not reload when the write fails', async () => {
    server.use(
      http.post('*/admin/inventory/:variantId/:warehouseId/adjustments', () =>
        HttpResponse.json(
          { error: { code: 'adjustment_rejected', message: 'Adjustment rejected.' } },
          { status: 422 }
        )
      )
    )
    renderPage(['inventory.read', 'inventory.adjust'])
    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity delta' }), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Cycle count correction' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply adjustment' }))

    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply adjustment' })).toBeTruthy()
    expect(inventoryRequestCount).toBe(1)
  })

  it('confirms only effective adjustment changes and keeps the draft when continuing', async () => {
    renderPage(['inventory.read', 'inventory.adjust'])
    await screen.findByText('Carry-on')
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
    const dialog = document.querySelector('.ant-modal') as HTMLElement
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Cycle count correction' },
    })
    fireEvent.click(dialog.querySelector('.ant-modal-close') as HTMLElement)
    expect((await screen.findAllByText('Unsaved changes')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }))
    const confirmation = document.querySelector('.ant-modal-confirm-confirm') as HTMLElement
    await waitFor(() => expect(confirmation.className).toContain('leave-active'))
    fireEvent.transitionEnd(confirmation)
    await waitFor(() => expect(document.querySelector('.ant-modal-confirm-confirm')).toBeNull())
    expect(screen.getByDisplayValue('Cycle count correction')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: '' },
    })
    fireEvent.click(dialog.querySelector('.ant-modal-close') as HTMLElement)
    await waitFor(() => expect(dialog.className).toContain('leave-active'))
    fireEvent.transitionEnd(dialog)
    await waitFor(() =>
      expect(dialog.closest('.ant-modal-wrap')?.getAttribute('style')).toContain('display: none')
    )
    expect(adjustmentBody).toBeUndefined()
    expect(inventoryRequestCount).toBe(1)
  })

  it('uses the standard blocking replacement-error state and retries the committed query', async () => {
    let failReplacement = false
    server.use(
      http.get('*/admin/inventory', ({ request }) => {
        inventoryQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        if (failReplacement) {
          return HttpResponse.json(
            { error: { code: 'inventory_unavailable', message: 'Inventory is unavailable.' } },
            { status: 503 }
          )
        }
        return HttpResponse.json({ data: [item], meta: { total: 40 } })
      })
    )
    renderPage(['inventory.read'])
    await screen.findByText('Carry-on')

    failReplacement = true
    fireEvent.change(screen.getByLabelText('Search inventory'), {
      target: { value: 'broken' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))

    expect(await screen.findByText('List could not be loaded')).toBeTruthy()
    expect(screen.queryByText('Carry-on')).toBeNull()
    failReplacement = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Carry-on')).toBeTruthy()
    expect(inventoryQueries.at(-1)).toEqual({ page: '1', pageSize: '20', query: 'broken' })
  })
})
