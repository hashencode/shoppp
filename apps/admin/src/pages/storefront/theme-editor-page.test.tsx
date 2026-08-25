import type { AdminPermission, AdminStorefrontTheme } from '@shoppp/contracts'
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { renderInLocale } from '../../test/render-in-locale'
import type { Role } from '../../shared/types/roles'
import type { StorefrontExperienceDraft } from '../../services/storefront/api'
import {
  createThemeOverrides,
  previewBuildStatus,
  resolveDraftTemplates,
  resolveValidationFieldPath,
  ThemeEditorPage,
} from './theme-editor-page'
import { ThemesPage } from './themes-page'

void React

describe('validation field paths', () => {
  it('preserves dotted setting identifiers', () => {
    expect(
      resolveValidationFieldPath({
        instanceId: 'fashion-store-content',
        path: 'fashion-store-content.policy.document',
      })
    ).toEqual({ instanceId: 'fashion-store-content', settingId: 'policy.document' })
  })
})

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const theme: AdminStorefrontTheme = {
  componentRegistry: {
    blocks: [],
    sections: [
      {
        allowedBlockTypes: [],
        capabilities: ['navigation.primary'],
        settings: [],
        type: 'synthetic.navigation',
      },
      {
        allowedBlockTypes: [],
        capabilities: [],
        settings: [
          {
            default: 'Preset headline',
            id: 'heading',
            kind: 'text',
            maxLength: 80,
            required: true,
          },
          {
            default: 'left',
            id: 'alignment',
            kind: 'select',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
            ],
            required: true,
          },
        ],
        type: 'synthetic.hero',
      },
      {
        allowedBlockTypes: [],
        capabilities: [],
        settings: [
          {
            default: 'Preset story',
            id: 'body',
            kind: 'text',
            maxLength: 120,
            required: true,
          },
        ],
        type: 'synthetic.story',
      },
    ],
  },
  configurationSchemaVersion: 1,
  fixtureBindings: [
    {
      fixtureId: 'fixture-home',
      id: 'binding-home',
      instanceId: 'home-hero',
      kind: 'fixture',
      resource: 'home',
      state: 'populated',
    },
  ],
  id: 'synthetic',
  platformCompatibility: { maxExclusive: '2.0.0', min: '1.0.0' },
  platformContractVersion: '1.0.0',
  presetDefinitions: [
    {
      id: 'editorial',
      label: 'Editorial',
      templates: [
        {
          id: 'synthetic-home',
          pageType: 'home',
          requiredCapabilities: ['navigation.primary'],
          sections: [
            {
              blocks: [],
              capabilities: ['navigation.primary'],
              id: 'site-navigation',
              required: true,
              settings: {},
              type: 'synthetic.navigation',
              visible: true,
            },
            {
              blocks: [],
              capabilities: [],
              id: 'home-hero',
              settings: { alignment: 'left', heading: 'Preset headline' },
              type: 'synthetic.hero',
              visible: true,
            },
            {
              blocks: [],
              capabilities: [],
              id: 'home-story',
              settings: { body: 'Preset story' },
              type: 'synthetic.story',
              visible: true,
            },
          ],
        },
      ],
    },
  ],
  presets: ['editorial'],
  supportedPageTemplates: ['home'],
  themeVersion: '1.0.0',
}

const baseDraft: StorefrontExperienceDraft = {
  bindings: theme.fixtureBindings,
  configurationSchemaVersion: 1,
  createdAt: '2026-07-30T00:00:00.000Z',
  createdBy: 'theme-admin',
  experienceId: 'storefront-synthetic',
  id: 'draft-synthetic-1',
  overrides: [
    {
      operations: [
        {
          instanceId: 'home-hero',
          kind: 'set-setting',
          settingId: 'heading',
          value: 'Existing headline',
        },
      ],
      presetId: 'editorial',
      schemaVersion: 1,
      templateId: 'synthetic-home',
    },
  ],
  presetId: 'editorial',
  themeId: 'synthetic',
  themeVersion: '1.0.0',
  updatedAt: '2026-07-30T00:00:00.000Z',
  updatedBy: 'theme-admin',
  validation: null,
  validations: [],
  version: 1,
}

let currentDraft = structuredClone(baseDraft)
let updateBody: Record<string, unknown> | null = null
let validationBody: Record<string, unknown> | null = null
let previewBody: Record<string, unknown> | null = null
let approvalBody: Record<string, unknown> | null = null
let migrationBody: Record<string, unknown> | null = null
let createDraftBody: Record<string, unknown> | null = null
let successorBody: Record<string, unknown> | null = null
let buildStatus: 'building' | 'deployed' = 'building'

const validValidation = {
  catalogReleaseId: null,
  createdAt: '2026-07-30T00:10:00.000Z',
  draftVersion: 2,
  id: 'validation-fashion-store',
  issues: [],
  status: 'valid' as const,
  validatedBy: 'theme-admin',
}

const previewSnapshot = {
  approvedAt: null,
  approvedBy: null,
  configurationSchemaVersion: 1,
  contentDigest: 'c'.repeat(64),
  createdAt: '2026-07-30T00:11:00.000Z',
  createdBy: 'theme-admin',
  experienceId: 'storefront-synthetic',
  id: 'snapshot-preview-fashion-store',
  kind: 'preview' as const,
  sourceDraftId: baseDraft.id,
  sourceDraftVersion: 2,
  sourceValidationId: validValidation.id,
  themeId: 'synthetic',
  themeVersion: '1.0.0',
}

const build = () => ({
  artifactDigest: buildStatus === 'deployed' ? 'a'.repeat(64) : null,
  artifactPrefix:
    buildStatus === 'deployed' ? `snapshots/${previewSnapshot.id}/${'a'.repeat(64)}` : null,
  attempt: 1,
  cleanedAt: null,
  completedAt: buildStatus === 'deployed' ? '2026-07-30T00:12:00.000Z' : null,
  correlationId: 'build-correlation-1',
  createdAt: '2026-07-30T00:11:00.000Z',
  expiresAt: buildStatus === 'deployed' ? '2099-07-30T00:00:00.000Z' : null,
  failureCode: null,
  id: 'preview-build-1',
  snapshotId: previewSnapshot.id,
  status: buildStatus,
  updatedAt: '2026-07-30T00:12:00.000Z',
})

const catalogRelease = (id: string) => ({
  approvedAt: '2026-08-11T00:00:00.000Z',
  collections: [],
  destinations: [],
  deployedAt: '2026-08-11T01:00:00.000Z',
  environment: 'staging' as const,
  id,
  products: [],
  status: 'deployed' as const,
})

const deployedPreviewContext = (releaseId: string, draftVersion = 1) => {
  const snapshot = {
    ...previewSnapshot,
    id: `snapshot-preview-${releaseId}`,
    sourceDraftVersion: draftVersion,
  }
  return {
    build: {
      ...build(),
      artifactPrefix: `snapshots/${snapshot.id}/${releaseId}/${'a'.repeat(64)}`,
      id: `preview-build-${releaseId}`,
      inputIdentity: {
        catalogReleaseId: releaseId,
        experienceSnapshotId: snapshot.id,
        experienceVersion: draftVersion,
        platformContractVersion: '1.0.0',
        themeId: 'fashion-store',
        themeVersion: '1.0.0',
      },
      snapshotId: snapshot.id,
      status: 'deployed' as const,
    },
    snapshot,
  }
}

const server = setupServer(
  http.get('*/admin/storefront-experiences/themes', () => HttpResponse.json({ data: [theme] })),
  http.get('*/admin/storefront-experiences/drafts', () =>
    HttpResponse.json({ data: [currentDraft] })
  ),
  http.get('*/admin/storefront-experiences/drafts/:id', () =>
    HttpResponse.json({ data: currentDraft })
  ),
  http.get('*/admin/storefront-experiences/drafts/:id/preview-context', () =>
    HttpResponse.json({ data: null })
  ),
  http.post('*/admin/storefront-experiences/drafts', async ({ request }) => {
    createDraftBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ data: { ...currentDraft, id: 'draft-created-2' } }, { status: 201 })
  }),
  http.put('*/admin/storefront-experiences/drafts/:id', async ({ request }) => {
    updateBody = (await request.json()) as Record<string, unknown>
    currentDraft = {
      ...currentDraft,
      overrides: updateBody.overrides as StorefrontExperienceDraft['overrides'],
      validation: null,
      validations: [],
      version: 2,
    }
    return HttpResponse.json({ data: currentDraft })
  }),
  http.post('*/admin/storefront-experiences/drafts/:id/successors', async ({ request }) => {
    successorBody = (await request.json()) as Record<string, unknown>
    currentDraft = {
      ...currentDraft,
      id: 'draft-successor-1',
      overrides: successorBody.overrides as StorefrontExperienceDraft['overrides'],
      validation: null,
      validations: [],
      version: 1,
    }
    return HttpResponse.json({ data: currentDraft }, { status: 201 })
  }),
  http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
    validationBody = (await request.json()) as Record<string, unknown>
    const draftVersion = validationBody.expectedVersion as number
    return HttpResponse.json({
      data: {
        ...validValidation,
        draftVersion,
        id: `validation-synthetic-${draftVersion}`,
      },
    })
  }),
  http.post('*/admin/storefront-experiences/drafts/:id/preview', async ({ request }) => {
    previewBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { data: { build: build(), snapshot: previewSnapshot } },
      { status: 202 }
    )
  }),
  http.get('*/admin/storefront-experiences/builds/:id', () => {
    buildStatus = 'deployed'
    return HttpResponse.json({ data: build() })
  }),
  http.post('*/admin/storefront-experiences/snapshots/:id/grants', () =>
    HttpResponse.json(
      {
        data: {
          expiresAt: '2099-07-30T00:00:00.000Z',
          grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          redeemUrl: 'https://preview.example.test/__preview/session',
          snapshotId: previewSnapshot.id,
        },
      },
      { status: 201 }
    )
  ),
  http.post('*/admin/storefront-experiences/snapshots/:id/revoke', () =>
    HttpResponse.json({
      data: {
        grantsRevoked: 1,
        revokedAt: '2026-07-30T00:20:00.000Z',
        sessionsRevoked: 1,
        snapshotId: previewSnapshot.id,
      },
    })
  ),
  http.post('*/admin/storefront-experiences/drafts/:id/approve', async ({ request }) => {
    approvalBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      data: {
        ...previewSnapshot,
        approvedAt: '2026-07-30T00:15:00.000Z',
        approvedBy: 'theme-admin',
        id: 'snapshot-approved-fashion-store',
        kind: 'approved',
      },
    })
  }),
  http.post(
    '*/admin/storefront-experiences/drafts/:id/migrations/dry-run',
    async ({ request }) => {
      migrationBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({
        data: {
          approvedAt: null,
          approvedBy: null,
          conflicts: [
            {
              code: 'instance-removed',
              instanceId: 'home-story',
              message: 'The target package removed a stable instance with merchant overrides.',
              templateId: 'synthetic-home',
            },
          ],
          createdAt: '2026-07-30T00:20:00.000Z',
          createdBy: 'theme-admin',
          draftId: baseDraft.id,
          draftVersion: 1,
          id: 'migration-synthetic-1-2',
          sourceConfigurationSchemaVersion: 1,
          sourceThemeVersion: '1.0.0',
          status: 'dry_run',
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: '1.1.0',
        },
      })
    }
  )
)

const authValue = (role: Role, permissionOverride?: readonly AdminPermission[]) => ({
  accountName: 'theme-admin@example.test',
  displayName: 'Theme admin',
  isAuthenticated: true,
  isLoading: false,
  login: async () => undefined,
  logout: () => undefined,
  permissions:
    permissionOverride ?? (role === 'admin'
      ? (['themes.read', 'themes.write', 'themes.preview', 'themes.approve', 'catalog.read'] as const)
      : (['themes.read'] as const)),
  principalKind: 'human' as const,
  refreshSession: async () => undefined,
  role,
  session: null,
  sessionError: null,
  status: 'authenticated' as const,
})

const renderEditor = (
  role: Role = 'admin',
  pollIntervalMs = 60_000,
  permissionOverride?: readonly AdminPermission[]
) => {
  const router = createMemoryRouter(
    [
      {
        path: '/storefront/themes/:draftId',
        element: (
          <AuthContext.Provider value={authValue(role, permissionOverride)}>
            <ThemeProvider>
              <ThemeEditorPage
                pollIntervalMs={pollIntervalMs}
                previewOrigin="https://preview.example.test"
              />
            </ThemeProvider>
          </AuthContext.Provider>
        ),
      },
      { path: '/storefront/themes', element: <div>THEME_LIST</div> },
    ],
    { initialEntries: [`/storefront/themes/${baseDraft.id}`] }
  )
  return { router, ...renderInLocale(<RouterProvider router={router} />, 'en-US') }
}

const renderThemes = (role: Role = 'admin') => {
  const router = createMemoryRouter(
    [
      {
        path: '/storefront/themes',
        element: (
          <AuthContext.Provider value={authValue(role)}>
            <ThemeProvider>
              <ThemesPage />
            </ThemeProvider>
          </AuthContext.Provider>
        ),
      },
      { path: '/storefront/themes/:draftId', element: <div>CREATED_EDITOR</div> },
    ],
    { initialEntries: ['/storefront/themes'] }
  )
  return { router, ...renderInLocale(<RouterProvider router={router} />, 'en-US') }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  currentDraft = structuredClone(baseDraft)
  updateBody = null
  validationBody = null
  previewBody = null
  approvalBody = null
  migrationBody = null
  createDraftBody = null
  successorBody = null
  buildStatus = 'building'
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  server.resetHandlers()
})
afterAll(async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 20))
  server.close()
})

describe('ThemesPage', () => {
  it('lists API-approved packages and creates the selected preset draft', async () => {
    renderThemes()
    await screen.findByText('Approved packages')
    expect(screen.getByText('synthetic')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use package' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Creation reason' }), {
      target: { value: 'Start an approved Synthetic fixture draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }))

    await screen.findByText('CREATED_EDITOR')
    expect(createDraftBody).toMatchObject({
      draft: {
        experienceId: 'storefront-synthetic',
        presetId: 'editorial',
        themeId: 'synthetic',
        themeVersion: '1.0.0',
      },
      reason: 'Start an approved Synthetic fixture draft',
    })
  })

  it('handles empty package catalogs and read-only operators without write actions', async () => {
    server.use(
      http.get('*/admin/storefront-experiences/themes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/storefront-experiences/drafts', () => HttpResponse.json({ data: [] }))
    )
    renderThemes('operations')
    await screen.findByText(
      'A source-controlled package must pass compatibility and release validation before it appears here.'
    )
    expect(screen.getByText('Read-only theme access')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'New experience draft' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Use package' })).toBeNull()
  })
})

describe('ThemeEditorPage', () => {
  it('derives live text, enum, asset, link, and stable reference controls from the manifest', async () => {
    const catalogTheme: AdminStorefrontTheme = {
      ...theme,
      componentRegistry: {
        ...theme.componentRegistry,
        sections: theme.componentRegistry.sections.map((section) =>
          section.type === 'synthetic.hero'
            ? {
                ...section,
                settings: [
                  ...section.settings,
                  { id: 'featured-product', kind: 'product-reference', required: true },
                  {
                    default: {
                      alt: 'Hero',
                      height: 600,
                      kind: 'theme',
                      path: 'assets/hero.webp',
                      width: 800,
                    },
                    id: 'image',
                    kind: 'asset',
                    required: false,
                  },
                  {
                    allowedTargets: ['page'],
                    default: {
                      label: 'Shop now',
                      target: {
                        kind: 'internal',
                        reference: {
                          id: 'page.shop',
                          kind: 'page',
                        },
                      },
                      targetBehavior: 'same-window',
                    },
                    id: 'cta',
                    kind: 'link',
                    required: false,
                  },
                ],
              }
            : section
        ),
      },
      id: 'fashion-store',
      presetDefinitions: theme.presetDefinitions.map((preset) => ({
        ...preset,
        templates: preset.templates.map((template) => ({
          ...template,
          sections: template.sections.map((section) =>
            section.id === 'home-hero'
              ? {
                  ...section,
                  settings: {
                    ...section.settings,
                    cta: {
                      label: 'Shop now',
                      target: {
                        kind: 'internal',
                        reference: {
                          id: 'page.shop',
                          kind: 'page',
                        },
                      },
                      targetBehavior: 'same-window',
                    },
                    image: {
                      alt: 'Hero',
                      height: 600,
                      kind: 'theme',
                      path: 'assets/hero.webp',
                      width: 800,
                    },
                  },
                }
              : section
          ),
        })),
      })),
    }
    currentDraft = { ...structuredClone(baseDraft), themeId: 'fashion-store' }
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [catalogTheme] })
      ),
      http.get('*/admin/storefront-experiences/catalog-releases', () =>
        HttpResponse.json({
          data: [
            {
              approvedAt: '2026-08-11T00:00:00.000Z',
              collections: [],
              destinations: [
                { id: 'page.shop', kind: 'page', name: 'Shop', path: '/shop' },
              ],
              deployedAt: '2026-08-11T01:00:00.000Z',
              environment: 'staging',
              id: 'release-editor-1',
              products: [
                { id: 'product-stable-1', kind: 'product', name: 'Stable product', slug: 'stable' },
              ],
              status: 'deployed',
            },
          ],
        })
      ),
      http.get(
        '*/admin/storefront-experiences/catalog-releases/:id/resources',
        ({ request }) => {
          const url = new URL(request.url)
          const kind = url.searchParams.get('kind')
          const page = Number(url.searchParams.get('page') ?? '1')
          const data =
            kind === 'product'
              ? [{
                  id: page === 1 ? 'product-stable-1' : 'product-stable-13',
                  kind: 'product',
                  name: page === 1 ? 'Stable product' : 'Thirteenth product',
                  path: page === 1 ? '/products/stable' : '/products/thirteenth',
                }]
              : kind === 'page'
                ? [{ id: 'page.shop', kind: 'page', name: 'Shop', path: '/shop' }]
                : []
          return HttpResponse.json({ data, page, pageSize: 12, total: kind === 'product' ? 13 : data.length })
        }
      ),
      http.get('*/admin/storefront-experiences/media', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1')
        return HttpResponse.json({
          data: [
            page === 1
              ? {
                  alt: 'Approved hero',
                  height: 600,
                  key: 'catalog/hero.webp',
                  kind: 'catalog',
                  productName: 'Stable product',
                  src: 'https://media.example.test/catalog/hero.webp',
                  width: 800,
                }
              : {
                  alt: 'Approved detail',
                  height: 900,
                  key: 'catalog/detail.webp',
                  kind: 'catalog',
                  productName: 'Stable product',
                  src: 'https://media.example.test/catalog/detail.webp',
                  width: 1200,
                },
          ],
          meta: { page, pageSize: 12, total: 13 },
        })
      })
    )

    const view = renderEditor()
    expect(
      await screen.findByRole('combobox', { name: 'Catalog Release' }, { timeout: 5_000 })
    ).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'home-hero heading' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'home-hero alignment' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'home-hero featured-product' })).toBeTruthy()
    expect(await screen.findByText('Page 1 of 2')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'home-hero image' })).toBeTruthy()
    expect(await screen.findByRole('img', { name: 'Approved hero' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Select Approved hero' }))
    expect(screen.getByText('800 × 600')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next media page' }))
    expect(await screen.findByRole('img', { name: 'Approved detail' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset home-hero image' }))
    expect(screen.getByText('Theme asset · 800 × 600')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'home-hero cta' })).toBeTruthy()
    expect(
      (screen.getByRole('textbox', { name: 'home-hero cta label' }) as HTMLInputElement).value
    ).toBe('Shop now')
    expect(screen.getByRole('combobox', { name: 'home-hero cta destination' })).toBeTruthy()
    view.unmount()
  }, 20_000)

  it('resolves overrides, preserves stable IDs, and emits minimal resettable operations', () => {
    const resolved = resolveDraftTemplates(theme, baseDraft)
    expect(resolved[0]?.sections.map(({ id }) => id)).toEqual([
      'site-navigation',
      'home-hero',
      'home-story',
    ])
    expect(resolved[0]?.sections[1]?.settings.heading).toBe('Existing headline')

    const edited = structuredClone(resolved)
    edited[0]?.sections.splice(1, 2, edited[0].sections[2]!, edited[0].sections[1]!)
    edited[0]!.sections[1]!.visible = false
    edited[0]!.sections[2]!.settings.heading = 'Approved content'
    const overrides = createThemeOverrides(theme, baseDraft, edited)

    expect(overrides[0]?.operations).toEqual(
      expect.arrayContaining([
        {
          instanceIds: ['site-navigation', 'home-story', 'home-hero'],
          kind: 'reorder-sections',
        },
        { instanceId: 'home-story', kind: 'set-visibility', visible: false },
        {
          instanceId: 'home-hero',
          kind: 'set-setting',
          settingId: 'heading',
          value: 'Approved content',
        },
      ])
    )
  })

  it('presents every asynchronous preview lifecycle state distinctly', () => {
    expect(previewBuildStatus(null).label).toBe('Not requested')
    expect(previewBuildStatus({ ...build(), status: 'pending' }).label).toBe('Queued')
    expect(previewBuildStatus({ ...build(), status: 'building' }).label).toBe('Building')
    expect(previewBuildStatus({ ...build(), status: 'deployed' }).label).toBe('Ready')
    expect(previewBuildStatus({ ...build(), status: 'failed' }).label).toBe('Failed')
    expect(previewBuildStatus({ ...build(), status: 'expired' }).label).toBe('Expired')
  })

  it(
    'supports accessible reordering, required capability protection, reset, and dirty navigation',
    async () => {
      renderEditor()
      await waitFor(() =>
        expect(
          (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).value
        ).toBe('Existing headline')
      )
      expect(
        (screen.getByRole('switch', { name: 'Show site-navigation' }) as HTMLButtonElement).disabled
      ).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'Move home-story before' }))
      expect(await screen.findByText(/home-story moved to position 2 of 3/)).toBeTruthy()
      fireEvent.change(screen.getByRole('textbox', { name: 'home-hero heading' }), {
        target: { value: 'Local unsaved headline' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Reset home-hero' }))
      expect(
        (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).value
      ).toBe('Preset headline')
      fireEvent.click(screen.getByRole('button', { name: 'Storefront themes' }))
      expect(await screen.findByText('Discard unsaved theme edits?')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
      expect(screen.getByText('Unsaved changes')).toBeTruthy()
    },
    10_000
  )

  it('saves, validates, and previews the exact new optimistic version in order', async () => {
    renderEditor()
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'home-hero heading' }), {
      target: { value: 'Saved headline' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Review the fixture presentation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }))

    await waitFor(() => expect(screen.getByText('Building')).toBeTruthy())
    expect(updateBody).toMatchObject({ expectedVersion: 1 })
    expect(validationBody).toMatchObject({ expectedVersion: 2 })
    expect(previewBody).toMatchObject({ expectedVersion: 2 })
    expect(screen.getByText('Draft v2')).toBeTruthy()
    expect(screen.getByText('Validated v2')).toBeTruthy()
  })

  it('preserves dirty edits and offers recovery after an optimistic conflict', async () => {
    server.use(
      http.put('*/admin/storefront-experiences/drafts/:id', () =>
        HttpResponse.json(
          {
            error: {
              code: 'storefront_experience_draft_conflict',
              message: 'The storefront experience draft changed. Reload it before saving again.',
            },
          },
          { status: 409 }
        )
      )
    )
    renderEditor()
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'home-hero heading' }), {
      target: { value: 'Keep this local edit' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Attempt an optimistic save' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByText('The saved draft changed while local edits were open')).toBeTruthy()
    )
    expect(
      (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).value
    ).toBe('Keep this local edit')
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep local edits' }))
    )
    expect(screen.getByRole('button', { name: 'Reload and discard local edits' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save local edits as successor' }))
    await screen.findByText('draft-successor-1')
    expect(successorBody).toMatchObject({
      reason: 'Attempt an optimistic save',
      sourceVersion: 1,
    })
    expect(JSON.stringify(successorBody?.overrides)).toContain('Keep this local edit')
  })

  it('shows validation issues and never previews an invalid saved version', async () => {
    server.use(
      http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
        validationBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          data: {
            catalogReleaseId: null,
            createdAt: '2026-07-30T00:10:00.000Z',
            draftVersion: 2,
            id: 'validation-synthetic-invalid-2',
            issues: [
              {
                code: 'required_capability_missing',
                message: 'Required navigation capability is missing.',
                path: 'home-hero.heading',
                templateId: 'synthetic-home',
              },
            ],
            status: 'invalid',
            validatedBy: 'theme-admin',
          },
        })
      })
    )
    renderEditor()
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'home-hero heading' }), {
      target: { value: 'Invalid saved headline' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Validate capability protection' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }))

    await screen.findByText('required_capability_missing')
    const summary = screen.getByText(/Validation validation-synthetic-invalid-2/).closest('[tabindex]')
    await waitFor(() => expect(document.activeElement).toBe(summary))
    const issueLink = screen.getByRole('link', {
      name: /Review affected field.*home.*home-hero.*heading/,
    })
    fireEvent.click(issueLink)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.getElementById('experience-field-synthetic-home-home-hero-heading')
      )
    )
    expect(previewBody).toBeNull()
    expect(screen.queryByText('Building')).toBeNull()
  })

  it('refocuses a persisted invalid summary when revalidation returns the same record', async () => {
    const invalidValidation = {
      catalogReleaseId: null,
      createdAt: '2026-07-30T00:10:00.000Z',
      draftVersion: 1,
      id: 'validation-synthetic-invalid-1',
      issues: [
        {
          code: 'required_capability_missing',
          message: 'Required navigation capability is missing.',
          path: 'home-hero.heading',
          templateId: 'synthetic-home',
        },
      ],
      status: 'invalid' as const,
      validatedBy: 'theme-admin',
    }
    currentDraft = {
      ...structuredClone(baseDraft),
      validation: invalidValidation,
      validations: [invalidValidation],
    }
    server.use(
      http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
        validationBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: invalidValidation })
      })
    )

    renderEditor()
    const summary = (await screen.findByText(/Validation validation-synthetic-invalid-1/)).closest(
      '[tabindex]'
    )
    const reason = screen.getByRole('textbox', { name: 'Change reason' })
    fireEvent.change(reason, { target: { value: 'Repeat persisted validation' } })
    reason.focus()
    fireEvent.click(screen.getByRole('button', { name: 'Validate saved version' }))

    await waitFor(() => expect(validationBody).toMatchObject({ expectedVersion: 1 }))
    await waitFor(() => expect(document.activeElement).toBe(summary))
  })

  it('surfaces deterministic package upgrade conflicts without mutating the draft', async () => {
    const upgradeTheme: AdminStorefrontTheme = {
      ...structuredClone(theme),
      configurationSchemaVersion: 2,
      themeVersion: '1.1.0',
    }
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [theme, upgradeTheme] })
      )
    )
    renderEditor()
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Assess the approved package upgrade' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Assess upgrade conflicts' }))

    await screen.findByText('instance-removed')
    expect(screen.getByText('1 conflicts')).toBeTruthy()
    expect(migrationBody).toMatchObject({
      expectedVersion: 1,
      targetConfigurationSchemaVersion: 2,
      targetThemeVersion: '1.1.0',
    })
    expect(updateBody).toBeNull()
  })

  it('creates a reviewable migration successor instead of approving a migrated snapshot', async () => {
    const upgradeTheme: AdminStorefrontTheme = {
      ...structuredClone(theme),
      configurationSchemaVersion: 2,
      themeVersion: '1.1.0',
    }
    let successorRequest: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [theme, upgradeTheme] })
      ),
      http.post(
        '*/admin/storefront-experiences/drafts/:id/migrations/dry-run',
        async () =>
          HttpResponse.json({
            data: {
              approvedAt: null,
              approvedBy: null,
              conflicts: [],
              createdAt: '2026-07-30T00:20:00.000Z',
              createdBy: 'theme-admin',
              draftId: baseDraft.id,
              draftVersion: 1,
              id: 'migration-synthetic-ready',
              sourceConfigurationSchemaVersion: 1,
              sourceThemeVersion: '1.0.0',
              status: 'dry_run',
              targetConfigurationSchemaVersion: 2,
              targetThemeVersion: '1.1.0',
            },
          })
      ),
      http.post(
        '*/admin/storefront-experiences/drafts/:id/migrations/approve',
        async ({ request }) => {
          successorRequest = (await request.json()) as Record<string, unknown>
          currentDraft = {
            ...currentDraft,
            configurationSchemaVersion: 2,
            id: 'draft-migration-successor',
            themeVersion: '1.1.0',
            validation: null,
            validations: [],
            version: 1,
          }
          return HttpResponse.json({ data: currentDraft }, { status: 201 })
        }
      )
    )
    renderEditor()
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Migrate into a reviewable successor draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Assess upgrade conflicts' }))
    await screen.findByText('Migration-ready')
    fireEvent.click(screen.getByRole('button', { name: 'Create migration successor' }))

    await screen.findByText('draft-migration-successor')
    expect(successorRequest).toMatchObject({
      confirm: true,
      expectedVersion: 1,
      migrationId: 'migration-synthetic-ready',
    })
    expect(screen.getByText('Validation required')).toBeTruthy()
  })

  it('lets a theme writer assess a migration but not create its successor', async () => {
    const upgradeTheme: AdminStorefrontTheme = {
      ...structuredClone(theme),
      configurationSchemaVersion: 2,
      themeVersion: '1.1.0',
    }
    let successorRequested = false
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [theme, upgradeTheme] })
      ),
      http.post('*/admin/storefront-experiences/drafts/:id/migrations/dry-run', () =>
        HttpResponse.json({
          data: {
            approvedAt: null,
            approvedBy: null,
            conflicts: [],
            createdAt: '2026-07-30T00:20:00.000Z',
            createdBy: 'theme-writer',
            draftId: baseDraft.id,
            draftVersion: 1,
            id: 'migration-synthetic-writer-assessment',
            sourceConfigurationSchemaVersion: 1,
            sourceThemeVersion: '1.0.0',
            status: 'dry_run',
            targetConfigurationSchemaVersion: 2,
            targetThemeVersion: '1.1.0',
          },
        })
      ),
      http.post('*/admin/storefront-experiences/drafts/:id/migrations/approve', () => {
        successorRequested = true
        return HttpResponse.json({ data: currentDraft }, { status: 201 })
      })
    )
    renderEditor('admin', 60_000, ['themes.read', 'themes.write'])
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Assess without migration approval authority' },
    })

    const assessment = screen.getByRole('button', { name: 'Assess upgrade conflicts' })
    expect((assessment as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(assessment)
    await screen.findByText('Migration-ready')

    const createSuccessor = screen.getByRole('button', { name: 'Create migration successor' })
    expect((createSuccessor as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(createSuccessor)
    expect(successorRequested).toBe(false)
  })

  it('polls asynchronous artifacts and posts a one-time grant without a URL credential', async () => {
    let submitted:
      { action: string; grant: string | undefined; method: string; target: string } | undefined
    const originalSubmit = HTMLFormElement.prototype.submit
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
      submitted = {
        action: this.action,
        grant: new FormData(this).get('grant')?.toString(),
        method: this.method,
        target: this.target,
      }
    }
    renderEditor('admin', 1)
    await screen.findByDisplayValue('Existing headline')
    fireEvent.change(screen.getByRole('textbox', { name: 'Change reason' }), {
      target: { value: 'Open the immutable private preview' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and preview' }))
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open authenticated preview' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        action: 'https://preview.example.test/__preview/session',
        grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        method: 'post',
        target: '_blank',
      })
    )
    expect(submitted?.action).not.toContain('grant_')
    expect(screen.getByText('c'.repeat(64))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Revoke preview access' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open authenticated preview' }).hasAttribute('disabled')
      ).toBe(true)
    )
    expect(screen.getAllByText('Preview access revoked')).toHaveLength(2)
    HTMLFormElement.prototype.submit = originalSubmit
  })

  it('approves only a current validated version and shows immutable audit identity', async () => {
    const validation = { ...validValidation, draftVersion: 1, id: 'validation-synthetic-1' }
    currentDraft = {
      ...currentDraft,
      validation,
      validations: [validation],
    }
    const hydrated = deployedPreviewContext('fixture')
    server.use(
      http.get('*/admin/storefront-experiences/drafts/:id/preview-context', () =>
        HttpResponse.json({
          data: { ...hydrated, build: { ...hydrated.build, inputIdentity: null } },
        })
      )
    )
    renderEditor()
    await screen.findByText('Validated v1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Approval reason' }), {
      target: { value: 'Approved after accessible fixture review' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact draft v1' }))

    await waitFor(() => expect(screen.getByText(/snapshot-approved-fashion-store/)).toBeTruthy())
    expect(approvalBody).toMatchObject({
      confirm: true,
      expectedVersion: 1,
      reason: 'Approved after accessible fixture review',
    })
    expect(screen.getByText(/audit succeeded/)).toBeTruthy()
  })

  it('hydrates the exact deployed preview so an approver without draft-write access can approve', async () => {
    window.history.replaceState(null, '', '/?preview-return=1')
    const releaseId = 'release-approver-hydration'
    const validation = {
      ...validValidation,
      catalogReleaseId: releaseId,
      draftVersion: 1,
      id: 'validation-approver-hydration',
    }
    currentDraft = {
      ...currentDraft,
      themeId: 'fashion-store',
      validation: null,
      validations: [validation],
    }
    let previewContextQuery = ''
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [{ ...theme, id: 'fashion-store' }] })
      ),
      http.get('*/admin/storefront-experiences/catalog-releases', () =>
        HttpResponse.json({ data: [catalogRelease(releaseId)] })
      ),
      http.get(
        '*/admin/storefront-experiences/drafts/:id/preview-context',
        ({ request }) => {
          previewContextQuery = new URL(request.url).search
          return HttpResponse.json({ data: deployedPreviewContext(releaseId) })
        }
      )
    )

    renderEditor('admin', 60_000, [
      'themes.read',
      'themes.preview',
      'themes.approve',
      'catalog.read',
    ])
    await screen.findByText('Ready')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Open authenticated preview' })
      )
    )
    expect(screen.getByText('Returned from private preview.')).toBeTruthy()
    expect(window.location.search).toBe('')
    expect(previewContextQuery).toContain('draftVersion=1')
    expect(previewContextQuery).toContain(`catalogReleaseId=${releaseId}`)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Validate saved version' })).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Approval reason' }), {
      target: { value: 'Approve the previously reviewed deployed preview' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact draft v1' }))

    await waitFor(() => expect(screen.getByText(/snapshot-approved-fashion-store/)).toBeTruthy())
    expect(approvalBody).toMatchObject({
      catalogReleaseId: releaseId,
      expectedVersion: 1,
    })
  })

  it('keeps release selection stable while busy and discards a delayed prior-release context', async () => {
    const releaseA = 'release-race-a'
    const releaseB = 'release-race-b'
    const validation = {
      ...validValidation,
      catalogReleaseId: releaseB,
      draftVersion: 1,
      id: 'validation-release-race-b',
    }
    currentDraft = {
      ...currentDraft,
      themeId: 'fashion-store',
      validation: null,
      validations: [validation],
    }
    let releaseARequested = false
    let resolveReleaseA!: (response: HttpResponse<Record<string, unknown>>) => void
    const delayedReleaseA = new Promise<HttpResponse<Record<string, unknown>>>((resolve) => {
      resolveReleaseA = resolve
    })
    let resolveApproval!: (response: HttpResponse<Record<string, unknown>>) => void
    const delayedApproval = new Promise<HttpResponse<Record<string, unknown>>>((resolve) => {
      resolveApproval = resolve
    })
    server.use(
      http.get('*/admin/storefront-experiences/themes', () =>
        HttpResponse.json({ data: [{ ...theme, id: 'fashion-store' }] })
      ),
      http.get('*/admin/storefront-experiences/catalog-releases', () =>
        HttpResponse.json({ data: [catalogRelease(releaseA), catalogRelease(releaseB)] })
      ),
      http.get(
        '*/admin/storefront-experiences/drafts/:id/preview-context',
        ({ request }) => {
          const releaseId = new URL(request.url).searchParams.get('catalogReleaseId')
          if (releaseId === releaseA) {
            releaseARequested = true
            return delayedReleaseA
          }
          return HttpResponse.json({ data: deployedPreviewContext(releaseB) })
        }
      ),
      http.post('*/admin/storefront-experiences/drafts/:id/approve', () => delayedApproval)
    )

    renderEditor()
    const selector = await screen.findByRole('combobox', { name: 'Catalog Release' })
    await waitFor(() => expect(releaseARequested).toBe(true))
    fireEvent.mouseDown(selector)
    const releaseBOptions = await screen.findAllByText(new RegExp(`${releaseB} · staging`))
    fireEvent.click(releaseBOptions.at(-1)!)
    await screen.findByText(`preview-build-${releaseB}`)

    resolveReleaseA(HttpResponse.json({ data: deployedPreviewContext(releaseA) }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(screen.getByText(`preview-build-${releaseB}`)).toBeTruthy()
    expect(screen.queryByText(`preview-build-${releaseA}`)).toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Approval reason' }), {
      target: { value: 'Hold the selected release during approval' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact draft v1' }))
    await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(true))
    resolveApproval(
      HttpResponse.json({
        data: {
          ...previewSnapshot,
          approvedAt: '2026-07-30T00:15:00.000Z',
          approvedBy: 'theme-admin',
          id: 'snapshot-approved-release-race-b',
          kind: 'approved',
        },
      })
    )
    await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false))
  })

  it('keeps read-only roles from mutating, previewing, or approving a draft', async () => {
    renderEditor('operations')
    await screen.findByDisplayValue('Existing headline')
    expect(screen.getByText('Read-only experience')).toBeTruthy()
    expect(
      (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).disabled
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save and preview' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Approve exact draft/ })).toBeNull()
  })
})
