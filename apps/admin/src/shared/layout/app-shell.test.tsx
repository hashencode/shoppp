import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../contexts/theme-context'
import { AppShell } from './app-shell'
import { useRoutePageMeta } from './route-page-meta-context'
import { authContextFixture } from '../../test/auth-context-fixture'
import type { AuthContextValue } from '../../infrastructure/auth/auth-context'
import { renderInLocale } from '../../test/render-in-locale'
import { LANGUAGE_STORAGE_KEY, type AppLocale } from '../contexts/i18n-context'

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

const renderShell = (options?: {
  auth?: Partial<AuthContextValue>
  locale?: AppLocale
  onLogout?: () => void
  routes?: React.ComponentProps<typeof AppShell>['routes']
}) => {
  const onLogout = options?.onLogout ?? (() => undefined)

  return renderInLocale(
    <AuthContext.Provider
      value={authContextFixture({
        accountName: 'alice.account',
        displayName: 'Alice Admin',
        ...options?.auth,
        logout: onLogout,
      })}
    >
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<AppShell routes={options?.routes ?? []} />}>
              <Route index element={<div>首页内容</div>} />
            </Route>
            <Route path="/login" element={<div>登录页</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>,
    options?.locale ?? 'zh-CN'
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
  renderInLocale(
    <AuthContext.Provider
      value={authContextFixture({
        accountName: 'alice.account',
        displayName: 'Alice Admin',
      })}
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
    </AuthContext.Provider>,
    'zh-CN'
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
      expect(screen.getByText('语言')).toBeTruthy()
      expect(screen.queryByText('搜索偏好')).toBeNull()
    })

    fireEvent.click(screen.getByText('点击复制账号'))

    await waitFor(() => {
      expect(copiedTexts).toEqual(['alice.account'])
    })
  })

  it('switches language from the account menu and persists the selection', async () => {
    renderShell()

    fireEvent.click(screen.getByText('alice.account'))
    await waitFor(() => expect(screen.getByText('语言')).toBeTruthy())
    fireEvent.mouseEnter(screen.getByText('语言'))
    await waitFor(() => expect(screen.getByText('English')).toBeTruthy())
    fireEvent.click(screen.getByText('English'))

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeTruthy()
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US')
    })
  })

  it('switches back to Chinese and persists the selection', async () => {
    renderShell({ locale: 'en-US' })

    fireEvent.click(screen.getByText('alice.account'))
    await waitFor(() => expect(screen.getByText('Language')).toBeTruthy())
    fireEvent.mouseEnter(screen.getByText('Language'))
    await waitFor(() => expect(screen.getByText('Simplified Chinese')).toBeTruthy())
    fireEvent.click(screen.getByText('Simplified Chinese'))

    await waitFor(() => {
      expect(screen.getByText('欢迎')).toBeTruthy()
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN')
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
    })
  })

  it('does not render human profile controls for a service session', async () => {
    renderShell({
      auth: {
        accountName: 'catalog-build-service',
        displayName: 'Catalog build service',
        principalKind: 'service',
      },
    })
    fireEvent.click(screen.getByText('catalog-build-service'))
    await waitFor(() => expect(screen.getByText('色彩模式')).toBeTruthy())
    expect(screen.queryByText('点击复制账号')).toBeNull()
  })

  it('provides current route title and breadcrumb meta to content recipes', () => {
    renderShellWithRouteMeta()

    expect(screen.getByTestId('route-meta-probe').textContent).toBe('Alpha 页面|一级导航>Alpha 页面')
    expect(screen.getAllByText('一级导航').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alpha 页面').length).toBeGreaterThan(0)
  })

  it('shows the Access management group only when authoritative IAM permissions allow it', async () => {
    const accessRoutes = [
      {
        key: 'iam-users',
        path: '/access/users',
        title: 'Users & invitations',
        icon: null,
        permission: 'iam.users.read' as const,
        inMenu: true,
        menuGroup: 'Access management',
      },
      {
        key: 'iam-roles',
        path: '/access/roles',
        title: 'Roles',
        icon: null,
        permission: 'iam.roles.read' as const,
        inMenu: true,
        menuGroup: 'Access management',
      },
    ]
    const { rerender } = renderShell({
      auth: { permissions: ['iam.users.read'] },
      routes: accessRoutes,
    })

    fireEvent.click(await screen.findByText('访问管理'))
    expect(await screen.findByText('用户与邀请')).toBeTruthy()
    expect(screen.queryByText('角色')).toBeNull()

    rerender(
      <AuthContext.Provider value={authContextFixture({ permissions: [] })}>
        <ThemeProvider>
          <MemoryRouter>
            <Routes>
              <Route path="/" element={<AppShell routes={accessRoutes} />}>
                <Route index element={<div>Home</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </AuthContext.Provider>
    )
    expect(screen.queryByText('访问管理')).toBeNull()
  })
})
