import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { ConfigProvider } from 'antd'

import type { NavigationMenu } from '@shoppp/contracts'
import type { AdminPermission } from '@shoppp/contracts'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import type { NavigationMenuRecord } from '../../services/storefront/navigation-api'
import { MenuEditor, moveNavigationItem, NavigationPage } from './navigation-page'

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
  http.post('*/admin/storefront/navigation/header/publish', async ({ request }) => {
    expect(await request.json()).toEqual({
      confirm: true,
      expectedVersion: 1,
      reason: 'Publish menu',
    })
    publishRequests += 1
    currentRecord = record({ status: 'published' })
    return HttpResponse.json({ data: currentRecord })
  })
)

const renderEditor = (
  permissions: readonly AdminPermission[],
  placement: 'header' | 'footer' = 'header'
) =>
  renderInLocale(
    <AuthTestProvider role="content_operator" permissions={permissions}>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <MenuEditor placement={placement} />
      </ConfigProvider>
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
    const indented = moveNavigationItem(items.slice(0, 2), 'nav.shop', 'indent')
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

  it('keeps a parent and its children intact when indent would create a third level', () => {
    const result = moveNavigationItem(items, 'nav.shop', 'indent')
    expect(result.items).toEqual(items)
    expect(result.focusId).toBe('nav.shop')
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
  it('moves a leaf through its tree action menu and saves every item and target', async () => {
    currentRecord = record({ items })
    let savedBody: unknown
    server.use(
      http.put('*/admin/storefront/navigation/header', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: record({ items, version: 2 }) })
      })
    )
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Menu item actions for Men' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Promote one level' }))
    expect(screen.getByDisplayValue('Men')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        expectedVersion: 1,
        reason: '',
        items: [items[0], items[1], { ...items[2], parentId: null, position: 2 }],
      })
    )
  })

  it('selects an added child after the server assigns its persistent ID', async () => {
    currentRecord = record({ items })
    server.use(
      http.put('*/admin/storefront/navigation/header', () =>
        HttpResponse.json({
          data: record({
            version: 2,
            items: [
              items[0]!,
              items[1]!,
              { ...items[2]!, id: 'navigation-item.saved-child', label: 'New child', position: 1 },
              items[2]!,
            ],
          }),
        })
      )
    )
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Add child item to Shop' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'New child' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Saved v2')
    expect(screen.getByDisplayValue('New child')).toBeTruthy()
    expect(
      screen
        .getByText('New child', { exact: true })
        .closest('[role=treeitem]')
        ?.getAttribute('aria-selected')
    ).toBe('true')
  })

  it('resets the whole menu draft, notes, selection and expansion to the loaded version', async () => {
    currentRecord = record({ items })
    renderEditor(['navigation.read', 'navigation.write', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByText('Men', { exact: true }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Draft child' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add menu item' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes (optional)' }), {
      target: { value: 'Draft note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await screen.findByDisplayValue('Home')
    expect(screen.getByText('Men', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Untitled item', { exact: true })).toBeNull()
    expect(
      (screen.getByRole('textbox', { name: 'Notes (optional)' }) as HTMLTextAreaElement).value
    ).toBe('')
    expect(screen.queryByRole('textbox', { name: 'Transition reason' })).toBeNull()
  })

  it('removes the selected parent with its children and focuses the remaining item action', async () => {
    currentRecord = record({ items })
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByText('Shop', { exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Menu item actions for Shop' }))
    const actions = within(await screen.findByRole('menu'))
    expect(
      actions.getByRole('menuitem', { name: 'Make a child item' }).getAttribute('aria-disabled')
    ).toBe('true')
    fireEvent.click(actions.getByRole('menuitem', { name: 'Delete menu item' }))
    expect(screen.getByDisplayValue('Home')).toBeTruthy()
    expect(screen.queryByText('Men', { exact: true })).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Menu item actions for Home' })
      )
    )
  })

  it('keeps header and footer drafts independent while switching tabs', async () => {
    server.use(
      http.get('*/admin/storefront/navigation/footer', () =>
        HttpResponse.json({
          data: record({
            id: 'menu.footer',
            placement: 'footer',
            items: [{ ...items[0]!, id: 'nav.contact', label: 'Contact' }],
          }),
        })
      )
    )
    renderInLocale(
      <AuthTestProvider
        role="content_operator"
        permissions={['navigation.read', 'navigation.write']}
      >
        <NavigationPage />
      </AuthTestProvider>,
      'en-US'
    )
    await screen.findByDisplayValue('Home')
    const cardHead = document.querySelector('.ant-card-head') as HTMLElement
    expect(within(cardHead).getByRole('tab', { name: 'Header menu' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Header draft' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Footer menu' }))
    await screen.findByDisplayValue('Contact')
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Footer draft' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Header menu' }))
    expect((screen.getByRole('textbox', { name: 'Item label' }) as HTMLInputElement).value).toBe(
      'Header draft'
    )
    expect(screen.getAllByRole('button', { name: 'Save draft' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('tab', { name: 'Footer menu' }))
    expect((screen.getByRole('textbox', { name: 'Item label' }) as HTMLInputElement).value).toBe(
      'Footer draft'
    )
  })

  it('keeps drafts across selected tree nodes and saves the complete menu payload', async () => {
    currentRecord = record({ items })
    let savedBody: unknown
    server.use(
      http.put('*/admin/storefront/navigation/header', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: record({ items, version: 2 }) })
      })
    )
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    expect(screen.getByRole('tree', { name: 'Menu structure' })).toBeTruthy()
    expect(screen.getAllByRole('textbox', { name: 'Item label' })).toHaveLength(1)
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Start here' },
    })
    fireEvent.click(screen.getByText('Men', { exact: true }))
    expect(screen.getByDisplayValue('Men')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Route path' }), {
      target: { value: '/collections/all-men' },
    })
    fireEvent.click(screen.getByText('Start here', { exact: true }))
    expect(screen.getByDisplayValue('Start here')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes (optional)' }), {
      target: { value: 'Menu draft note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        expectedVersion: 1,
        items: [
          { ...items[0]!, label: 'Start here' },
          items[1],
          { ...items[2]!, target: { kind: 'route', path: '/collections/all-men' } },
        ],
        reason: 'Menu draft note',
      })
    )
  })

  it('mounts a retryable load and keeps a custom role read-only without leaking target queries', async () => {
    loadFailures = 1
    currentRecord = record({
      items: [
        {
          ...items[0]!,
          target: { kind: 'internal', reference: { id: 'page.about', kind: 'page' } },
        },
        items[1]!,
        items[2]!,
      ],
    })
    const view = renderEditor(['navigation.read'])
    expect(await screen.findByText('Navigation could not be loaded')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('Home')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(
      screen.getByText('You do not have permission to browse this resource type.')
    ).toBeTruthy()
    expect(resourceRequests).toBe(0)
    expect(screen.getByRole('textbox', { name: 'Item label' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Add menu item' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Menu item actions for Home' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset changes' })).toBeNull()
    expect(view.container.querySelector('.ax-fixed-toolbar')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    fireEvent.click(screen.getByText('Men', { exact: true }))
    expect(screen.getByDisplayValue('Men')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Unauthorized edit' },
    })
    expect(screen.getByDisplayValue('Men')).toBeTruthy()
    expect(resourceRequests).toBe(0)
  })

  it('preserves the mounted draft and localizes a save conflict', async () => {
    saveConflict = true
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Draft home' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(
      await screen.findByText('This Navigation menu changed. Reload it before continuing.')
    ).toBeTruthy()
    expect(screen.getByDisplayValue('Draft home')).toBeTruthy()
    expect(screen.getByText('Saved v1')).toBeTruthy()
  })

  it('publishes the exact mounted version through the confirmation control', async () => {
    let publishedBody: unknown
    server.use(
      http.post('*/admin/storefront/navigation/header/publish', async ({ request }) => {
        publishedBody = await request.json()
        publishRequests += 1
        return HttpResponse.json({ data: record({ status: 'published' }) })
      })
    )
    renderEditor(['navigation.read', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    expect(screen.queryByRole('textbox', { name: 'Publication reason' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Publish menu' },
    })
    expect(
      await screen.findByText(
        'This menu becomes available to future storefront versions. The current storefront is unchanged.'
      )
    ).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(publishRequests).toBe(1))
    expect(publishedBody).toEqual({ confirm: true, expectedVersion: 1, reason: 'Publish menu' })
    expect(await screen.findByText('Published')).toBeTruthy()
    expect(screen.queryByText('Live included')).toBeNull()
    expect(screen.queryByText('Not live')).toBeNull()
  })

  it('archives the saved menu with the exact version and removes lifecycle actions', async () => {
    let archivedBody: unknown
    server.use(
      http.post('*/admin/storefront/navigation/header/archive', async ({ request }) => {
        archivedBody = await request.json()
        return HttpResponse.json({ data: record({ status: 'archived' }) })
      })
    )
    const view = renderEditor(['navigation.read', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Archive reason' }), {
      target: { value: 'Archive saved menu' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Archive' }))
    await screen.findByText('Archived')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(archivedBody).toEqual({
      confirm: true,
      expectedVersion: 1,
      reason: 'Archive saved menu',
    })
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(view.container.querySelector('.ax-fixed-toolbar')).toBeNull()
  })

  it.each(['   ', ' a ', 'x'.repeat(501)])(
    'validates the trimmed reason before requesting a transition (%s)',
    async (reason) => {
      renderEditor(['navigation.read', 'navigation.publish'])
      await screen.findByDisplayValue('Home')
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
      const dialog = within(await screen.findByRole('dialog'))
      const input = dialog.getByRole('textbox', { name: 'Publication reason' })
      fireEvent.change(input, { target: { value: reason } })
      fireEvent.click(dialog.getByRole('button', { name: 'Publish' }))
      await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
      expect(publishRequests).toBe(0)
    }
  )

  it('clears canceled input when reopening or switching actions and never writes on cancel', async () => {
    renderEditor(['navigation.read', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Unused reason' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(
      (
        within(await screen.findByRole('dialog')).getByRole('textbox', {
          name: 'Archive reason',
        }) as HTMLTextAreaElement
      ).value
    ).toBe('')
    expect(publishRequests).toBe(0)
  })

  it('retains a conflict reason without retrying and locks repeat submission or closing while busy', async () => {
    let release: () => void = () => {}
    let requests = 0
    let body: unknown
    server.use(
      http.post('*/admin/storefront/navigation/header/publish', async ({ request }) => {
        requests += 1
        body = await request.json()
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return HttpResponse.json(
          { error: { code: 'navigation_conflict', message: 'Raw conflict' } },
          { status: 409 }
        )
      })
    )
    renderEditor(['navigation.read', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: '  Keep this reason  ' },
    })
    const confirm = dialog.getByRole('button', { name: 'Publish' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(requests).toBe(1))
    expect(body).toEqual({ confirm: true, expectedVersion: 1, reason: 'Keep this reason' })
    expect(dialog.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    release()
    expect(
      await dialog.findByText('This Navigation menu changed. Reload it before continuing.')
    ).toBeTruthy()
    expect(
      (dialog.getByRole('textbox', { name: 'Publication reason' }) as HTMLTextAreaElement).value
    ).toBe('  Keep this reason  ')
    expect(requests).toBe(1)
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    const reopened = within(await screen.findByRole('dialog'))
    expect(
      (reopened.getByRole('textbox', { name: 'Publication reason' }) as HTMLTextAreaElement).value
    ).toBe('')
    expect(
      reopened.queryByText('This Navigation menu changed. Reload it before continuing.')
    ).toBeNull()
  })

  it('searches internal resources for the selected item and preserves another external target', async () => {
    const menuItems: NavigationMenu['items'] = [
      { ...items[0]!, target: { kind: 'external', url: 'https://example.com/help' } },
      { ...items[1]!, target: { kind: 'internal', reference: { kind: 'page', id: 'page.about' } } },
    ]
    currentRecord = record({ items: menuItems })
    let savedBody: unknown
    let searchQuery: string | null
    server.use(
      http.get('*/admin/storefront/navigation/resources', ({ request }) => {
        searchQuery = new URL(request.url).searchParams.get('query')
        return HttpResponse.json({
          data: [{ id: 'page.help', kind: 'page', name: 'Help', path: '/pages/help' }],
          page: 1,
          pageSize: 12,
          total: 1,
        })
      }),
      http.put('*/admin/storefront/navigation/header', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: record({ version: 2, items: menuItems }) })
      })
    )
    renderEditor(['navigation.read', 'navigation.write', 'content.read'])
    await screen.findByDisplayValue('Home')
    fireEvent.change(screen.getByRole('textbox', { name: 'HTTPS URL' }), {
      target: { value: 'https://example.com/support' },
    })
    fireEvent.click(screen.getByText('Shop', { exact: true }))
    fireEvent.change(screen.getByLabelText('Internal resource Search'), {
      target: { value: 'help' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(searchQuery).toBe('help'))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Internal resource' }))
    fireEvent.click(await screen.findByText('Help · /pages/help'))
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        expectedVersion: 1,
        items: [
          { ...items[0]!, target: { kind: 'external', url: 'https://example.com/support' } },
          {
            ...items[1]!,
            target: { kind: 'internal', reference: { kind: 'page', id: 'page.help' } },
          },
        ],
        reason: '',
      })
    )
  })

  it('keeps unsaved menu edits from being discarded by publish', async () => {
    renderEditor(['navigation.read', 'navigation.write', 'navigation.publish'])
    await screen.findByDisplayValue('Home')
    fireEvent.change(screen.getByRole('textbox', { name: 'Item label' }), {
      target: { value: 'Start here' },
    })
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(true)
    expect(publishRequests).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByText('Saved v2')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(false)
  })

  it('moves focus to Add menu item after removing the sole item', async () => {
    renderEditor(['navigation.read', 'navigation.write'])
    await screen.findByDisplayValue('Home')
    fireEvent.click(screen.getByRole('button', { name: 'Menu item actions for Home' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete menu item' }))
    const add = screen.getByRole('button', { name: 'Add menu item' })
    await waitFor(() => expect(document.activeElement).toBe(add))
    expect(screen.getByText('No optional menu items')).toBeTruthy()
  })
  it.each(['header', 'footer'] as const)(
    'saves every %s menu item and target then archives the exact saved version',
    async (placement) => {
      const requests: unknown[] = []
      let archive: unknown
      server.use(
        http.get(`*/admin/storefront/navigation/${placement}`, () =>
          HttpResponse.json({ data: record({ items, placement }) })
        ),
        http.put(`*/admin/storefront/navigation/${placement}`, async ({ request }) => {
          requests.push(await request.json())
          return HttpResponse.json({
            data: record({
              items: [{ ...items[0]!, label: 'Start' }, items[1]!, items[2]!],
              placement,
              version: 2,
            }),
          })
        }),
        http.post(`*/admin/storefront/navigation/${placement}/archive`, async ({ request }) => {
          archive = await request.json()
          return HttpResponse.json({ data: record({ placement, status: 'archived', version: 3 }) })
        })
      )
      renderEditor(['navigation.read', 'navigation.write', 'navigation.publish'], placement)
      await screen.findByDisplayValue('Home')
      fireEvent.change(screen.getAllByRole('textbox', { name: 'Item label' })[0]!, {
        target: { value: 'Start' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
      await waitFor(() =>
        expect(requests).toEqual([
          {
            expectedVersion: 1,
            reason: '',
            items: [
              {
                id: 'nav.home',
                label: 'Start',
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
            ],
          },
        ])
      )
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
      const dialog = within(await screen.findByRole('dialog'))
      fireEvent.change(dialog.getByRole('textbox', { name: 'Archive reason' }), {
        target: { value: 'Archive saved menu' },
      })
      expect(archive).toBeUndefined()
      fireEvent.click(dialog.getByRole('button', { name: 'Archive' }))
      await waitFor(() =>
        expect(archive).toEqual({ confirm: true, expectedVersion: 2, reason: 'Archive saved menu' })
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
  )
})
