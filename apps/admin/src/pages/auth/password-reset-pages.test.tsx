import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { MemoryRouter } from 'react-router-dom'
import * as authApi from '../../services/auth/api'
import { ForgotPasswordPage } from './forgot-password-page'
import { ResetPasswordPage } from './reset-password-page'

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
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'owner@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: '发送重置邮件' }))
    expect(await screen.findByText(/受保护管理员不支持在线重置密码/)).toBeTruthy()
  })

  it('submits a matching new password with the URL token', async () => {
    const confirm = rstest.spyOn(authApi, 'confirmAdminPasswordReset').mockResolvedValue()
    render(
      <MemoryRouter initialEntries={['/reset-password?token=reset-token-value-that-is-long-enough']}>
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
})
