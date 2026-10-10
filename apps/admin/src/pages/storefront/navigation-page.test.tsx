import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

import type { NavigationMenu } from '@shoppp/contracts'
import type { AdminPermission } from '@shoppp/contracts'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import type { NavigationMenuRecord } from '../../services/storefront/navigation-api'
import { MenuEditor, moveNavigationItem } from './navigation-page'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const items: NavigationMenu['items'] = [
  {
    id: 'nav.home',
    label: 'Home',
    parentId: null,
    position: 0,
    target: { kind: 'route', path: '/' },
  },
  {
    id: 'nav.shop',
    label: 'Shop',
    parentId: null,
    position: 1,
    target: { kind: 'route', path: '/shop-left' },
  },
  {
    id: 'nav.men',
    label: 'Men',
    parentId: 'nav.shop',
    position: 0,
    target: { kind: 'route', path: '/collections/men' },
  },
]

const record = (overrides: Partial<NavigationMenuRecord> = {}): NavigationMenuRecord => ({
  createdAt: '2026-09-23T00:00:00.000Z',
  id: 'menu.header',
  inclusion: {
    candidate: false,
    candidateStale: false,
    live: false,
    liveStale: false,
    staleCauses: [],
  },
  items: [items[0]!],
  placement: 'header',
  status: 'draft',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 1,
  ...overrides,
})

let currentRecord = record()
let loadFailures = 0
let resourceRequests = 0
let saveConflict = false
let publishRequests = 0
const server = setupServer(
  http.get('*/admin/storefront/navigation/header', () => {
    if (loadFailures > 0) {
      loadFailures -= 1
      return HttpResponse.json(
        { error: { code: 'QUERY_SERVER_ERROR', message: 'Unavailable' } },
        { status: 500 }
      )
    }
    return HttpResponse.json({ data: currentRecord })
  }),
  http.get('*/admin/storefront/navigation/resources', () => {
    resourceRequests += 1
    return HttpResponse.json({ data: [], page: 1, pageSize: 12, total: 0 })
  }),
  http.put('*/admin/storefront/navigation/header', async () => {
    if (saveConflict)
      return HttpResponse.json(
        { error: { code: 'navigation_conflict', message: 'Raw conflict' } },
        { status: 409 }
      )
    currentRecord = record({ version: 2 })
    return HttpResponse.json({ data: currentRecord })
  }),
  http.post('*/admin/storefront/navigation/header/publish', () => {
    publishRequests += 1
    currentRecord = record({ status: 'published' })
    return HttpResponse.json({ data: currentRecord })
  })
)

const renderEditor = (permissions: readonly AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider role="content_operator" permissions={permissions}>
      <MenuEditor placement="header" />
    </AuthTestProvider>,
    'en-US'
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  currentRecord = record()
  loadFailures = 0
  resourceRequests = 0
  saveConflict = false
  publishRequests = 0
  server.resetHandlers()
})
afterAll(() => server.close())

describe('NavigationPage ordering', () => {
  it('moves, indents, and outdents while preserving stable IDs and contiguous sibling order', () => {
    const moved = moveNavigationItem(items, 'nav.shop', 'up')
    expect(moved.focusId).toBe('nav.shop')
    expect(moved.items.find(({ id }) => id === 'nav.shop')).toMatchObject({ position: 0 })
    expect(moved.items.find(({ id }) => id === 'nav.home')).toMatchObject({ position: 1 })
    const indented = moveNavigationItem(items, 'nav.shop', 'indent')
    expect(indented.items.find(({ id }) => id === 'nav.shop')).toMatchObject({
      parentId: 'nav.home',
      position: 0,
    })
    const outdented = moveNavigationItem(items, 'nav.men', 'outdent')
    expect(outdented.items.find(({ id }) => id === 'nav.men')).toMatchObject({
      parentId: null,
      position: 2,
    })
  })

  it('chooses a deterministic neighboring focus target after removal', () => {
    expect(moveNavigationItem(items, 'nav.shop', 'remove')).toMatchObject({ focusId: 'nav.home' })
    expect(moveNavigationItem([items[0]!], 'nav.home', 'remove')).toMatchObject({
      focusFallback: 'add',
      items: [],
    })
  })

  it('places an outdented child immediately after its former parent', () => {
    const tree: NavigationMenu['items'] = [
      { ...items[0]!, id: 'nav.a', label: 'A', position: 0 },
      { ...items[2]!, id: 'nav.a.child', label: 'A child', parentId: 'nav.a', position: 0 },
      { ...items[0]!, id: 'nav.b', label: 'B', position: 1 },
      { ...items[0]!, id: 'nav.c', label: 'C', position: 2 },
    ]
    const outdented = moveNavigationItem(tree, 'nav.a.child', 'outdent')
    expect(
      outdented.items.map(({ id, parentId, position }) => ({ id, parentId, position }))
    ).toEqual([
      { id: 'nav.a', parentId: null, position: 0 },
      { id: 'nav.a.child', parentId: null, position: 1 },
      { id: 'nav.b', parentId: null, position: 2 },
      { id: 'nav.c', parentId: null, position: 3 },
    ])
  })
})

describe('MenuEditor integration', () => {
  it('mounts a retryable load and keeps a custom role read-only without leaking target queries', async () => {
    loadFailures = 1
    currentRecord = record({
      items: [
        {
          ...items[0]!,
          target: { kind: 'internal', reference: { id: 'page.about', kind: 'page' } },
        },
      ],
    })
    renderEditor(['navigation.read'])
    expect(await screen.findByText('Navigation could not be loaded')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('Home')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(
      screen.getByText('You do not have permission to browse this resource type.')
    ).toBeTruthy()
    expect(resourceRequests).toBe(0)
    expect(screen.getByRole('textbox', { name: 'Item label' }).hasAttribute('disabled')).toBe(true)
  })

  it('preserves the mounted draft and localizes a save conflict', async () => {
    saveConflict = true
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(
      await screen.findByText('This Navigation menu changed. Reload it before continuing.')
    ).toBeTruthy()
    expect(screen.getByDisplayValue('Home')).toBeTruthy()
    expect(screen.getByText('Saved v1')).toBeTruthy()
  })

  it('publishes the exact mounted version through the confirmation control', async () => {
    renderEditor(['navigation.read', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Publish menu' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(
      await screen.findByText(
        'This menu becomes available to future storefront versions. The current storefront is unchanged.'
      )
    ).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }))
    await waitFor(() => expect(publishRequests).toBe(1))
    expect(await screen.findByText('Published')).toBeTruthy()
    expect(screen.queryByText('Live included')).toBeNull()
    expect(screen.queryByText('Not live')).toBeNull()
  })

  it('keeps unsaved menu edits from being discarded by publish', async () => {
    renderEditor(['navigation.read', 'navigation.write', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Start here' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Update menu label' },
    })
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(true)
    expect(publishRequests).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByText('Saved v2')).toBeTruthy())
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Publish saved menu' },
    })
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(false)
  })

  it('moves focus to Add menu item after removing the sole item', async () => {
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'remove item' }))
    const add = screen.getByRole('button', { name: 'Add menu item' })
    await waitFor(() => expect(document.activeElement).toBe(add))
    expect(screen.getByText('No optional menu items')).toBeTruthy()
  })
})
