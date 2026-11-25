import React from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@rstest/core'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { AdminPermission } from '@shoppp/contracts'
import { AuthContext } from '../../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../../../shared/contexts/theme-context'
import { useI18n } from '../../../shared/contexts/i18n-context'
import { renderInLocale } from '../../../test/render-in-locale'
import {
  editorContext,
  editorRelease,
} from '../../../../../storefront/tests/fixtures/editor-context'
import { VisualThemeEditorPage } from './visual-editor-page'

void React
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
const unitPackage = structuredClone(editorContext.package)
const unitTemplate = structuredClone(unitPackage.presets[0]!.templates[0]!)
const hero = unitTemplate.sections[0]!
hero.settings = {}
hero.blocks = [hero.blocks[0]!]
hero.blocks[0]!.settings = { title: 'Featured lounge' }
unitTemplate.sections = [hero]
unitTemplate.shell = { capabilities: [], settings: {} }
unitPackage.manifest.shellSettings = []
unitPackage.manifest.componentRegistry.sections = unitPackage.manifest.componentRegistry.sections
  .filter(({ type }) => type === hero.type)
  .map((definition) => ({
    ...definition,
    settings: definition.settings.filter(({ id }) => id === 'featured-collection'),
  }))
unitPackage.manifest.componentRegistry.blocks = unitPackage.manifest.componentRegistry.blocks
  .filter(({ type }) => type === hero.blocks[0]!.type)
  .map((definition) => ({
    ...definition,
    settings: definition.settings.filter(({ id }) => id === 'title'),
  }))
unitPackage.presets = [{ ...unitPackage.presets[0]!, templates: [unitTemplate] }]
const unitDraft = {
  ...structuredClone(editorContext.draft),
  bindings: editorContext.draft.bindings.filter(({ instanceId }) => instanceId === hero.id),
}
let draft = structuredClone(unitDraft)
let reads = 0
const writes: Array<Record<string, unknown>> = []
const release = {
  id: editorRelease.releaseId,
  status: 'private-preview',
  environment: 'staging',
  approvedAt: editorRelease.generatedAt,
  products: editorRelease.products,
  collections: editorRelease.collections,
  destinations: [],
}
const server = setupServer(
  http.get('*/admin/storefront-experiences/drafts/:id/operator-run', () =>
    HttpResponse.json({ data: null })
  ),
  http.get('*/admin/storefront-experiences/drafts/:id/editor-definition', () => {
    reads++
    return HttpResponse.json({
      data: { draft, package: unitPackage, upgradeTargets: [] },
    })
  }),
  http.get('*/admin/storefront-experiences/catalog-releases', () =>
    HttpResponse.json({ data: [release] })
  ),
  http.get('*/admin/storefront-experiences/catalog-releases/:id/resources', () =>
    HttpResponse.json({
      data: editorRelease.collections.map((collection) => ({ ...collection, kind: 'collection' })),
      page: 1,
      pageSize: 12,
      total: editorRelease.collections.length,
    })
  ),
  http.put('*/admin/storefront-experiences/drafts/:id', async ({ request }) => {
    const input = (await request.json()) as Record<string, unknown>
    writes.push(input)
    draft = {
      ...draft,
      bindings: input.bindings as typeof draft.bindings,
      overrides: input.overrides as typeof draft.overrides,
      version: draft.version + 1,
    }
    return HttpResponse.json({ data: draft })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  draft = structuredClone(unitDraft)
  reads = 0
  writes.length = 0
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
const permissions: AdminPermission[] = [
  'themes.read',
  'themes.write',
  'themes.preview',
  'catalog.read',
  'settings.read',
  'navigation.read',
]
const LocaleSwitch = () => {
  const { locale, setLocale } = useI18n()
  return (
    <button onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}>
      Switch language
    </button>
  )
}
function renderEditor(allowed = permissions) {
  const router = createMemoryRouter(
    [
      {
        path: '/storefront/themes/:draftId',
        element: (
          <AuthContext.Provider
            value={{
              accountName: 'fixture',
              displayName: 'Fixture',
              isAuthenticated: true,
              isLoading: false,
              login: async () => undefined,
              logout: () => undefined,
              permissions: allowed,
              principalKind: 'human',
              refreshSession: async () => undefined,
              role: 'admin',
              session: null,
              sessionError: null,
              status: 'authenticated',
            }}
          >
            <ThemeProvider>
              <VisualThemeEditorPage />
            </ThemeProvider>
          </AuthContext.Provider>
        ),
      },
      { path: '/storefront/themes', element: <div>Draft library</div> },
    ],
    { initialEntries: ['/storefront/themes/draft-editor'] }
  )
  return renderInLocale(
    <>
      <LocaleSwitch />
      <RouterProvider router={router} />
    </>
  )
}
async function editTitle(value: string) {
  fireEvent.click(await screen.findByText('Featured lounge', { selector: '.ant-tree-title' }))
  const input = await screen.findByRole('textbox', { name: /^Title$/ })
  fireEvent.change(input, { target: { value } })
  return input
}

describe('visual theme workspace', () => {
  it('inspects a historical package without granting it editing rights from the operator role', async () => {
    server.use(http.get('*/admin/storefront-experiences/drafts/:id/editor-definition', () => HttpResponse.json({ data: { draft, package: unitPackage, upgradeTargets: [], writable: false } })))
    renderEditor()
    fireEvent.click(await screen.findByText('Featured lounge', { selector: '.ant-tree-title' }))
    expect((await screen.findByRole('textbox', { name: /^Title$/ }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled).toBe(true)
    expect(writes).toEqual([])
  })
  it('saves the selected Block with one complete document and keeps later input after a delayed save', async () => {
    let complete!: () => void
    const response = new Promise<void>((resolve) => {
      complete = resolve
    })
    server.use(
      http.put('*/admin/storefront-experiences/drafts/:id', async ({ request }) => {
        const input = (await request.json()) as Record<string, unknown>
        writes.push(input)
        await response
        return HttpResponse.json({
          data: { ...draft, version: 2, overrides: input.overrides, bindings: input.bindings },
        })
      })
    )
    renderEditor()
    const title = await editTitle('Saved A')
    fireEvent.click(screen.getByRole('button', { name: 'Save design' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    fireEvent.change(title, { target: { value: 'Later B' } })
    complete()
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled
      ).toBe(false)
    )
    expect((title as HTMLInputElement).value).toBe('Later B')
    expect(writes[0]).toMatchObject({ expectedVersion: 1, bindings: unitDraft.bindings })
    expect(JSON.stringify(writes[0]!.overrides)).toContain('Saved A')
    expect(JSON.stringify(writes[0]!.overrides)).not.toContain('Later B')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect((title as HTMLInputElement).value).toBe('Saved A')
    expect(
      (screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
  it('retains invalid input, blocks saving and permits undo without discarding the session', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Theme styles' }))
    const accent = screen.getByRole('textbox', { name: /^Accent color$/ })
    fireEvent.change(accent, { target: { value: 'invalid-color' } })
    expect((accent as HTMLInputElement).value).toBe('invalid-color')
    expect(
      (screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(writes).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect((accent as HTMLInputElement).value).toBe('')
  })
  it('keeps local edits after a version conflict and does not retry the stale save', async () => {
    server.use(
      http.put('*/admin/storefront-experiences/drafts/:id', async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(
          {
            error: {
              code: 'storefront_experience_draft_conflict',
              message: 'The saved draft changed.',
            },
          },
          { status: 409 }
        )
      })
    )
    renderEditor()
    const title = await editTitle('Keep this draft')
    fireEvent.click(screen.getByRole('button', { name: 'Save design' }))
    await screen.findByRole('button', { name: 'Recover as a new draft' })
    expect((title as HTMLInputElement).value).toBe('Keep this draft')
    expect(
      (screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(writes).toHaveLength(1)
  })
  it('retains edits and selected fields across a language change without reloading', async () => {
    renderEditor()
    const title = await editTitle('Language-safe input')
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect((title as HTMLInputElement).value).toBe('Language-safe input')
    expect(reads).toBe(1)
    expect(writes).toHaveLength(0)
  })
  it('keeps read-only inspection available and blocks editing and saving', async () => {
    renderEditor(['themes.read'])
    fireEvent.click(await screen.findByText('Featured lounge', { selector: '.ant-tree-title' }))
    expect(
      ((await screen.findByRole('textbox', { name: /^Title$/ })) as HTMLInputElement).disabled
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Save design' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(writes).toHaveLength(0)
  })
})
