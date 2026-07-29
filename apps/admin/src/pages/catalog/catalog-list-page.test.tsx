import React, { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../../infrastructure/auth/auth-context'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import type { Role } from '../../shared/types/roles'
import { CatalogListPage } from './catalog-list-page'

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

let requestCount = 0
const server = setupServer(
  http.get('*/admin/catalog/products', () => {
    requestCount += 1
    return HttpResponse.json({
      data: [
        {
          id: 'product-001',
          name: 'Carry-on',
          slug: 'carry-on',
          status: 'draft',
          updated_at: '2026-07-30T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    })
  })
)

const SetRole = ({ role }: { role: Role }) => {
  const auth = useAuth()
  useEffect(() => auth.setRole(role), [auth, role])
  return null
}

const renderPage = (role: Role = 'admin') =>
  render(
    <AuthProvider>
      <SetRole role={role} />
      <ThemeProvider>
        <CatalogListPage />
      </ThemeProvider>
    </AuthProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  requestCount = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('CatalogListPage', () => {
  it('loads products and only queries changed filters after submit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())
    expect(requestCount).toBe(1)

    fireEvent.change(screen.getByPlaceholderText('Search name or slug'), {
      target: { value: 'carry' },
    })
    expect(requestCount).toBe(1)
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)
    await waitFor(() => expect(requestCount).toBe(2))
  })

  it('hides all mutation actions from a view-only operator', async () => {
    renderPage('viewer')
    await waitFor(() => expect(screen.getByText('Carry-on')).toBeTruthy())

    expect(screen.queryByRole('button', { name: 'New product' })).toBeNull()
    expect(screen.queryByText('Edit')).toBeNull()
    expect(screen.queryByText('Publish')).toBeNull()
    expect(screen.getByText('View')).toBeTruthy()
  })
})
