import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { renderInLocale } from '../../test/render-in-locale'
import { CatalogPreviewCandidatePanel } from './catalog-preview-candidate-panel'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const candidate = {
  environment: 'staging',
  id: 'release-private-001',
  manifestDigest: 'a'.repeat(64),
  purpose: 'private-preview',
  sourceDigest: 'b'.repeat(64),
  sources: [
    {
      digest: 'c'.repeat(64),
      id: 'identity.primary',
      kind: 'store-identity',
      version: 1,
    },
  ],
  status: 'succeeded',
}

const server = setupServer(
  http.post('*/admin/catalog/releases/preview-candidates', () =>
    HttpResponse.json({ data: candidate }, { status: 201 })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  window.sessionStorage.clear()
})
afterAll(() => server.close())

describe('CatalogPreviewCandidatePanel', () => {
  it('shows the persisted build phase as pending while the request is in flight', async () => {
    let release!: () => void
    server.use(
      http.post('*/admin/catalog/releases/preview-candidates', async () => {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return HttpResponse.json({ data: candidate }, { status: 201 })
      })
    )
    renderInLocale(
      <MemoryRouter>
        <CatalogPreviewCandidatePanel />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('Candidate build reason'), {
      target: { value: 'Observe pending candidate' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Build preview candidate' }))
    expect(await screen.findByText('Candidate build pending')).toBeTruthy()
    release()
    expect(await screen.findByText('Private candidate ready')).toBeTruthy()
  })

  it('labels the result as private and hands the exact candidate to Theme Editor', async () => {
    renderInLocale(
      <MemoryRouter initialEntries={['/catalog']}>
        <Routes>
          <Route path="/catalog" element={<CatalogPreviewCandidatePanel />} />
          <Route path="/storefront/themes" element={<div>THEME_LIST</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Candidate build reason'), {
      target: { value: 'Review current storefront sources' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Build preview candidate' }))

    expect(await screen.findByText('Private Preview only')).toBeTruthy()
    expect(
      screen.getByText(
        (_content, element) =>
          element?.classList.contains('ant-tag') === true &&
          element.textContent?.includes('identity.primary') === true &&
          element.textContent?.includes('1') === true
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue in Theme Editor' }))
    await waitFor(() => expect(screen.getByText('THEME_LIST')).toBeTruthy())
    expect(window.sessionStorage.getItem('storefront-editor-catalog-release')).toBe(candidate.id)
    expect(window.sessionStorage.getItem('storefront-editor-private-candidate')).toBe(candidate.id)
  })

  it('keeps a failed build retryable without losing the reason', async () => {
    server.use(
      http.post('*/admin/catalog/releases/preview-candidates', () =>
        HttpResponse.json(
          { error: { code: 'catalog_source_drift', message: 'A source changed.' } },
          { status: 409 }
        )
      )
    )
    renderInLocale(
      <MemoryRouter>
        <CatalogPreviewCandidatePanel />
      </MemoryRouter>
    )
    const reason = screen.getByLabelText('Candidate build reason')
    fireEvent.change(reason, { target: { value: 'Retry drifted candidate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Build preview candidate' }))
    expect(await screen.findByText('Candidate build failed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect((reason as HTMLTextAreaElement).value).toBe('Retry drifted candidate')
  })
})
