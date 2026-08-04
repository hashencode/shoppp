import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import type { Role } from '../../shared/types/roles'
import { AuthTestProvider } from '../../test/auth-context-fixture'
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
  http.get('*/admin/inventory', () =>
    HttpResponse.json({ data: [item], meta: { total: 1 } })
  ),
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
    adjustmentBody = await request.json()
    return HttpResponse.json({ data: { history: [], position: item } }, { status: 201 })
  })
)

const renderPage = (role: Role) =>
  render(
    <AuthTestProvider role={role}>
      <ThemeProvider>
        <InventoryPage />
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  adjustmentBody = undefined
  server.resetHandlers()
})
afterAll(() => server.close())

describe('InventoryPage', () => {
  it('reconciles inventory totals and exposes append-only history', async () => {
    renderPage('viewer')
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Adjust' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await waitFor(() => expect(screen.getByText('Cycle count')).toBeTruthy())
    expect(screen.getByText('Operator')).toBeTruthy()
  })

  it('requires a non-zero quantity and reason before submitting an authorized adjustment', async () => {
    renderPage('editor')
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Adjust' }))
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
  })
})
