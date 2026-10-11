import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { ADMIN_PERMISSION_KEYS } from '@shoppp/contracts'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { templateRoutes } from '../../routes/routes.config'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  renderI18nBrowser,
} from '../../test/i18n-browser-fixture'
import { AppShell } from './app-shell'
import { useRoutePageMeta } from './route-page-meta-context'

void React

afterEach(cleanup)

const RouteProbe = () => {
  const location = useLocation()
  const meta = useRoutePageMeta()
  return (
    <div data-testid="native-route">
      {location.pathname}|{meta?.title}
    </div>
  )
}

describe('merchant navigation in a native browser', () => {
  it('uses the library keyboard menu while preserving standalone page metadata and sidebar widths', async () => {
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route element={<AppShell routes={templateRoutes} />}>
            <Route path="*" element={<RouteProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
      ADMIN_PERMISSION_KEYS,
      'en-US'
    )
    assertNativeBrowserAndCss()
    const sidebar = document.querySelector('.ant-layout-sider')!
    assertWithinViewport(sidebar)
    if (window.innerWidth < 992) {
      await waitFor(() => expect(sidebar.getBoundingClientRect().width).toBe(80))
      await page.getByRole('img', { name: 'menu-unfold' }).click()
      await waitFor(() => expect(sidebar.getBoundingClientRect().width).toBe(224))
    }
    expect(sidebar.getBoundingClientRect().width).toBe(224)
    expect(document.querySelector('.ant-breadcrumb')).toBeNull()
    expect(screen.getByTestId('native-route').textContent).toBe('/welcome|Store setup guide')
    const menu = document.querySelector('.ant-menu-root')!
    expect(menu.querySelectorAll(':scope > .ant-menu-submenu')).toHaveLength(7)

    await page.getByRole('menuitem', { name: 'Commerce dashboard', exact: true }).press('Enter')
    await waitFor(() =>
      expect(screen.getByTestId('native-route').textContent).toBe('/dashboard|Commerce dashboard')
    )
    expect(document.querySelector('.ant-breadcrumb')).toBeNull()
    await page.getByRole('menuitem', { name: /Content$/ }).press('Enter')
    await page.getByRole('menuitem', { name: /Settings$/ }).press('Enter')
    await page.getByRole('menuitem', { name: /Online store/ }).press('Enter')
    await page.getByRole('menuitem', { name: 'Store design', exact: true }).press('Enter')
    await waitFor(() =>
      expect(screen.getByTestId('native-route').textContent).toBe(
        '/storefront/themes|Storefront themes'
      )
    )
    for (const name of ['Home', 'Content', 'Settings', 'Online store']) {
      expect(
        screen.getByRole('menuitem', { name: new RegExp(`${name}$`) }).getAttribute('aria-expanded')
      ).toBe('true')
    }
    await page.getByRole('img', { name: 'menu-fold' }).click()
    await waitFor(() => expect(sidebar.getBoundingClientRect().width).toBe(80))
    assertWithinViewport(sidebar)
  })
})
