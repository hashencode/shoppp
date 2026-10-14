import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { MemoryRouter } from 'react-router-dom'
import type { AdminSession } from '@shoppp/contracts'
import * as authApi from '../../services/auth/api'
import { ForgotPasswordPage } from './forgot-password-page'
import { ResetPasswordPage } from './reset-password-page'
import { ActivateAccountPage } from './activate-account-page'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { authContextFixture } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'

void React

describe('administrator password reset pages', () => {
  beforeEach(() => {
    rstest.restoreAllMocks()
  })

  it('shows the protected administrator recovery rule', async () => {
    rstest.spyOn(authApi, 'requestAdminPasswordReset').mockRejectedValue(
      Object.assign(new Error('Denied'), {
        code: 'protected_admin_password_reset_denied',
        status: 403,
      })
    )
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'owner@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: '发送重置邮件' }))
    expect(await screen.findByText(/受保护管理员不支持在线重置密码/)).toBeTruthy()
  })

  it('submits a matching new password with the URL token', async () => {
    const confirm = rstest.spyOn(authApi, 'confirmAdminPasswordReset').mockResolvedValue()
    render(
      <MemoryRouter
        initialEntries={['/reset-password?token=reset-token-value-that-is-long-enough']}
      >
        <ResetPasswordPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('新密码'), {
      target: { value: 'new correct horse battery staple' },
    })
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'new correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: '更新密码' }))

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        newPassword: 'new correct horse battery staple',
        token: 'reset-token-value-that-is-long-enough',
      })
    )
    expect(await screen.findByText(/所有旧会话均已退出/)).toBeTruthy()
  })
  it('activates only once with the URL token and does not replay activation after session-read failure', async () => {
    const session: AdminSession = {
      displayName: 'Activated operator',
      email: 'operator@example.test',
      environment: 'test',
      identityId: 'identity_activated_operator',
      permissions: ['catalog.read'],
      principalKind: 'human',
      role: {
        enabled: true,
        id: 'role_operator',
        key: 'operator',
        name: 'Operator',
        protected: false,
        system: false,
        version: 1,
      },
    }
    let release!: () => void
    const pending = new Promise<AdminSession>((resolve) => {
      release = () => resolve(session)
    })
    const activate = rstest.spyOn(authApi, 'activateAdminAccount').mockImplementation(() => pending)
    const refresh = rstest.fn(async () => {
      throw new Error('Session read unavailable')
    })
    renderInLocale(
      <AuthContext.Provider value={authContextFixture({ refreshSession: refresh })}>
        <MemoryRouter initialEntries={['/activate-account?token=activation-fixture-token']}>
          <ActivateAccountPage />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }))
    expect(await screen.findByText('Enter at least 12 characters.')).toBeTruthy()
    expect(activate).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Set password'), {
      target: { value: 'activation fixture strong password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'activation fixture strong password' },
    })
    const form = screen.getByLabelText('Set password').closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(activate).toHaveBeenCalledTimes(1))
    expect(activate).toHaveBeenCalledWith({
      password: 'activation fixture strong password',
      token: 'activation-fixture-token',
    })
    await act(async () => {
      release()
    })
    expect(await screen.findByText('Account activated. You can now sign in.')).toBeTruthy()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(activate).toHaveBeenCalledTimes(1)
  })
})
