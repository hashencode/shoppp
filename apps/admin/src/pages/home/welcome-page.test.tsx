import React, { useState } from 'react'
import {
  ADMIN_PERMISSION_KEYS,
  SETUP_GUIDE_CHECKS,
  type SetupGuideSummary,
} from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { authContextFixture, AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { WelcomePage } from './welcome-page'

void React

const summary = (overrides: Partial<SetupGuideSummary> = {}): SetupGuideSummary => ({
  checkedAt: '2026-09-03T08:00:00.000Z',
  environment: 'staging',
  configuration: { updatedAt: '2026-09-03T07:00:00.000Z', defaultCurrency: 'USD' },
  checks: SETUP_GUIDE_CHECKS.map((check) => ({ ...check, status: 'passed', reasons: [] })),
  ...overrides,
})

const server = setupServer(
  http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary() }))
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const renderGuide = (locale: 'en-US' | 'zh-CN' = 'en-US') =>
  renderInLocale(
    <AuthTestProvider>
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>
    </AuthTestProvider>,
    locale
  )

describe('WelcomePage setup guide', () => {
  it('should keep manual verification and all six destinations available when automatic checks pass', async () => {
    renderGuide()
    expect(await screen.findByText('Automatic checks passed: 13/13')).toBeTruthy()
    expect(
      screen.getByText('Preview the storefront and confirm the brand content and policy text.')
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Check the complete shopping journey, including delivery, payment and order confirmation, through the existing test-order process.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact settings' }).getAttribute('href')).toBe(
      '/settings/launch?from=setup-guide#contacts'
    )
    expect(screen.getByRole('link', { name: 'Manage products' }).getAttribute('href')).toBe(
      '/catalog/products?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Shipping settings' }).getAttribute('href')).toBe(
      '/settings/shipping?from=setup-guide'
    )
    expect(screen.getByRole('link', { name: 'Payment settings' }).getAttribute('href')).toBe(
      '/settings/launch?from=setup-guide#payment'
    )
    expect(screen.getByRole('link', { name: 'Policy settings' }).getAttribute('href')).toBe(
      '/settings/launch?from=setup-guide#policies'
    )
    expect(screen.getByRole('link', { name: 'View orders' }).getAttribute('href')).toBe('/orders')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse guide' }))
    expect(screen.getByText('Automatic checks passed: 13/13')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Contact settings' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand guide' })).toBeTruthy()
  })

  it('should preserve the denominator and explain partial, restricted and unknown results', async () => {
    const result = summary()
    result.configuration = { updatedAt: null, defaultCurrency: 'EUR' }
    result.checks[0] = {
      ...result.checks[0]!,
      status: 'needs_action',
      reasons: [{ code: 'configuration_not_saved' }],
    }
    result.checks[2] = {
      ...result.checks[2]!,
      status: 'restricted',
      reasons: [{ code: 'permission_denied' }],
    }
    result.checks[4] = {
      ...result.checks[4]!,
      status: 'unavailable',
      reasons: [{ code: 'check_failed' }],
    }
    result.checks[7] = {
      ...result.checks[7]!,
      status: 'needs_action',
      reasons: [{ code: 'future_issue' }],
    }
    server.use(http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: result })))
    renderGuide('zh-CN')
    expect(await screen.findByText('自动检查已通过：9/13')).toBeTruthy()
    expect(screen.getByText('待处理：2 · 无法检查：1 · 无权检查：1')).toBeTruthy()
    expect(screen.getByText('默认配置尚未保存确认，请检查并保存商业设置。')).toBeTruthy()
    expect(screen.getByText('此检查需要进一步处理，请查看对应设置。')).toBeTruthy()
    expect(screen.getByText(/默认币种：EUR/)).toBeTruthy()
  })

  it.each([500, 403])(
    'should clear previous results and reopen the guide when rechecking returns %s',
    async (status) => {
      renderGuide()
      await screen.findByText('Automatic checks passed: 13/13')
      fireEvent.click(screen.getByRole('button', { name: 'Collapse guide' }))
      server.use(
        http.get('*/admin/settings/setup-guide', () =>
          HttpResponse.json({ error: { message: 'Denied or unavailable' } }, { status })
        )
      )
      fireEvent.click(screen.getByRole('button', { name: /Recheck/ }))
      expect(screen.queryByText('Automatic checks passed: 13/13')).toBeNull()
      expect(screen.getByText('Checking 13 automatic checks…')).toBeTruthy()
      await screen.findByText(
        status === 403 ? 'Setup checks are not authorized.' : 'Setup checks could not be loaded.'
      )
      expect(screen.getByText('Automatic checks passed: 0/13')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Collapse guide' })).toBeTruthy()
      expect(screen.queryByText(/Default currency: USD/)).toBeNull()
      if (status === 403) {
        expect(
          screen.getByText('Needs action: 0 · Unable to check: 0 · No permission: 13')
        ).toBeTruthy()
        expect(screen.queryByRole('link', { name: 'Contact settings' })).toBeNull()
      } else {
        expect(
          screen.getByText('Needs action: 0 · Unable to check: 13 · No permission: 0')
        ).toBeTruthy()
      }
      server.use(
        http.get('*/admin/settings/setup-guide', () => HttpResponse.json({ data: summary() }))
      )
      fireEvent.click(screen.getByRole('button', { name: /Recheck/ }))
      expect(await screen.findByText('Automatic checks passed: 13/13')).toBeTruthy()
    }
  )

  it('should ignore a late response after permissions change and retain restricted checks', async () => {
    let release!: () => void
    let requests = 0
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/admin/settings/setup-guide', async () => {
        requests += 1
        if (requests === 1) {
          await pending
          return HttpResponse.json({ data: summary() })
        }
        const result = summary()
        result.checks = result.checks.map((check) =>
          check.id === 'sellable_sku' || check.id === 'oversell_policy'
            ? { ...check, status: 'restricted', reasons: [{ code: 'permission_denied' }] }
            : check
        )
        return HttpResponse.json({ data: result })
      })
    )
    const Harness = () => {
      const [reduced, setReduced] = useState(false)
      return (
        <AuthContext.Provider
          value={authContextFixture({
            permissions: reduced
              ? ADMIN_PERMISSION_KEYS.filter((permission) => permission !== 'inventory.read')
              : ADMIN_PERMISSION_KEYS,
          })}
        >
          <button onClick={() => setReduced(true)}>Remove inventory access</button>
          <WelcomePage />
        </AuthContext.Provider>
      )
    }
    renderInLocale(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    )
    await waitFor(() => expect(requests).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Remove inventory access' }))
    expect(await screen.findByText('Automatic checks passed: 11/13')).toBeTruthy()
    await act(async () => {
      release()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(screen.getByText('Automatic checks passed: 11/13')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View inventory' })).toBeNull()
  })

  it('should start a fresh check when history returns to an earlier request key', async () => {
    let requests = 0
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/admin/settings/setup-guide', async () => {
        requests += 1
        if (requests === 2) await pending
        return HttpResponse.json({ data: summary() })
      })
    )
    const Journey = () => {
      const navigate = useNavigate()
      return (
        <>
          <button onClick={() => navigate('/welcome?review=again')}>Next visit</button>
          <button onClick={() => navigate(-1)}>Previous visit</button>
          <WelcomePage />
        </>
      )
    }
    renderInLocale(
      <AuthTestProvider>
        <MemoryRouter initialEntries={['/welcome']}>
          <Journey />
        </MemoryRouter>
      </AuthTestProvider>
    )
    await screen.findByText('Automatic checks passed: 13/13')
    fireEvent.click(screen.getByRole('button', { name: 'Next visit' }))
    await waitFor(() => expect(requests).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Previous visit' }))
    expect(screen.queryByText('Automatic checks passed: 13/13')).toBeNull()
    expect(screen.getByText('Checking 13 automatic checks…')).toBeTruthy()
    await screen.findByText('Automatic checks passed: 13/13')
    expect(requests).toBe(3)
    await act(async () => {
      release()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
  })

  it('should offer session verification without old details when the session expires', async () => {
    let verified = 0
    server.use(
      http.get('*/admin/settings/setup-guide', () => HttpResponse.json({}, { status: 401 }))
    )
    renderInLocale(
      <AuthContext.Provider
        value={authContextFixture({
          refreshSession: async () => {
            verified += 1
          },
        })}
      >
        <MemoryRouter>
          <WelcomePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Verify session' }))
    expect(verified).toBe(1)
    expect(screen.queryByRole('link', { name: 'Manage products' })).toBeNull()
  })

  it('should recheck and reopen after returning under an application basename', async () => {
    let requests = 0
    server.use(
      http.get('*/admin/settings/setup-guide', () => {
        requests += 1
        return HttpResponse.json({ data: summary() })
      })
    )
    const { unmount } = renderInLocale(
      <AuthTestProvider>
        <MemoryRouter basename="/admin" initialEntries={['/admin/welcome']}>
          <WelcomePage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    await screen.findByText('Automatic checks passed: 13/13')
    expect(screen.getByRole('link', { name: 'Payment settings' }).getAttribute('href')).toBe(
      '/admin/settings/launch?from=setup-guide#payment'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse guide' }))
    unmount()
    renderGuide()
    await screen.findByText('Automatic checks passed: 13/13')
    expect(requests).toBe(2)
    expect(screen.getByRole('link', { name: 'Payment settings' })).toBeTruthy()
  })
})
