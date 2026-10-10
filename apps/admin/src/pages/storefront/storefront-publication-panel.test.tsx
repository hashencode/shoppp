import React, { useState } from 'react'
import type {
  AdminPermission,
  StorefrontPublication,
  StorefrontPublicationContext,
} from '@shoppp/contracts'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { useI18n } from '../../shared/contexts/i18n-context'
import type { StorefrontExperienceDraft } from '../../services/storefront/api'
import { StorefrontPublicationPanel } from './storefront-publication-panel'

void React

window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const identity = {
  catalogReleaseId: 'catalog-approved',
  catalogManifestDigest: 'a'.repeat(64),
  catalogSourceDigest: 'b'.repeat(64),
  experienceSnapshotId: 'snapshot-approved',
  snapshotDigest: 'c'.repeat(64),
  contactVersion: 'd'.repeat(64),
  experienceVersion: 2,
  themeId: 'fashion-store',
  themeVersion: '1.0.0',
  platformContractVersion: '1.0.0',
}
const draft: StorefrontExperienceDraft = {
  id: 'draft-approved',
  experienceId: 'storefront-approved',
  themeId: 'fashion-store',
  themeVersion: '1.0.0',
  configurationSchemaVersion: 1,
  presetId: 'editorial',
  overrides: [],
  bindings: [],
  version: 2,
  createdAt: '2026-10-11T00:00:00.000Z',
  updatedAt: '2026-10-11T00:00:00.000Z',
  createdBy: 'operator',
  updatedBy: 'operator',
  validation: null,
  validations: [
    {
      id: 'validation-approved',
      catalogReleaseId: identity.catalogReleaseId,
      draftVersion: 2,
      status: 'valid',
      issues: [],
      createdAt: '2026-10-11T00:00:00.000Z',
      validatedBy: 'operator',
    },
  ],
}
const publication = (overrides: Partial<StorefrontPublication> = {}): StorefrontPublication => ({
  id: 'publication-request',
  environment: 'staging',
  identity,
  operation: 'publish',
  status: 'queued',
  expectedActivePublicationId: null,
  rollbackOf: null,
  restoreWorkerVersionId: null,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  createdBy: 'operator',
  reason: 'Publish reviewed design',
  correlationId: null,
  failureCode: null,
  runId: null,
  runAttempt: null,
  sourceCommit: null,
  receipt: null,
  ...overrides,
})
const succeeded = (overrides: Partial<StorefrontPublication> = {}) =>
  publication({
    status: 'succeeded',
    receipt: {
      environment: 'staging',
      identity: overrides.identity ?? identity,
      workerVersionId: 'worker-live',
      deploymentId: 'deployment-live',
      artifactDigest: 'e'.repeat(64),
      reportDigest: 'f'.repeat(64),
      observedAt: draft.createdAt,
    },
    ...overrides,
  })
const context = (): StorefrontPublicationContext => ({
  environment: 'staging',
  approval: {
    id: identity.experienceSnapshotId,
    sourceDraftId: draft.id,
    sourceDraftVersion: draft.version,
    sourceValidationId: draft.validations[0].id,
    contentDigest: identity.snapshotDigest,
    identity,
  },
  active: { publication: null, verification: 'none', checkedAt: draft.createdAt },
  publications: [],
})
let current = context()
let reads = 0
let body: Record<string, unknown> | null = null
let mutationHeaders: Headers | null = null
const server = setupServer(
  http.get('*/admin/storefront-experiences/drafts/:id/publication-context', () => {
    reads += 1
    return HttpResponse.json({ data: current })
  }),
  http.post('*/admin/storefront-publications', async ({ request }) => {
    body = (await request.json()) as Record<string, unknown>
    mutationHeaders = request.headers
    const queued = publication()
    current = { ...current, publications: [queued] }
    return HttpResponse.json({ data: queued }, { status: 202 })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  cleanup()
  server.resetHandlers()
  current = context()
  reads = 0
  body = null
  mutationHeaders = null
})

const renderPanel = (
  props: Partial<React.ComponentProps<typeof StorefrontPublicationPanel>> = {},
  permissions: readonly AdminPermission[] = ['themes.read', 'themes.publish']
) =>
  renderInLocale(
    <AuthTestProvider permissions={permissions}>
      <StorefrontPublicationPanel
        draft={draft}
        selectedReleaseId={identity.catalogReleaseId}
        dirty={false}
        busy={false}
        refreshToken={0}
        {...props}
      />
    </AuthTestProvider>
  )
const confirmPublish = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Publish storefront' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Publication reason' }), {
    target: { value: 'Publish reviewed design' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm publication' }))
}

describe('formal storefront publication', () => {
  it('restores the exact approval on reload and submits a queued request without claiming online', async () => {
    renderPanel()
    await screen.findByText('Approved, awaiting formal release')
    await confirmPublish()
    await screen.findAllByText('Publication queued')
    expect(body).toEqual({
      draftId: draft.id,
      expectedVersion: 2,
      identity,
      expectedActivePublicationId: null,
      reason: 'Publish reviewed design',
    })
    expect(mutationHeaders?.get('Idempotency-Key')).toMatch(/^storefront-publish-/)
    expect(screen.queryByText('This design is online')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Publish storefront' }).hasAttribute('disabled')
    ).toBe(true)
  })

  it('shows online only after explicit refresh verifies the actual current identity', async () => {
    current.publications = [succeeded()]
    renderPanel()
    await screen.findByText('No formal publication yet')
    expect(screen.queryByText('This design is online')).toBeNull()
    current.active = {
      publication: current.publications[0],
      verification: 'verified',
      checkedAt: draft.createdAt,
    }
    fireEvent.click(screen.getByRole('button', { name: 'Refresh publication status' }))
    await screen.findByText('This design is online')
    expect(
      screen.getByRole('button', { name: 'Publish storefront' }).hasAttribute('disabled')
    ).toBe(true)
  })

  it.each(['unavailable', 'mismatch'] as const)(
    'does not treat a historical success as online when verification is %s',
    async (verification) => {
      current = {
        ...current,
        active: { publication: succeeded(), verification, checkedAt: draft.createdAt },
        publications: [succeeded()],
      }
      renderPanel()
      await screen.findByText('Online version could not be verified')
      expect(screen.queryByText('This design is online')).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Publish storefront' }).hasAttribute('disabled')
      ).toBe(true)
      fireEvent.click(screen.getByText('Publication history'))
      await screen.findByText('Previously published')
    }
  )

  it('labels another verified design as the current storefront and sends an exact rollback request', async () => {
    const old = succeeded({
      id: 'publication-old',
      identity: { ...identity, experienceSnapshotId: 'snapshot-old' },
    })
    const live = succeeded({
      id: 'publication-live',
      identity: { ...identity, experienceSnapshotId: 'snapshot-other-draft' },
    })
    current = {
      ...current,
      active: { publication: live, verification: 'verified', checkedAt: draft.createdAt },
      publications: [old],
    }
    server.use(
      http.post('*/admin/storefront-publications/rollback', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        mutationHeaders = request.headers
        const queued = publication({
          operation: 'rollback',
          identity: old.identity,
          rollbackOf: old.id,
          expectedActivePublicationId: live.id,
        })
        current.publications = [queued, old]
        return HttpResponse.json({ data: queued }, { status: 202 })
      })
    )
    renderPanel()
    await screen.findByText('Current storefront version is verified')
    expect(screen.queryByText('This design is online')).toBeNull()
    fireEvent.click(screen.getByText('Publication history'))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore version publication-old' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Restore reviewed old version' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm rollback' }))
    await screen.findAllByText('Publication queued')
    expect(body).toEqual({
      targetPublicationId: old.id,
      expectedActivePublicationId: live.id,
      reason: 'Restore reviewed old version',
    })
    expect(mutationHeaders?.get('Idempotency-Key')).toMatch(/^storefront-rollback-/)
    expect(screen.queryByText('This design is online')).toBeNull()
  })

  it('allows a failed publication to retry with the current exact approval', async () => {
    current.publications = [publication({ status: 'failed', failureCode: 'build_hook_failed' })]
    renderPanel()
    await screen.findByText('Publication failed')
    expect(
      screen.getByText(
        'Publication could not start. Retry after the delivery service is available.'
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry publication' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Delivery fixed' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm publication' }))
    await screen.findAllByText('Publication queued')
    expect(body).toMatchObject({ identity, reason: 'Delivery fixed' })
  })

  it('explains the actual missing delivery configuration failure', async () => {
    current.publications = [
      publication({ status: 'failed', failureCode: 'build_hook_not_configured' }),
    ]
    renderPanel()
    await screen.findByText('Ask an administrator to configure storefront delivery, then retry.')
    expect(screen.queryByText('This design is online')).toBeNull()
  })

  it('retries a failed rollback against its original target and the current online pointer', async () => {
    const old = succeeded({
      id: 'publication-old',
      identity: { ...identity, experienceSnapshotId: 'snapshot-old' },
    })
    const live = succeeded({ id: 'publication-live' })
    current.active = { publication: live, verification: 'verified', checkedAt: draft.createdAt }
    current.publications = [
      publication({
        id: 'publication-failed-restore',
        operation: 'rollback',
        status: 'failed',
        rollbackOf: old.id,
        failureCode: 'build_hook_failed',
      }),
      old,
    ]
    server.use(
      http.post('*/admin/storefront-publications/rollback', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        const queued = publication({ operation: 'rollback', rollbackOf: old.id })
        current.publications = [queued, old]
        return HttpResponse.json({ data: queued }, { status: 202 })
      })
    )
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry rollback' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Retry the reviewed restore' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm rollback' }))
    await screen.findAllByText('Publication queued')
    expect(body).toEqual({
      targetPublicationId: old.id,
      expectedActivePublicationId: live.id,
      reason: 'Retry the reviewed restore',
    })
  })

  it('keeps an unresolved publication blocked while its actual state is unknown', async () => {
    current.publications = [publication({ status: 'unresolved' })]
    renderPanel()
    await screen.findByText('Publication needs verification')
    expect(
      screen.getByRole('button', { name: 'Publish storefront' }).hasAttribute('disabled')
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Publish storefront' }))
    expect(body).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['dirty', 'source', 'version', 'validation', 'contact'] as const)(
    'blocks publishing when the exact approval becomes stale through %s',
    async (kind) => {
      if (kind === 'contact') current.approval = null
      const props =
        kind === 'dirty'
          ? { dirty: true }
          : kind === 'source'
            ? { selectedReleaseId: 'other-release' }
            : kind === 'version'
              ? { draft: { ...draft, version: 3 } }
              : kind === 'validation'
                ? { draft: { ...draft, validations: [] } }
                : {}
      renderPanel(props)
      await screen.findByText('No formal publication yet')
      expect(
        screen.getByRole('button', { name: 'Publish storefront' }).hasAttribute('disabled')
      ).toBe(true)
      expect(screen.queryByText('Approved, awaiting formal release')).toBeNull()
    }
  )

  it('uses the approval validation for a publisher without edit, preview, approve or source-selector permission', async () => {
    renderPanel({ selectedReleaseId: undefined }, ['themes.read', 'themes.publish'])
    await confirmPublish()
    await screen.findAllByText('Publication queued')
    expect(body).toMatchObject({ identity })
  })

  it('does not infer publish permission from the admin role or approval permission', async () => {
    renderPanel({}, ['themes.read', 'themes.approve', 'themes.write'])
    await screen.findByText('Approved, awaiting formal release')
    expect(screen.queryByRole('button', { name: 'Publish storefront' })).toBeNull()
    expect(body).toBeNull()
  })

  it('rejects a late context response after permission loss', async () => {
    let release!: (value: Response) => void
    server.use(
      http.get(
        '*/admin/storefront-experiences/drafts/:id/publication-context',
        () =>
          new Promise<Response>((resolve) => {
            release = resolve
          })
      )
    )
    const permissions: readonly AdminPermission[] = ['themes.read', 'themes.publish']
    const Harness = () => {
      const [allowed, setAllowed] = useState(true)
      return (
        <>
          <button onClick={() => setAllowed(false)}>Revoke access</button>
          <AuthTestProvider permissions={allowed ? permissions : []}>
            <StorefrontPublicationPanel draft={draft} dirty={false} busy={false} refreshToken={0} />
          </AuthTestProvider>
        </>
      )
    }
    renderInLocale(<Harness />)
    await waitFor(() => expect(release).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: 'Revoke access' }))
    await act(async () => {
      release(HttpResponse.json({ data: current }))
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(screen.queryByRole('button', { name: 'Publish storefront' })).toBeNull()
    expect(screen.queryByText('Approved, awaiting formal release')).toBeNull()
  })

  it('invalidates the confirmation when selected sources change', async () => {
    const Harness = () => {
      const [source, setSource] = useState(identity.catalogReleaseId)
      return (
        <>
          <button onClick={() => setSource('changed-release')}>Change source</button>
          <AuthTestProvider permissions={['themes.read', 'themes.publish']}>
            <StorefrontPublicationPanel
              draft={draft}
              selectedReleaseId={source}
              dirty={false}
              busy={false}
              refreshToken={0}
            />
          </AuthTestProvider>
        </>
      )
    }
    renderInLocale(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Publish storefront' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Change source' }))
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Confirm publication' }).hasAttribute('disabled')
      ).toBe(true)
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm publication' }))
    expect(body).toBeNull()
  })

  it('keeps confirmation input and request count unchanged when language changes', async () => {
    const LocaleSwitch = () => {
      const { setLocale } = useI18n()
      return <button onClick={() => setLocale('zh-CN')}>Switch language</button>
    }
    renderInLocale(
      <AuthTestProvider permissions={['themes.read', 'themes.publish']}>
        <LocaleSwitch />
        <StorefrontPublicationPanel draft={draft} dirty={false} busy={false} refreshToken={0} />
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Publish storefront' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Publication reason' }), {
      target: { value: 'Keep review reason' },
    })
    const before = reads
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(
      within(dialog).getByRole('textbox', { name: '发布原因' }).getAttribute('value') ??
        (within(dialog).getByRole('textbox', { name: '发布原因' }) as HTMLTextAreaElement).value
    ).toBe('Keep review reason')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(reads).toBe(before)
    fireEvent.click(within(dialog).getByRole('button', { name: '确认发布' }))
    await screen.findByText('发布已提交')
    expect(body).toMatchObject({ reason: 'Keep review reason' })
  })

  it('localizes submission conflicts and never exposes server prose', async () => {
    server.use(
      http.post('*/admin/storefront-publications', () =>
        HttpResponse.json(
          {
            error: {
              code: 'storefront_publication_contact_stale',
              message: 'PRIVATE SERVER SENTENCE',
            },
          },
          { status: 409 }
        )
      )
    )
    renderPanel()
    await confirmPublish()
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText(
      'Store contact details changed. Prepare a new preview and approve it before publishing.'
    )
    expect(screen.queryByText('PRIVATE SERVER SENTENCE')).toBeNull()
    expect(screen.queryByText('This design is online')).toBeNull()
  })
})
