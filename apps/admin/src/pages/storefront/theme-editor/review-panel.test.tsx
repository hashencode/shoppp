import React, { useState } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { renderInLocale } from '../../../test/render-in-locale'
import { AuthTestProvider } from '../../../test/auth-context-fixture'
import { editorContext } from '../../../../../storefront/tests/fixtures/editor-context'
import { EditorReviewPanel } from './review-panel'

void React
const draft = editorContext.draft
const calls: Array<{ path: string; body: unknown }> = []
const preview = {
  snapshot: { id: 'snapshot-saved', sourceDraftVersion: 1 },
  build: { id: 'build-saved', status: 'deployed' },
}
const server = setupServer(
  http.get('*/admin/storefront-experiences/drafts/:id/preview-context', () =>
    HttpResponse.json({ data: preview })
  ),
  http.get('*/admin/storefront-experiences/drafts/:id/publication-context', () =>
    HttpResponse.json({
      data: {
        environment: 'staging',
        approval: null,
        active: { publication: null, verification: 'none', checkedAt: draft.createdAt },
        publications: [],
      },
    })
  ),
  http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
    calls.push({ path: 'validate', body: await request.json() })
    return HttpResponse.json({ data: { status: 'valid', issues: [] } })
  }),
  http.post('*/admin/storefront-experiences/drafts/:id/preview', async ({ request }) => {
    calls.push({ path: 'preview', body: await request.json() })
    return HttpResponse.json({ data: preview })
  })
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  calls.length = 0
  server.resetHandlers()
})
afterAll(() => server.close())
function Harness({ approver = false }: { approver?: boolean }) {
  const [dirty, setDirty] = useState(false)
  return (
    <MemoryRouter>
      <AuthTestProvider
        permissions={
          approver
            ? ['themes.read', 'themes.preview', 'themes.approve']
            : ['themes.read', 'themes.write', 'themes.preview']
        }
      >
        <button onClick={() => setDirty(true)}>Edit locally</button>
        <EditorReviewPanel
          draft={draft}
          releaseId="release-saved"
          dirty={dirty}
          onSelect={() => undefined}
        />
      </AuthTestProvider>
    </MemoryRouter>
  )
}
describe('saved design review identity', () => {
  it('lets a read-only approver retry a failed saved-preview read without writing the draft', async () => {
    let failed = true
    server.use(http.get('*/admin/storefront-experiences/drafts/:id/preview-context', () => failed ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json({ data: preview })))
    renderInLocale(<Harness approver />)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    failed = false
    fireEvent.click(retry)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Approve saved design' }) as HTMLButtonElement).disabled).toBe(false))
    expect(calls).toEqual([])
  })
  it('restores the exact deployed preview for an approver without draft-write permission and blocks approval after an edit', async () => {
    renderInLocale(<Harness approver />)
    const approve = await screen.findByRole('button', { name: 'Approve saved design' })
    await waitFor(() => expect((approve as HTMLButtonElement).disabled).toBe(false))
    expect(
      (screen.getByRole('button', { name: 'Build formal preview' }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Edit locally' }))
    expect((approve as HTMLButtonElement).disabled).toBe(true)
    expect(calls).toEqual([])
  })
  it('does not build or approve a later local edit when validation of the saved version returns late', async () => {
    let complete!: () => void
    const pending = new Promise<void>((resolve) => {
      complete = resolve
    })
    server.use(
      http.post('*/admin/storefront-experiences/drafts/:id/validate', async ({ request }) => {
        calls.push({ path: 'validate', body: await request.json() })
        await pending
        return HttpResponse.json({ data: { status: 'valid', issues: [] } })
      })
    )
    renderInLocale(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Build formal preview' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit locally' }))
    complete()
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /Build formal preview/ }) as HTMLButtonElement).disabled
      ).toBe(true)
    )
    expect(calls).toEqual([
      {
        path: 'validate',
        body: { expectedVersion: 1, reason: '', catalogReleaseId: 'release-saved' },
      },
    ])
  })
})
