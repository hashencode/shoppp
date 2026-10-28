import React, { useState } from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, waitFor } from '@testing-library/react'
import { MenuEditor, NavigationPage } from './navigation-page'
import { installBrowserApi, renderI18nBrowser } from '../../test/i18n-browser-fixture'
import type { NavigationMenuRecord } from '../../services/storefront/navigation-api'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})

const menu: NavigationMenuRecord = {
  id: 'menu.header',
  placement: 'header',
  status: 'draft',
  version: 1,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  inclusion: {
    candidate: false,
    candidateStale: false,
    live: false,
    liveStale: false,
    staleCauses: [],
  },
  items: [
    {
      id: 'nav.home',
      label: 'Home',
      parentId: null,
      position: 0,
      target: { kind: 'route', path: '/' },
    },
    {
      id: 'nav.shop',
      label: 'International collections and seasonal offers',
      parentId: null,
      position: 1,
      target: { kind: 'route', path: '/collections' },
    },
  ],
}

const LayoutFixture = () => {
  const [compact, setCompact] = useState(false)
  return (
    // The layout breakpoint follows content width rather than the runner viewport.
    <div style={{ width: compact ? 700 : 1100 }}>
      <button onClick={() => setCompact(!compact)}>Toggle container width</button>
      <MenuEditor placement="header" />
    </div>
  )
}

describe('Navigation split layout', () => {
  it('keeps tabs in the Card header and exposes node actions to keyboard and selected touch targets', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/storefront/navigation/header')
        return { data: { data: menu } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <div style={{ width: 1100 }}>
        <NavigationPage />
      </div>,
      ['navigation.read', 'navigation.write'],
      'en-US'
    )
    await expect.element(page.getByLabel('Item label', { exact: true })).toHaveValue('Home')
    expect(document.querySelectorAll('.ant-card')).toHaveLength(1)
    const card = document.querySelector('.navigation-card')!
    const head = card.querySelector('.ant-card-head')!
    const body = card.querySelector('.ant-card-body')!
    const divider = card.querySelector('.navigation-editor')!
    const indicator = head.querySelector('.ant-tabs-ink-bar')!
    expect(head.querySelector('[role=tab]')?.textContent).toBe('Header menu')
    expect(
      Math.abs(indicator.getBoundingClientRect().bottom - head.getBoundingClientRect().bottom)
    ).toBeLessThanOrEqual(1)
    expect(divider.getBoundingClientRect().top).toBe(body.getBoundingClientRect().top)
    expect(divider.getBoundingClientRect().bottom).toBe(body.getBoundingClientRect().bottom)
    const actions = page.getByRole('button', { name: 'Menu item actions for Home', exact: true })
    await actions.press('Enter')
    await expect
      .element(page.getByRole('menuitem', { name: 'Move down', exact: true }))
      .toBeVisible()
    await page.getByRole('menuitem', { name: 'Move down', exact: true }).click()
    await page.getByText(menu.items[1]!.label, { exact: true }).click()
    const selectedActions = document.querySelector(
      '.ant-tree-treenode-selected .navigation-tree-actions'
    )!
    expect(getComputedStyle(selectedActions).opacity).toBe('1')
    expect(getComputedStyle(selectedActions).pointerEvents).toBe('auto')
    const label = selectedActions.previousElementSibling!
    expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
      selectedActions.getBoundingClientRect().left
    )
    expect(document.querySelector('.navigation-editor .navigation-tree-actions')).toBeNull()
    expect(transport.requests).toHaveLength(1)
  })

  it('validates in the action dialog, preserves failures, closes with Escape and publishes only the saved version', async () => {
    let fail = true
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/storefront/navigation/header')
        return { data: { data: menu } }
      if (
        request.method === 'post' &&
        request.url === '/admin/storefront/navigation/header/publish'
      )
        return fail
          ? { data: { error: { code: 'navigation_conflict', message: 'Conflict' } }, status: 409 }
          : { data: { data: { ...menu, status: 'published' } } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MenuEditor placement="header" />,
      ['navigation.read', 'navigation.publish'],
      'en-US'
    )
    await expect.element(page.getByLabel('Item label', { exact: true })).toHaveValue('Home')
    const entry = page.getByRole('button', { name: 'Publish', exact: true })
    await entry.click()
    const dialog = page.getByRole('dialog', { name: 'Publish this exact Navigation version?' })
    await expect.element(dialog).toBeVisible()
    await waitFor(() =>
      expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true)
    )
    const confirm = dialog.getByRole('button', { name: /^(loading )?Publish$/ })
    await confirm.click()
    await expect
      .element(page.getByLabel('Publication reason', { exact: true }))
      .toHaveAttribute('aria-invalid', 'true')
    expect(transport.requests.filter((request) => request.method === 'post')).toHaveLength(0)
    expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true)
    await page.getByLabel('Publication reason', { exact: true }).fill('  Publish menu  ')
    await confirm.click()
    await expect
      .element(
        page.getByText('This Navigation menu changed. Reload it before continuing.', {
          exact: true,
        })
      )
      .toBeVisible()
    await expect
      .element(page.getByLabel('Publication reason', { exact: true }))
      .toHaveValue('  Publish menu  ')
    await dialog.press('Escape')
    await expect.element(dialog).not.toBeVisible()
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Publish'))
    await entry.click()
    await expect.element(page.getByLabel('Publication reason', { exact: true })).toHaveValue('')
    fail = false
    await page.getByLabel('Publication reason', { exact: true }).fill('Publish menu')
    await confirm.click()
    await expect.element(dialog).not.toBeVisible()
    await expect.element(page.getByText('Published', { exact: true })).toBeVisible()
    const requests = transport.requests.filter((request) => request.method === 'post')
    expect(requests).toHaveLength(2)
    for (const request of requests)
      expect(JSON.parse(request.data)).toEqual({
        confirm: true,
        expectedVersion: 1,
        reason: 'Publish menu',
      })
  }, 10_000)

  it('stacks below its width budget and preserves selected drafts without a write', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/storefront/navigation/header')
        return { data: { data: menu } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(<LayoutFixture />, ['navigation.read', 'navigation.write'], 'en-US')
    await expect.element(page.getByLabel('Item label', { exact: true })).toHaveValue('Home')
    const structure = document.querySelector('.navigation-layout > section')!
    const editor = document.querySelector('.navigation-editor')!
    const container = document.querySelector('.navigation-layout-container')!
    expect(container.getBoundingClientRect().width).toBeGreaterThanOrEqual(900)
    expect(editor.getBoundingClientRect().left).toBe(structure.getBoundingClientRect().right)
    expect(getComputedStyle(editor).borderLeftWidth).toBe('1px')
    expect(getComputedStyle(editor).borderLeftColor).not.toBe('rgba(0, 0, 0, 0)')
    await page.getByLabel('Item label', { exact: true }).fill('Unsaved home label')
    await page.getByText(menu.items[1]!.label, { exact: true }).click()
    await expect
      .element(page.getByLabel('Item label', { exact: true }))
      .toHaveValue(menu.items[1]!.label)
    await page.getByRole('button', { name: 'Toggle container width' }).click()
    await waitFor(() => expect(container.getBoundingClientRect().width).toBeLessThan(900))
    expect(editor.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      structure.getBoundingClientRect().bottom
    )
    expect(getComputedStyle(editor).borderTopWidth).toBe('1px')
    expect(editor.getBoundingClientRect().left).toBe(container.getBoundingClientRect().left)
    expect(editor.getBoundingClientRect().right).toBe(container.getBoundingClientRect().right)
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await page.getByText('Unsaved home label', { exact: true }).click()
    await expect
      .element(page.getByLabel('Item label', { exact: true }))
      .toHaveValue('Unsaved home label')
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.element(page.getByLabel('Item label', { exact: true })).toHaveValue('Home')
    expect(transport.requests).toHaveLength(1)
  })
})
