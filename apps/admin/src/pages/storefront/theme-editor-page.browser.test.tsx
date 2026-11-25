import React from 'react'
import { afterEach, expect, describe, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import type {
  StorefrontPublication,
  StorefrontPublicationContext,
} from '@shoppp/contracts'
import { translateMessage } from '../../shared/contexts/i18n-context'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
} from '../../test/i18n-browser-fixture'
import type { StorefrontExperienceDraft } from '../../services/storefront/api'
import { editorContext } from '../../../../storefront/tests/fixtures/editor-context'
const draft = editorContext.draft
import { StorefrontPublicationPanel } from './storefront-publication-panel'

void React

const publicationBrowserFixture = (failInitially = false) => {
  const identity = {
    catalogReleaseId: 'catalog-browser-approved',
    catalogManifestDigest: 'a'.repeat(64),
    catalogSourceDigest: 'b'.repeat(64),
    experienceSnapshotId: 'snapshot-browser-approved',
    snapshotDigest: 'c'.repeat(64),
    contactVersion: 'd'.repeat(64),
    experienceVersion: 1,
    themeId: 'fashion-store',
    themeVersion: '1.3.0',
    platformContractVersion: '1.0.0',
  }
  const publicationDraft: StorefrontExperienceDraft = {
    ...draft,
    validations: [
      {
        id: 'validation-browser-publication',
        catalogReleaseId: identity.catalogReleaseId,
        draftVersion: 1,
        status: 'valid',
        issues: [],
        createdAt: draft.createdAt,
        validatedBy: 'browser-operator',
      },
    ],
  }
  const record = (overrides: Partial<StorefrontPublication> = {}): StorefrontPublication => ({
    id: 'publication-22222222-2222-4222-8222-222222222222',
    environment: 'staging',
    identity,
    operation: 'publish',
    status: 'queued',
    expectedActivePublicationId: null,
    rollbackOf: null,
    restoreWorkerVersionId: null,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    createdBy: 'browser-operator',
    reason: 'Browser reviewed publication',
    correlationId: null,
    failureCode: null,
    runId: null,
    runAttempt: null,
    sourceCommit: null,
    receipt: null,
    ...overrides,
  })
  const receipt = {
    environment: 'staging' as const,
    identity,
    workerVersionId: 'worker-browser-exact',
    deploymentId: 'deployment-browser-exact',
    artifactDigest: 'e'.repeat(64),
    reportDigest: 'f'.repeat(64),
    observedAt: draft.createdAt,
  }
  const old = record({
    id: 'publication-11111111-1111-4111-8111-111111111111',
    identity: { ...identity, experienceSnapshotId: 'snapshot-browser-old' },
    status: 'succeeded',
    receipt: {
      ...receipt,
      identity: { ...identity, experienceSnapshotId: 'snapshot-browser-old' },
    },
  })
  let current: StorefrontPublicationContext = {
    environment: 'staging',
    approval: {
      id: identity.experienceSnapshotId,
      sourceDraftId: draft.id,
      sourceDraftVersion: 1,
      sourceValidationId: publicationDraft.validations[0].id,
      contentDigest: identity.snapshotDigest,
      identity,
    },
    active: { publication: null, verification: 'none', checkedAt: draft.createdAt },
    publications: failInitially
      ? [record({ status: 'failed', failureCode: 'build_hook_failed' })]
      : [old],
  }
  let failRead = failInitially
  let failSubmit = failInitially
  transport = installBrowserApi((request) => {
    if (request.method === 'get' && request.url?.endsWith('/publication-context')) {
      if (failRead) {
        failRead = false
        return {
          status: 503,
          data: { error: { code: 'unavailable', message: 'PRIVATE SERVER SENTENCE' } },
        }
      }
      return { data: { data: current } }
    }
    if (request.method === 'post' && request.url === '/admin/storefront-publications') {
      if (failSubmit) {
        failSubmit = false
        return {
          status: 503,
          data: { error: { code: 'unavailable', message: 'PRIVATE SERVER SENTENCE' } },
        }
      }
      const queued = record()
      current = { ...current, publications: [queued, old] }
      return { data: { data: queued }, status: 202 }
    }
    if (request.method === 'post' && request.url === '/admin/storefront-publications/rollback') {
      const queued = record({
        id: 'publication-33333333-3333-4333-8333-333333333333',
        operation: 'rollback',
        identity: old.identity,
        rollbackOf: old.id,
        expectedActivePublicationId: 'publication-22222222-2222-4222-8222-222222222222',
      })
      current = { ...current, publications: [queued, ...current.publications] }
      return { data: { data: queued }, status: 202 }
    }
    throw new Error(`Unexpected publication request ${request.method} ${request.url}`)
  })
  return {
    identity,
    draft: publicationDraft,
    verify: () => {
      const live = record({ status: 'succeeded', receipt })
      current = {
        ...current,
        active: { publication: live, verification: 'verified', checkedAt: draft.createdAt },
        publications: [live, old],
      }
    },
  }
}

describe('formal publication in a native browser', () => {
  it('confirms exact publishing, refreshes the online receipt, and submits a precise rollback without overflow', async () => {
    const fixture = publicationBrowserFixture()
    renderI18nBrowser(
      <StorefrontPublicationPanel
        draft={fixture.draft}
        dirty={false}
        busy={false}
        refreshToken={0}
      />,
      ['themes.read', 'themes.publish']
    )
    const locale = document.documentElement.lang as 'en-US' | 'zh-CN'
    const text = (key: string, values?: Record<string, string | number>) =>
      translateMessage(locale, key, values)
    assertNativeBrowserAndCss()
    await page.getByRole('button', { name: text('Publish storefront') }).click()
    const dialog = await screen.findByRole('dialog')
    assertWithinViewport(dialog)
    expect(
      within(dialog)
        .getByRole('button', { name: text('Confirm publication') })
        .hasAttribute('disabled')
    ).toBe(true)
    await page
      .getByRole('textbox', { name: text('Publication reason') })
      .fill('Browser reviewed publication')
    const before = transport!.requests.length
    // The modal blocks background pointer controls; this fixture control updates the locale.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    const nextLocale = document.documentElement.lang as 'en-US' | 'zh-CN'
    const nextText = (key: string, values?: Record<string, string | number>) =>
      translateMessage(nextLocale, key, values)
    expect(transport!.requests.length).toBe(before)
    expect(
      (screen.getByRole('textbox', { name: nextText('Publication reason') }) as HTMLTextAreaElement)
        .value
    ).toBe('Browser reviewed publication')
    await page.getByRole('button', { name: nextText('Confirm publication') }).click()
    await expect
      .element(page.getByRole('alert').getByText(nextText('Publication queued')))
      .toBeVisible()
    expect(screen.queryByText(nextText('This design is online'))).toBeNull()
    const mutation = transport!.requests.find(
      ({ method, url }) => method === 'post' && url === '/admin/storefront-publications'
    )!
    expect(JSON.parse(mutation.data as string)).toEqual({
      draftId: draft.id,
      expectedVersion: 1,
      identity: fixture.identity,
      expectedActivePublicationId: null,
      reason: 'Browser reviewed publication',
    })
    fixture.verify()
    await page.getByRole('button', { name: nextText('Refresh publication status') }).click()
    await expect.element(page.getByText(nextText('This design is online'))).toBeVisible()
    await page.getByText(nextText('Publication history')).click()
    await page
      .getByRole('button', {
        name: nextText('Restore version {id}', {
          id: 'publication-11111111-1111-4111-8111-111111111111',
        }),
      })
      .click()
    const rollbackDialog = await screen.findByRole('dialog')
    assertWithinViewport(rollbackDialog)
    await page
      .getByRole('textbox', { name: nextText('Publication reason') })
      .fill('Restore previously reviewed version')
    await page.getByRole('button', { name: nextText('Confirm rollback') }).click()
    await expect
      .element(page.getByRole('alert').getByText(nextText('Publication queued')))
      .toBeVisible()
    const rollback = transport!.requests.find(
      ({ url }) => url === '/admin/storefront-publications/rollback'
    )!
    expect(JSON.parse(rollback.data as string)).toEqual({
      targetPublicationId: 'publication-11111111-1111-4111-8111-111111111111',
      expectedActivePublicationId: 'publication-22222222-2222-4222-8222-222222222222',
      reason: 'Restore previously reviewed version',
    })
    await page.getByText(nextText('Publication history')).click()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('recovers a failed context read and retries a failed publication with its reason intact', async () => {
    const fixture = publicationBrowserFixture(true)
    renderI18nBrowser(
      <StorefrontPublicationPanel
        draft={fixture.draft}
        dirty={false}
        busy={false}
        refreshToken={0}
      />,
      ['themes.read', 'themes.publish']
    )
    const locale = document.documentElement.lang as 'en-US' | 'zh-CN'
    const text = (key: string) => translateMessage(locale, key)
    await expect
      .element(page.getByText(text('Publication status could not be updated')))
      .toBeVisible()
    await page.getByRole('button', { name: text('Refresh publication status') }).click()
    await page.getByRole('button', { name: text('Retry publication') }).click()
    await page
      .getByRole('textbox', { name: text('Publication reason') })
      .fill('Delivery service recovered')
    await page.getByRole('button', { name: text('Confirm publication') }).click()
    await expect.element(page.getByText(text('Publication could not be submitted'))).toBeVisible()
    expect(screen.queryByText('PRIVATE SERVER SENTENCE')).toBeNull()
    expect(
      (screen.getByRole('textbox', { name: text('Publication reason') }) as HTMLTextAreaElement)
        .value
    ).toBe('Delivery service recovered')
    await page.getByRole('button', { name: text('Confirm publication') }).click()
    await expect
      .element(page.getByRole('alert').getByText(text('Publication queued')))
      .toBeVisible()
    expect(screen.queryByText(text('This design is online'))).toBeNull()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})


afterEach(() => { cleanup(); transport?.restore() })
let transport: ReturnType<typeof installBrowserApi> | undefined
