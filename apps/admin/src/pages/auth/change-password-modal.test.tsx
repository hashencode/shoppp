import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, rstest } from '@rstest/core'
import * as authApi from '../../services/auth/api'
import { ChangePasswordModal } from './change-password-modal'

void React

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    rstest.restoreAllMocks()
  })

  it('verifies the current password and submits a matching new password', async () => {
    const change = rstest.spyOn(authApi, 'changeAdminPassword').mockResolvedValue()
    const close = rstest.fn()
    render(<ChangePasswordModal onClose={close} open />)

    fireEvent.change(screen.getByLabelText('当前密码'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.change(screen.getByLabelText('新密码'), {
      target: { value: 'new correct horse battery staple' },
    })
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'new correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改密码' }))

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        currentPassword: 'correct horse battery staple',
        newPassword: 'new correct horse battery staple',
      })
    )
    expect(close).toHaveBeenCalledTimes(1)
  })
  it('keeps mismatched confirmation at zero writes and submits only the API password fields after correction', async () => {
    const change = rstest.spyOn(authApi, 'changeAdminPassword').mockResolvedValue()
    const close = rstest.fn()
    render(<ChangePasswordModal onClose={close} open />)
    fireEvent.change(screen.getByLabelText('当前密码'), {
      target: { value: 'current fixture password' },
    })
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new fixture password' } })
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'another fixture password' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改密码' }))
    await screen.findByText('两次输入的密码不一致。')
    expect(change).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'new fixture password' },
    })
    fireEvent.click(screen.getByRole('button', { name: '修改密码' }))
    await waitFor(() =>
      expect(change.mock.calls).toEqual([
        [{ currentPassword: 'current fixture password', newPassword: 'new fixture password' }],
      ])
    )
    expect(close).toHaveBeenCalledTimes(1)
  })
})
