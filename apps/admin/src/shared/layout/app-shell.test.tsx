import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../contexts/theme-context'
import { AppShell } from './app-shell'
import { useRoutePageMeta } from './route-page-meta-context'

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

const renderShell = (options?: { onLogout?: () => void }) => {
  const onLogout = options?.onLogout ?? (() => undefined)

  return render(
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        role: 'admin',
        displayName: 'Alice Admin',
        accountName: 'alice.account',
        setRole: () => undefined,
        setDisplayName: () => undefined,
        setAccountName: () => undefined,
        login: () => undefined,
        logout: onLogout,
      }}
    >
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<AppShell routes={[]} />}>
              <Route index element={<div>首页内容</div>} />
            </Route>
            <Route path="/login" element={<div>登录页</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>
  )
}

const routeMetaRoutes = [
  {
    key: 'alpha',
    path: '/alpha',
    title: 'Alpha 页面',
    icon: null,
    permission: 'catalog.read' as const,
    inMenu: true,
    breadcrumb: ['一级导航', 'Alpha 页面'],
  },
]

const RouteMetaProbe = () => {
  const routeMeta = useRoutePageMeta()

  return (
    <div data-testid="route-meta-probe">
      {routeMeta?.title ?? ''}
      {'|'}
      {routeMeta?.breadcrumbItems.map((item) => item.title).join('>') ?? ''}
    </div>
  )
}

const renderShellWithRouteMeta = () =>
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        role: 'admin',
        displayName: 'Alice Admin',
        accountName: 'alice.account',
        setRole: () => undefined,
        setDisplayName: () => undefined,
        setAccountName: () => undefined,
        login: () => undefined,
        logout: () => undefined,
      }}
    >
      <ThemeProvider>
        <MemoryRouter initialEntries={['/alpha']}>
          <Routes>
            <Route path="/" element={<AppShell routes={routeMetaRoutes} />}>
              <Route path="alpha" element={<RouteMetaProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>
  )

describe('AppShell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the account name next to the avatar and copies it from the user menu', async () => {
    const copiedTexts: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copiedTexts.push(text)
        },
      },
    })

    renderShell()

    expect(screen.getByText('alice.account')).toBeTruthy()
    expect(screen.queryByText('Alice Admin')).toBeNull()

    fireEvent.click(screen.getByText('alice.account'))

    await waitFor(() => {
      expect(screen.getByText('点击复制账号')).toBeTruthy()
      expect(screen.getByText('色彩模式')).toBeTruthy()
      expect(screen.getByText('表单对齐')).toBeTruthy()
      expect(screen.queryByText('搜索偏好')).toBeNull()
    })

    fireEvent.click(screen.getByText('点击复制账号'))

    await waitFor(() => {
      expect(copiedTexts).toEqual(['alice.account'])
    })
  })

  it('logs out from the user dropdown', async () => {
    let logoutCalled = false
    renderShell({
      onLogout: () => {
        logoutCalled = true
      },
    })

    fireEvent.click(screen.getByText('alice.account'))

    await waitFor(() => {
      expect(screen.getByText('退出登录')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('退出登录'))

    await waitFor(() => {
      expect(logoutCalled).toBe(true)
      expect(screen.getByText('登录页')).toBeTruthy()
    })
  })

  it('provides current route title and breadcrumb meta to content recipes', () => {
    renderShellWithRouteMeta()

    expect(screen.getByTestId('route-meta-probe').textContent).toBe('Alpha 页面|一级导航>Alpha 页面')
    expect(screen.getAllByText('一级导航').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alpha 页面').length).toBeGreaterThan(0)
  })
})
