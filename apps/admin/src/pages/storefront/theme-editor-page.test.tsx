import type { AdminStorefrontTheme } from '@shoppp/contracts'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import type { Role } from '../../shared/types/roles'
import type { StorefrontExperienceDraft } from '../../services/storefront/api'
import {
  createThemeOverrides,
  previewBuildStatus,
  resolveDraftTemplates,
  ThemeEditorPage,
} from './theme-editor-page'
import { ThemesPage } from './themes-page'

void React

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
        type: 'fashion.navigation',
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
        type: 'fashion.hero',
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
        type: 'fashion.story',
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
  id: 'fashion',
  platformCompatibility: { maxExclusive: '2.0.0', min: '1.0.0' },
  platformContractVersion: '1.0.0',
  presetDefinitions: [
    {
      id: 'editorial',
      label: 'Editorial',
      templates: [
        {
          id: 'fashion-home',
          pageType: 'home',
          requiredCapabilities: ['navigation.primary'],
          sections: [
            {
              blocks: [],
              capabilities: ['navigation.primary'],
              id: 'site-navigation',
              required: true,
              settings: {},
              type: 'fashion.navigation',
              visible: true,
            },
            {
              blocks: [],
              capabilities: [],
              id: 'home-hero',
              settings: { alignment: 'left', heading: 'Preset headline' },
              type: 'fashion.hero',
              visible: true,
            },
            {
              blocks: [],
              capabilities: [],
              id: 'home-story',
              settings: { body: 'Preset story' },
              type: 'fashion.story',
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
  experienceId: 'storefront-fashion',
  id: 'draft-fashion-1',
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
      templateId: 'fashion-home',
    },
  ],
  presetId: 'editorial',
  themeId: 'fashion',
  themeVersion: '1.0.0',
  updatedAt: '2026-07-30T00:00:00.000Z',
  updatedBy: 'theme-admin',
  validation: null,
  version: 1,
}

let currentDraft = structuredClone(baseDraft)
let updateBody: Record<string, unknown> | null = null
let validationBody: Record<string, unknown> | null = null
let previewBody: Record<string, unknown> | null = null
let approvalBody: Record<string, unknown> | null = null
let migrationBody: Record<string, unknown> | null = null
let createDraftBody: Record<string, unknown> | null = null
let buildStatus: 'building' | 'deployed' = 'building'

const validValidation = {
  createdAt: '2026-07-30T00:10:00.000Z',
  draftVersion: 2,
  id: 'validation-fashion-2',
  issues: [],
  status: 'valid' as const,
  validatedBy: 'theme-admin',
}

const previewSnapshot = {
  approvedAt: null,
  approvedBy: null,
  configurationSchemaVersion: 1,
  createdAt: '2026-07-30T00:11:00.000Z',
  createdBy: 'theme-admin',
  experienceId: 'storefront-fashion',
  id: 'snapshot-preview-fashion-2',
  kind: 'preview' as const,
  sourceDraftId: baseDraft.id,
  sourceDraftVersion: 2,
  sourceValidationId: validValidation.id,
  themeId: 'fashion',
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

const server = setupServer(
  http.get('*/admin/storefront-experiences/themes', () => HttpResponse.json({ data: [theme] })),
  http.get('*/admin/storefront-experiences/drafts', () =>
    HttpResponse.json({ data: [currentDraft] })
  ),
  http.get('*/admin/storefront-experiences/drafts/:id', () =>
    HttpResponse.json({ data: currentDraft })
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
      version: 2,
    }
    return HttpResponse.json({ data: currentDraft })
  }),
  http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
    validationBody = (await request.json()) as Record<string, unknown>
    const draftVersion = validationBody.expectedVersion as number
    return HttpResponse.json({
      data: {
        ...validValidation,
        draftVersion,
        id: `validation-fashion-${draftVersion}`,
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
  http.post('*/admin/storefront-experiences/drafts/:id/approve', async ({ request }) => {
    approvalBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      data: {
        ...previewSnapshot,
        approvedAt: '2026-07-30T00:15:00.000Z',
        approvedBy: 'theme-admin',
        id: 'snapshot-approved-fashion-2',
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
              templateId: 'fashion-home',
            },
          ],
          createdAt: '2026-07-30T00:20:00.000Z',
          createdBy: 'theme-admin',
          draftId: baseDraft.id,
          draftVersion: 1,
          id: 'migration-fashion-1-2',
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

const authValue = (role: Role) => ({
  accountName: 'theme-admin@example.test',
  displayName: 'Theme admin',
  isAuthenticated: true,
  isLoading: false,
  login: () => undefined,
  logout: () => undefined,
  role,
  setAccountName: () => undefined,
  setDisplayName: () => undefined,
  setRole: () => undefined,
})

const renderEditor = (role: Role = 'admin', pollIntervalMs = 60_000) => {
  const router = createMemoryRouter(
    [
      {
        path: '/storefront/themes/:draftId',
        element: (
          <AuthContext.Provider value={authValue(role)}>
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
  return { router, ...render(<RouterProvider router={router} />) }
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
  return { router, ...render(<RouterProvider router={router} />) }
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
  buildStatus = 'building'
  server.resetHandlers()
})
afterAll(() => server.close())

describe('ThemesPage', () => {
  it('lists API-approved packages and creates the selected preset draft', async () => {
    renderThemes()
    await screen.findByText('Approved packages')
    expect(screen.getByText('fashion')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use package' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Creation reason' }), {
      target: { value: 'Start an approved Fashion fixture draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }))

    await screen.findByText('CREATED_EDITOR')
    expect(createDraftBody).toMatchObject({
      draft: {
        experienceId: 'storefront-fashion',
        presetId: 'editorial',
        themeId: 'fashion',
        themeVersion: '1.0.0',
      },
      reason: 'Start an approved Fashion fixture draft',
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
      expect(screen.getByText(/draft changed. Reload it before saving again/)).toBeTruthy()
    )
    expect(
      (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).value
    ).toBe('Keep this local edit')
    const originalConfirm = window.confirm
    window.confirm = () => false
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved draft' }))
    expect(
      (screen.getByRole('textbox', { name: 'home-hero heading' }) as HTMLTextAreaElement).value
    ).toBe('Keep this local edit')
    window.confirm = originalConfirm
  })

  it('shows validation issues and never previews an invalid saved version', async () => {
    server.use(
      http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
        validationBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          data: {
            createdAt: '2026-07-30T00:10:00.000Z',
            draftVersion: 2,
            id: 'validation-fashion-invalid-2',
            issues: [
              {
                code: 'required_capability_missing',
                message: 'Required navigation capability is missing.',
                templateId: 'fashion-home',
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
    expect(previewBody).toBeNull()
    expect(screen.queryByText('Building')).toBeNull()
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
    HTMLFormElement.prototype.submit = originalSubmit
  })

  it('approves only a current validated version and shows immutable audit identity', async () => {
    currentDraft = {
      ...currentDraft,
      validation: { ...validValidation, draftVersion: 1, id: 'validation-fashion-1' },
    }
    renderEditor()
    await screen.findByText('Validated v1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Approval reason' }), {
      target: { value: 'Approved after accessible fixture review' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact draft v1' }))

    await waitFor(() => expect(screen.getByText(/snapshot-approved-fashion-2/)).toBeTruthy())
    expect(approvalBody).toMatchObject({
      confirm: true,
      expectedVersion: 1,
      reason: 'Approved after accessible fixture review',
    })
    expect(screen.getByText(/audit succeeded/)).toBeTruthy()
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
