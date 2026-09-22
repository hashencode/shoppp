import React from 'react'
import { App as AntApp } from 'antd'
import { fireEvent, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'

import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { PoliciesPage } from './policies-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const policy = {
  createdAt: '2026-09-23T00:00:00.000Z',
  effectiveDate: '2026-10-01',
  id: 'policy.returns',
  kind: 'returns',
  sections: [{ id: 'section.summary', kind: 'paragraph', text: 'Returns in 30 days.' }],
  slug: 'returns',
  status: 'draft',
  title: 'Returns policy',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 1,
}

describe('PoliciesPage', () => {
  it('reviews exact rendered bytes before exposing separately permitted approval', async () => {
    server.use(
      http.get('*/admin/settings/policies', () => HttpResponse.json({ data: [policy] })),
      http.get('*/admin/settings/policies/policy.returns/review', () =>
        HttpResponse.json({
          data: {
            current: policy,
            digest: 'a'.repeat(64),
            previous: null,
            previousRenderedText: null,
            renderedText: 'Returns in 30 days.',
          },
        })
      ),
      http.post('*/admin/settings/policies/policy.returns/approve', () =>
        HttpResponse.json({ data: { ...policy, status: 'approved' } })
      )
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['policies.read', 'policies.approve']}>
          <MemoryRouter><PoliciesPage /></MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    expect(await screen.findByText('Returns in 30 days.')).toBeTruthy()
    expect(screen.getByText(`Digest: ${'a'.repeat(64)}`)).toBeTruthy()
    expect(screen.getByText('Effective date: 2026-10-01')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Legal reviewed the exact version' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact version' }))
    expect(await screen.findByText('Approve this exact Policy version?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('invalidates a stale review and recovers to the latest version after a conflict', async () => {
    const latest = { ...policy, title: 'Updated returns policy', version: 2 }
    let latestReview = false
    server.use(
      http.get('*/admin/settings/policies', () =>
        HttpResponse.json({ data: [policy], meta: { nextCursor: null } })
      ),
      http.get('*/admin/settings/policies/policy.returns/review', ({ request }) => {
        const version = new URL(request.url).searchParams.get('version')
        if (version === null) latestReview = true
        return HttpResponse.json({
          data: {
            current: version === '1' ? policy : latest,
            digest: 'b'.repeat(64),
            previous: null,
            previousRenderedText: null,
            renderedText: 'Returns in 30 days.',
          },
        })
      }),
      http.post('*/admin/settings/policies/policy.returns/approve', () =>
        HttpResponse.json(
          { error: { code: 'policy_conflict', message: 'The Policy changed.' } },
          { status: 409 }
        )
      )
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['policies.read', 'policies.approve']}>
          <MemoryRouter><PoliciesPage /></MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    expect(await screen.findByText('Returns in 30 days.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Approve the exact reviewed version' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact version' }))
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }))

    expect(await screen.findByText('Exact review · version 2')).toBeTruthy()
    expect(latestReview).toBe(true)
    expect(screen.getByText('Updated returns policy')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve exact version' }).hasAttribute('disabled')).toBe(true)
  })
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
