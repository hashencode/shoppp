import { expect, test } from '@playwright/test'

const theme = {
  componentRegistry: {
    blocks: [],
    sections: [
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
        ],
        type: 'fashion.hero',
      },
    ],
  },
  configurationSchemaVersion: 1,
  fixtureBindings: [],
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
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: 'home-hero',
              settings: { heading: 'Preset headline' },
              type: 'fashion.hero',
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

const draft = {
  bindings: [],
  configurationSchemaVersion: 1,
  createdAt: '2026-07-30T00:00:00.000Z',
  createdBy: 'theme-admin',
  experienceId: 'storefront-fashion',
  id: 'draft-fashion-e2e',
  overrides: [],
  presetId: 'editorial',
  themeId: 'fashion',
  themeVersion: '1.0.0',
  updatedAt: '2026-07-30T00:00:00.000Z',
  updatedBy: 'theme-admin',
  validation: null,
  version: 1,
}

test('operator saves, validates, previews, and approves one exact theme version', async ({
  context,
  page,
}) => {
  const sequence: string[] = []
  let currentDraft = structuredClone(draft)
  let previewPost: { body: string | null; url: string } | null = null
  let productionActivationCalls = 0

  await page.route('**/admin/storefront-experiences/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/themes') && request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: { data: [theme] } })
      return
    }
    if (url.pathname.endsWith(`/drafts/${draft.id}`) && request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', json: { data: currentDraft } })
      return
    }
    if (url.pathname.endsWith(`/drafts/${draft.id}`) && request.method() === 'PUT') {
      sequence.push('save')
      const body = request.postDataJSON()
      expect(body.expectedVersion).toBe(1)
      currentDraft = { ...currentDraft, overrides: body.overrides, version: 2 }
      await route.fulfill({ contentType: 'application/json', json: { data: currentDraft } })
      return
    }
    if (url.pathname.endsWith('/validate')) {
      sequence.push('validate')
      expect(request.postDataJSON().expectedVersion).toBe(2)
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            createdAt: '2026-07-30T00:01:00.000Z',
            draftVersion: 2,
            id: 'validation-fashion-e2e',
            issues: [],
            status: 'valid',
            validatedBy: 'theme-admin',
          },
        },
      })
      return
    }
    if (url.pathname.endsWith('/preview')) {
      sequence.push('preview')
      expect(request.postDataJSON().expectedVersion).toBe(2)
      await route.fulfill({
        contentType: 'application/json',
        status: 202,
        json: {
          data: {
            build: {
              artifactDigest: 'a'.repeat(64),
              artifactPrefix: `snapshots/snapshot-preview-e2e/${'a'.repeat(64)}`,
              attempt: 1,
              cleanedAt: null,
              completedAt: '2026-07-30T00:02:00.000Z',
              correlationId: 'build-e2e',
              createdAt: '2026-07-30T00:01:00.000Z',
              expiresAt: '2099-07-30T00:00:00.000Z',
              failureCode: null,
              id: 'preview-build-e2e',
              snapshotId: 'snapshot-preview-e2e',
              status: 'deployed',
              updatedAt: '2026-07-30T00:02:00.000Z',
            },
            snapshot: {
              approvedAt: null,
              approvedBy: null,
              configurationSchemaVersion: 1,
              createdAt: '2026-07-30T00:01:00.000Z',
              createdBy: 'theme-admin',
              experienceId: draft.experienceId,
              id: 'snapshot-preview-e2e',
              kind: 'preview',
              sourceDraftId: draft.id,
              sourceDraftVersion: 2,
              sourceValidationId: 'validation-fashion-e2e',
              themeId: 'fashion',
              themeVersion: '1.0.0',
            },
          },
        },
      })
      return
    }
    if (url.pathname.endsWith('/grants')) {
      sequence.push('grant')
      await route.fulfill({
        contentType: 'application/json',
        status: 201,
        json: {
          data: {
            expiresAt: '2099-07-30T00:00:00.000Z',
            grant: 'grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            redeemUrl: 'https://preview.example.test/__preview/session',
            snapshotId: 'snapshot-preview-e2e',
          },
        },
      })
      return
    }
    if (url.pathname.endsWith('/approve')) {
      sequence.push('approve')
      expect(request.postDataJSON()).toMatchObject({ confirm: true, expectedVersion: 2 })
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: {
            approvedAt: '2026-07-30T00:03:00.000Z',
            approvedBy: 'theme-admin',
            configurationSchemaVersion: 1,
            createdAt: '2026-07-30T00:03:00.000Z',
            createdBy: 'theme-admin',
            experienceId: draft.experienceId,
            id: 'snapshot-approved-e2e',
            kind: 'approved',
            sourceDraftId: draft.id,
            sourceDraftVersion: 2,
            sourceValidationId: 'validation-fashion-e2e',
            themeId: 'fashion',
            themeVersion: '1.0.0',
          },
        },
      })
      return
    }
    await route.abort()
  })
  await page.route('**/storefront/activate**', async (route) => {
    productionActivationCalls += 1
    await route.abort()
  })
  await context.route('https://preview.example.test/__preview/session', async (route) => {
    previewPost = { body: route.request().postData(), url: route.request().url() }
    await route.fulfill({
      body: '<!doctype html><title>Private fixture preview</title>',
      contentType: 'text/html',
    })
  })

  await page.goto('/login')
  await page.getByPlaceholder('用户名').fill('theme-admin')
  await page.getByPlaceholder('密码').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.goto(`/storefront/themes/${draft.id}`)

  await page.getByRole('textbox', { name: 'home-hero heading' }).fill('E2E headline')
  await page.getByRole('textbox', { name: 'Change reason' }).fill('Review exact fixture version')
  await page.getByRole('button', { name: 'Save and preview' }).click()
  await expect(page.getByText('Ready')).toBeVisible()
  expect(sequence.slice(0, 3)).toEqual(['save', 'validate', 'preview'])

  const popupPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Open authenticated preview' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState()
  expect(previewPost?.url).toBe('https://preview.example.test/__preview/session')
  expect(previewPost?.url).not.toContain('grant_')
  expect(previewPost?.body).toContain('grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')

  await page
    .getByRole('textbox', { name: 'Approval reason' })
    .fill('Approved after private fixture review')
  await page.getByRole('button', { name: 'Approve exact draft v2' }).click()
  await expect(page.getByText(/snapshot-approved-e2e/)).toBeVisible()
  expect(sequence).toEqual(['save', 'validate', 'preview', 'grant', 'approve'])
  expect(productionActivationCalls).toBe(0)
})
