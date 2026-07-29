import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../infrastructure/auth/auth-context'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { LoginPage } from './login-page'

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

const HomeProbe = () => {
  const { isAuthenticated, displayName, accountName } = useAuth()
  return (
    <div>
      <span>{isAuthenticated ? 'AUTHED' : 'ANON'}</span>
      <span>{displayName}</span>
      <span>{accountName}</span>
    </div>
  )
}

const renderPage = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('logs in and redirects to home after valid account submit', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: '账号密码登录' }))
    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: '登 录' }))

    await waitFor(() => {
      expect(screen.getByText('AUTHED')).toBeTruthy()
      expect(screen.getByText('Access operator')).toBeTruthy()
      expect(screen.getByText('alice')).toBeTruthy()
    })
  })

  it('shows required validation errors in phone mode when form is empty', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: '手机号登录' }))
    fireEvent.click(screen.getByRole('button', { name: '登 录' }))

    await waitFor(() => {
      expect(screen.getByText('请输入手机号！')).toBeTruthy()
      expect(screen.getByText('请输入验证码！')).toBeTruthy()
    })
  })

  it('updates captcha button text after requesting code with valid phone', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: '手机号登录' }))
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '13800138000' } })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() => {
      const captchaButton = screen.getByRole('button', { name: /获取验证码/ })
      expect(captchaButton.textContent).toContain('获取验证码')
      expect((captchaButton as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
