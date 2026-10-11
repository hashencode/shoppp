import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, beforeEach } from '@rstest/core'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()

  return (
    <>
      <div data-testid="location-probe">{`${location.pathname}${location.search}${location.hash}`}</div>
      <button onClick={() => navigate(-1)}>Browser back</button>
    </>
  )
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
    renderShell({ routes: templateRoutes, initialEntry: '/welcome' })
    expect(screen.getAllByRole('menuitem', { name: /开店指南/ })).toHaveLength(1)
    expect(screen.queryByRole('menuitem', { name: '欢迎' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /设置/ })).toBeTruthy()
  })

  it('keeps the auth-only setup guide but omits welcome without settings access', () => {
    renderShell({
      routes: templateRoutes,
      initialEntry: '/welcome',
      auth: { permissions: ['catalog.read'] },
    })
    expect(screen.getByRole('menuitem', { name: /开店指南/ })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '欢迎' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /商品$/ })).toBeTruthy()
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
        { ...routeMetaRoutes[0]!, menuMode: 'standalone', menuGroup: 'Home', breadcrumb },
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

  it.each([
    {
      locale: 'en-US' as const,
      groups: [
        ['Home', ['Commerce dashboard', 'Store setup guide']],
        ['Orders', ['Orders', 'Shipping and fulfillment']],
        ['Products', ['Products', 'Product collections', 'Inventory', 'Reviews']],
        ['Content', ['Pages', 'Articles', 'Navigation menus']],
        ['Online store', ['Store design']],
        ['Analytics', ['Revenue report']],
        [
          'Settings',
          [
            'Store details',
            'Contact information',
            'Business settings',
            'Shipping settings',
            'Policies',
            'Users & invitations',
            'Roles and permissions',
            'Privacy requests',
            'Audit log',
            'Automated task recovery',
          ],
        ],
      ],
    },
    {
      locale: 'zh-CN' as const,
      groups: [
        ['首页', ['商业仪表盘', '开店指南']],
        ['订单', ['订单', '发货与履约']],
        ['商品', ['商品', '商品系列', '库存', '评价']],
        ['内容', ['页面', '文章', '导航菜单']],
        ['在线商店', ['店铺装修']],
        ['数据分析', ['收入报表']],
        [
          '设置',
          [
            '店铺资料',
            '联系信息',
            '经营设置',
            '配送设置',
            '政策',
            '用户与邀请',
            '角色与权限',
            '隐私请求',
            '审计记录',
            '自动任务恢复',
          ],
        ],
      ],
    },
  ])(
    'expands the seven ordered merchant groups in $locale without parent destinations',
    ({ locale, groups }) => {
      renderShell({ routes: templateRoutes, locale })
      const menu = screen.getAllByRole('menu')[0]!
      const topLevelItems = Array.from(menu.children) as HTMLElement[]
      expect(
        topLevelItems.map((item) => item.querySelector('[role="menuitem"]')?.textContent)
      ).toEqual(groups.map(([name]) => name))

      for (const [name, children] of groups) {
        const group = topLevelItems.find(
          (item) => item.querySelector('[role="menuitem"]')?.textContent === name
        )!
        fireEvent.click(group.querySelector('[role="menuitem"]')!)
        expect(
          within(group)
            .getAllByRole('menuitem')
            .map((item) => item.textContent?.trim())
        ).toEqual([name, ...children!])
        expect(screen.getByTestId('location-probe').textContent).toBe('/')
      }
    }
  )

  it.each([
    { permissions: [], groups: ['首页'], items: ['首页', '开店指南'] },
    {
      permissions: ['orders.read'],
      groups: ['首页', '订单'],
      items: ['首页', '开店指南', '订单', '订单'],
    },
    {
      permissions: ['iam.users.read', 'iam.roles.read'],
      groups: ['首页', '设置'],
      items: ['首页', '开店指南', '设置', '用户与邀请', '角色与权限'],
    },
  ] as const)(
    'filters task groups and their children for $permissions',
    ({ permissions, groups, items }) => {
      renderShell({ routes: templateRoutes, auth: { permissions } })
      const menu = screen.getAllByRole('menu')[0]!
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(
        groups
      )
      for (const group of Array.from(menu.children)) {
        fireEvent.click(group.querySelector('[role="menuitem"]')!)
      }
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(items)
      expect(screen.queryByRole('menuitem', { name: '商业仪表盘' })).toBeNull()
      expect(screen.queryByRole('menuitem', { name: '发货与履约' })).toBeNull()
    }
  )

  it.each([
    [
      '/catalog/products/form?mode=modify&id=product-1&from=setup-guide#media',
      '商品',
      '商品',
      true,
    ],
    ['/catalog/collections/form?mode=readonly&id=collection-1#members', '商品', '商品系列', false],
    ['/content/pages/form?mode=modify&id=page-1&from=setup-guide#body', '内容', '页面', true],
    ['/content/articles/form?mode=modify&id=article-1#body', '内容', '文章', false],
    ['/storefront/themes/draft-1?from=setup-guide#preview', '在线商店', '店铺装修', true],
    ['/orders/order-1?from=setup-guide#timeline', '订单', '订单', true],
    ['/access/users/user-1?tab=roles#access', '设置', '用户与邀请', false],
    ['/access/roles/role-1?tab=permissions#access', '设置', '角色与权限', false],
  ] as const)(
    'selects the owning task for %s and preserves history and guide provenance',
    async (entry, groupName, itemName, hasGuideReturn) => {
      renderShell({ routes: templateRoutes, initialEntry: entry })
      const group = (Array.from(screen.getAllByRole('menu')[0]!.children) as HTMLElement[]).find(
        (item) => item.querySelector('[role="menuitem"]')?.textContent === groupName
      )!
      expect(group.querySelector('[role="menuitem"]')?.getAttribute('aria-expanded')).toBe('true')
      const item = within(group)
        .getAllByRole('menuitem')
        .find((item) => item.className.includes('ant-menu-item-selected'))!
      expect(item.textContent?.trim()).toBe(itemName)
      expect(screen.getByTestId('location-probe').textContent).toBe(entry)
      expect(Boolean(screen.queryByRole('link', { name: '返回开店指南' }))).toBe(hasGuideReturn)

      fireEvent.click(item)
      await waitFor(() => expect(screen.getByTestId('location-probe').textContent).not.toBe(entry))
      fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
      await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(entry))
    }
  )

  it.each(['', '/admin'])(
    'preserves expanded and manually closed groups across navigation under basename "%s"',
    async (basename) => {
      renderShell({
        basename: basename || undefined,
        initialEntry: `${basename}/welcome`,
        locale: 'en-US',
        routes: templateRoutes,
      })
      const groupTitle = (name: string) =>
        Array.from(screen.getAllByRole('menu')[0]!.children)
          .map((item) => item.querySelector('[role="menuitem"]')!)
          .find((item) => item.textContent === name)!

      fireEvent.click(groupTitle('Content'))
      fireEvent.click(groupTitle('Settings'))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Contact information' }))
      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe('/settings/contact')
      )
      for (const name of ['Home', 'Content', 'Settings']) {
        expect(groupTitle(name).getAttribute('aria-expanded')).toBe('true')
      }
      expect(screen.getByRole('menuitem', { name: 'Contact information' }).className).toContain(
        'ant-menu-item-selected'
      )

      fireEvent.click(groupTitle('Content'))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Commerce dashboard' }))
      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe('/dashboard')
      )
      fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
      await waitFor(() =>
        expect(screen.getByTestId('location-probe').textContent).toBe('/settings/contact')
      )
      expect(groupTitle('Content').getAttribute('aria-expanded')).toBe('false')
      for (const name of ['Home', 'Settings']) {
        expect(groupTitle(name).getAttribute('aria-expanded')).toBe('true')
      }
    }
  )

  it('opens and selects a direct Settings route while retaining the original English breadcrumbs', () => {
    const { container } = renderShell({
      initialEntry: '/settings/contact',
      locale: 'en-US',
      routes: templateRoutes,
    })
    expect(screen.getByRole('menuitem', { name: /Settings$/ }).getAttribute('aria-expanded')).toBe(
      'true'
    )
    expect(screen.getByRole('menuitem', { name: 'Contact information' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain(
      'Store settings/Contact settings'
    )
  })

  it('restores the active Settings group after collapsing under the /admin basename', () => {
    const { container } = renderShell({
      basename: '/admin',
      initialEntry: '/admin/settings/shipping',
      routes: templateRoutes,
    })
    expect(screen.getByRole('menuitem', { name: '配送设置' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(container.querySelector('.ant-breadcrumb')?.textContent).toContain('店铺配置/配送设置')
    fireEvent.click(screen.getByRole('img', { name: 'menu-fold' }).parentElement!)
    fireEvent.click(screen.getByRole('img', { name: 'menu-unfold' }).parentElement!)
    expect(
      within(screen.getAllByRole('menu')[0]!)
        .getAllByRole('menuitem')
        .find((item) => item.textContent === '设置')
        ?.getAttribute('aria-expanded')
    ).toBe('true')
    expect(screen.getByRole('menuitem', { name: '配送设置' }).className).toContain(
      'ant-menu-item-selected'
    )
    expect(screen.getByTestId('location-probe').textContent).toBe('/settings/shipping')
  })

  it.each([
    ['/welcome', 'Store setup guide|'],
    ['/dashboard', 'Commerce dashboard|Commerce dashboard'],
  ])('keeps protected page metadata and content geometry at %s', (path, meta) => {
    const { container } = renderShellWithRouteMeta(templateRoutes, path)
    expect(container.querySelector('.ant-breadcrumb')).toBeNull()
    expect(screen.getByTestId('route-meta-probe').textContent).toBe(
      meta!.replace('Store setup guide', '开店指南').replaceAll('Commerce dashboard', '商业仪表盘')
    )
    expect(container.querySelector('.ant-layout-sider')?.getAttribute('style')).toContain(
      'width: 224px'
    )
    expect(container.querySelector('.ant-layout-content')?.className).toContain(
      'min-h-0 overflow-y-auto p-6'
    )
    expect(container.querySelector('.ant-layout-content')?.getAttribute('style')).toContain(
      'scrollbar-gutter: stable both-edges'
    )
  })
})
