import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { MemoryRouter } from 'react-router-dom'
import type { AdminSession } from '@shoppp/contracts'
import { AuthProvider, useAuthState } from '../../infrastructure/auth/auth-context'
import * as authApi from '../../services/auth/api'
import { LoginPage } from './login-page'

void React

const session: AdminSession = {
  displayName: 'Alice Admin',
  email: 'alice@example.test',
  environment: 'test',
  identityId: 'identity-alice',
  permissions: ['catalog.read'],
  principalKind: 'human',
  role: {
    enabled: true,
    id: 'role_operator',
    key: 'operator',
    name: 'Operator',
    protected: false,
    system: false,
    version: 3,
  },
}

const Probe = () => {
  const auth = useAuthState()
  return <span data-testid="auth-probe">{auth.status}:{auth.session?.identityId ?? 'none'}</span>
}

const renderPage = () =>
  render(
    <AuthProvider>
      <MemoryRouter>
        <LoginPage />
        <Probe />
      </MemoryRouter>
    </AuthProvider>
  )

describe('Access session page', () => {
  beforeEach(() => {
    rstest.restoreAllMocks()
    window.localStorage.setItem('codex-admin-auth', '1')
    window.localStorage.setItem('codex-admin-account', 'legacy-admin')
  })

  it('hydrates the authoritative API session and ignores stale local auth keys', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockResolvedValue(session)
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('auth-probe').textContent).toBe('authenticated:identity-alice')
    })
    expect(screen.queryByPlaceholderText(/用户名|密码|手机号|验证码/)).toBeNull()
    expect(window.localStorage.getItem('codex-admin-auth')).toBe('1')
  })

  it('shows protected-host instructions and never offers a credential form', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockRejectedValue(
      Object.assign(new Error('Access required'), { code: 'access_required', status: 401 })
    )
    renderPage()

    expect(await screen.findByText('Cloudflare Access session required')).toBeTruthy()
    expect(screen.getByText(/protected test admin hostname/i)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(/1234|账号密码登录|手机号登录/)).toBeNull()
  })

  it('attempts onboarding only for an explicitly unmapped Access identity', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockRejectedValue(
      Object.assign(new Error('Unmapped'), { code: 'identity_unmapped', status: 401 })
    )
    const accept = rstest.spyOn(authApi, 'acceptAdminInvitation').mockResolvedValue(session)
    renderPage()

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('auth-probe').textContent).toBe('authenticated:identity-alice')
  })

  it('renders invitation, disabled, and forbidden states without leaking membership', async () => {
    const fetch = rstest.spyOn(authApi, 'fetchAdminSession')
    fetch.mockRejectedValue(
      Object.assign(new Error('Unmapped'), { code: 'identity_unmapped', status: 401 })
    )
    rstest.spyOn(authApi, 'acceptAdminInvitation').mockRejectedValue(
      Object.assign(new Error('No invitation'), {
        code: 'active_invitation_required',
        status: 401,
      })
    )
    const { unmount } = renderPage()
    expect(await screen.findByText('Admin invitation required')).toBeTruthy()
    expect(screen.queryByText(/exists|expired for|operator@example/i)).toBeNull()
    unmount()

    fetch.mockRejectedValue(
      Object.assign(new Error('Disabled'), { code: 'identity_not_enabled', status: 401 })
    )
    const disabledView = renderPage()
    expect(await screen.findByText('Admin access disabled')).toBeTruthy()
    disabledView.unmount()

    fetch.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { code: 'authorization_state_invalid', status: 403 })
    )
    renderPage()
    expect(await screen.findByText('Admin access forbidden')).toBeTruthy()
  })

  it('retries session verification from the Access-required state', async () => {
    const fetch = rstest
      .spyOn(authApi, 'fetchAdminSession')
      .mockRejectedValueOnce(
        Object.assign(new Error('Access required'), { code: 'access_required', status: 401 })
      )
      .mockResolvedValueOnce(session)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Verify Access session' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })
})
