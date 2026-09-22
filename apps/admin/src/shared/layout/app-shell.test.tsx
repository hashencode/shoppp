import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, beforeEach } from '@rstest/core'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../contexts/theme-context'
import { AppShell } from './app-shell'
import { useRoutePageMeta } from './route-page-meta-context'
import { authContextFixture } from '../../test/auth-context-fixture'
import type { AuthContextValue } from '../../infrastructure/auth/auth-context'
import { renderInLocale } from '../../test/render-in-locale'
import { LANGUAGE_STORAGE_KEY, type AppLocale } from '../contexts/i18n-context'
import { templateRoutes } from '../../routes/routes.config'

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

const LocationProbe = () => {
  const location = useLocation()

  return <div data-testid="location-probe">{`${location.pathname}${location.search}${location.hash}`}</div>
}

const renderShell = (options?: {
  auth?: Partial<AuthContextValue>
  basename?: string
  initialEntry?: string
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
        <MemoryRouter
          basename={options?.basename}
          initialEntries={[options?.initialEntry ?? `${options?.basename ?? ''}/`]}
        >
          <Routes>
            <Route path="/" element={<AppShell routes={options?.routes ?? []} />}>
              <Route index element={<LocationProbe />} />
              <Route path="*" element={<LocationProbe />} />
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

const renderShellWithRouteMeta = (
  routes: React.ComponentProps<typeof AppShell>['routes'] = routeMetaRoutes,
  pathname = '/alpha'
) =>
  renderInLocale(
    <AuthContext.Provider
      value={authContextFixture({
        accountName: 'alice.account',
        displayName: 'Alice Admin',
      })}
    >
      <ThemeProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <Routes>
            <Route path="/" element={<AppShell routes={routes} />}>
              <Route index element={<RouteMetaProbe />} />
              <Route path="*" element={<RouteMetaProbe />} />
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

  it('replaces the old welcome menu with one authorized setup guide entry', () => {
    renderShell({ routes: templateRoutes })
    expect(screen.getAllByRole('menuitem', { name: /开店指南/ })).toHaveLength(1)
    expect(screen.queryByRole('menuitem', { name: '欢迎' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /店铺配置/ })).toBeTruthy()
  })

  it('omits setup navigation for staff without settings access', () => {
    renderShell({ routes: templateRoutes, auth: { permissions: ['catalog.read'] } })
    expect(screen.queryByRole('menuitem', { name: /开店指南/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '欢迎' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /商品目录/ })).toBeTruthy()
  })

  it('does not use the fallback route as home breadcrumb metadata', () => {
    const { container } = renderShellWithRouteMeta(templateRoutes, '/')
    expect(container.querySelector('.ant-breadcrumb')).toBeNull()
    expect(screen.getByTestId('route-meta-probe').textContent).toBe('欢迎|')
  })

  it.each(templateRoutes.filter((route) => route.inMenu && route.menuMode === 'standalone'))(
    'omits redundant breadcrumbs on the registered standalone route $path',
    (route) => {
      const { container } = renderShellWithRouteMeta(templateRoutes, route.path)
      expect(container.querySelector('.ant-breadcrumb')).toBeNull()
    }
  )

  it.each([[], ['Alpha 页面'], ['一级导航', 'Alpha 页面']].map((breadcrumb) => ({ breadcrumb })))(
    'hides breadcrumbs for standalone entries regardless of classification labels: %j',
    ({ breadcrumb }) => {
      const { container } = renderShellWithRouteMeta([
        { ...routeMetaRoutes[0]!, menuMode: 'standalone', breadcrumb },
      ])
      expect(container.querySelector('.ant-breadcrumb')).toBeNull()
      expect(screen.getByTestId('route-meta-probe').textContent).toBe(
        `Alpha 页面|${breadcrumb.join('>')}`
      )
    }
  )

  it('hides a single breadcrumb even for grouped entries', () => {
    const { container } = renderShellWithRouteMeta([
      { ...routeMetaRoutes[0]!, breadcrumb: ['Alpha 页面'] },
    ])
    expect(container.querySelector('.ant-breadcrumb')).toBeNull()
  })

  it('retains real grouped hierarchy and resolves dynamic detail metadata', () => {
    const { container } = renderShellWithRouteMeta(
      [
        ...routeMetaRoutes,
        {
          ...routeMetaRoutes[0]!,
          key: 'detail',
          path: '/alpha/:id',
          inMenu: false,
          title: '详情',
          breadcrumb: ['Alpha 页面', '详情'],
        },
      ],
      '/alpha/123'
    )
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain('Alpha 页面')
    expect(screen.getByTestId('route-meta-probe').textContent).toBe('详情|Alpha 页面>详情')
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
      expect(screen.getAllByText('Language changed to English.')).toHaveLength(1)
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
      expect(screen.getAllByText('语言已切换为简体中文。')).toHaveLength(1)
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
    const { container } = renderShellWithRouteMeta()
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain('一级导航')

    expect(screen.getByTestId('route-meta-probe').textContent).toBe(
      'Alpha 页面|一级导航>Alpha 页面'
    )
    expect(screen.getAllByText('一级导航').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alpha 页面').length).toBeGreaterThan(0)
  })

  it('expands Store settings in the accepted order without making the parent a destination', async () => {
    renderShell({ routes: templateRoutes })

    const storeSettings = screen.getByRole('menuitem', { name: /店铺配置/ })
    expect(screen.getByTestId('location-probe').textContent).toBe('/')
    fireEvent.click(storeSettings)

    const groupItems = within(storeSettings.closest('li')!).getAllByRole('menuitem')
    expect(groupItems.map((item) => item.textContent?.trim()).filter(Boolean)).toEqual([
      '店铺配置',
      '店铺身份',
      '政策',
      '商业设置',
      '联系方式设置',
      '配送设置',
    ])
    expect(screen.getByTestId('location-probe').textContent).toBe('/')

    fireEvent.click(screen.getByRole('menuitem', { name: '商业设置' }))
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe('/settings/launch')
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '联系方式设置' }))
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe('/settings/contact')
    )
    fireEvent.click(screen.getByRole('menuitem', { name: '配送设置' }))
    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe('/settings/shipping')
    )
  })

  it('shows Store settings only with settings.read permission', () => {
    const { unmount } = renderShell({
      auth: { permissions: ['settings.read'] },
      routes: templateRoutes,
    })
    expect(screen.getByRole('menuitem', { name: /店铺配置/ })).toBeTruthy()
    unmount()

    renderShell({ auth: { permissions: ['catalog.read'] }, routes: templateRoutes })
    expect(screen.queryByRole('menuitem', { name: /店铺配置/ })).toBeNull()
  })

  it('opens and selects a direct Store settings route with English breadcrumbs', () => {
    const { container } = renderShell({
      initialEntry: '/settings/contact',
      locale: 'en-US',
      routes: templateRoutes,
    })

    const storeSettings = screen.getByRole('menuitem', { name: /Store settings/ })
    expect(storeSettings.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menuitem', { name: 'Contact settings' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain(
      'Store settings/Contact settings'
    )
  })

  it('restores the active Store settings group after collapsing under the /admin basename', () => {
    const { container } = renderShell({
      basename: '/admin',
      initialEntry: '/admin/settings/shipping',
      routes: templateRoutes,
    })

    expect(screen.getByRole('menuitem', { name: '配送设置' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain(
      '店铺配置/配送设置'
    )

    fireEvent.click(screen.getByRole('img', { name: 'menu-fold' }).parentElement!)
    fireEvent.click(screen.getByRole('img', { name: 'menu-unfold' }).parentElement!)

    const storeSettings = screen.getByRole('menuitem', { name: /店铺配置/ })
    expect(storeSettings.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menuitem', { name: '配送设置' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(screen.getByTestId('location-probe').textContent).toBe('/settings/shipping')
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
