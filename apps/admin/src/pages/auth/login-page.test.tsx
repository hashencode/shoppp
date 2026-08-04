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

describe('administrator password login', () => {
  beforeEach(() => {
    rstest.restoreAllMocks()
  })

  it('hydrates an existing authoritative cookie session', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockResolvedValue(session)
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('auth-probe').textContent).toBe('authenticated:identity-alice')
    })
  })

  it('offers email and password login when no session exists', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockRejectedValue(
      Object.assign(new Error('Session required'), { code: 'admin_session_invalid', status: 401 })
    )
    rstest.spyOn(authApi, 'loginAdmin').mockResolvedValue(session)
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('auth-probe').textContent).toBe('login-required:none')
    })

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'alice@example.test' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }))

    await waitFor(() => {
      expect(authApi.loginAdmin).toHaveBeenCalledWith({
        email: 'alice@example.test',
        password: 'correct horse battery staple',
      })
      expect(screen.getByTestId('auth-probe').textContent).toBe('authenticated:identity-alice')
    })
    expect(screen.getByRole('link', { name: '忘记密码？' })).toBeTruthy()
  })

  it('renders the API error after invalid credentials', async () => {
    rstest.spyOn(authApi, 'fetchAdminSession').mockRejectedValue(
      Object.assign(new Error('Session required'), { code: 'admin_session_invalid', status: 401 })
    )
    rstest.spyOn(authApi, 'loginAdmin').mockRejectedValue(
      Object.assign(new Error('账号或密码错误'), { code: 'invalid_admin_credentials', status: 401 })
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('auth-probe').textContent).toBe('login-required:none')
    })

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'alice@example.test' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'wrong password value' },
    })
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }))

    expect(await screen.findByText('账号或密码错误')).toBeTruthy()
    expect(screen.getByTestId('auth-probe').textContent).toBe('login-required:none')
  })
})
