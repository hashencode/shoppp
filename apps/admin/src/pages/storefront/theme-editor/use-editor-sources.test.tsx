import React, { type PropsWithChildren } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { I18nProvider } from '../../../shared/contexts/i18n-context'
import { useEditorSources } from './use-editor-sources'

void React
const release = (id: string) => ({
  id,
  status: 'private-preview',
  environment: 'staging',
  approvedAt: '2026-10-31T00:00:00Z',
  products: [],
  collections: [],
  destinations: [],
})
const server = setupServer(
  http.get('*/admin/storefront-experiences/catalog-releases', () =>
    HttpResponse.json({ data: [release('older-public-source')] })
  ),
  http.get('*/admin/storefront-experiences/catalog-releases/:id', ({ params }) =>
    HttpResponse.json({ data: release(String(params.id)) })
  ),
  http.post('*/admin/catalog/releases/preview-candidates', () =>
    HttpResponse.json({
      data: { id: 'prepared-source', status: 'succeeded', purpose: 'private-preview' },
    })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
const wrapper = ({ children }: PropsWithChildren) => <I18nProvider>{children}</I18nProvider>

describe('editor source identity', () => {
  it('does not replace a newly prepared exact source with a late initial list', async () => {
    let releaseList!: () => void
    const response = new Promise<void>((resolve) => {
      releaseList = resolve
    })
    server.use(
      http.get('*/admin/storefront-experiences/catalog-releases', async () => {
        await response
        return HttpResponse.json({ data: [release('older-public-source')] })
      })
    )
    const { result } = renderHook(
      () => useEditorSources({ draftId: 'draft', canPreview: true, canPrepare: true }),
      { wrapper }
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await result.current.prepare()
    })
    expect(result.current.releaseId).toBe('prepared-source')
    await act(async () => {
      releaseList()
      await response
    })
    await waitFor(() =>
      expect(result.current.releases.some((release) => release.id === 'older-public-source')).toBe(
        true
      )
    )
    expect(result.current.releaseId).toBe('prepared-source')
  })
  it('restores the saved source identity and keeps an expired source unavailable', async () => {
    server.use(
      http.get('*/admin/storefront-experiences/catalog-releases/saved-source', () =>
        HttpResponse.json(
          { error: { code: 'catalog_release_unavailable', message: 'Saved sources expired.' } },
          { status: 422 }
        )
      )
    )
    const { result } = renderHook(
      () =>
        useEditorSources({
          draftId: 'draft',
          savedReleaseId: 'saved-source',
          canPreview: true,
          canPrepare: false,
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.sourceError).toBeTruthy())
    expect(result.current.releaseId).toBe('saved-source')
    expect(result.current.releaseId).not.toBe('older-public-source')
  })
})
