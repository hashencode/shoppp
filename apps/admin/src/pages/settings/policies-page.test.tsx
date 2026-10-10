import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'

import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { PoliciesPage } from './policies-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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
  it('keeps historical deployment inclusion in version details without claiming current storefront state', async () => {
    server.use(
      http.get('*/admin/settings/policies', () =>
        HttpResponse.json({
          data: [{ ...policy, status: 'published', inclusion: { candidate: true, live: true } }],
        })
      )
    )
    renderInLocale(
      <AuthTestProvider permissions={['policies.read']}>
        <MemoryRouter>
          <PoliciesPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    await screen.findByText('Returns policy')
    expect(screen.queryByText(/Deployed to storefront/)).toBeNull()
    const history = screen.getByText('Deployment history includes this version.')
    expect(history.closest('details')?.open).toBe(false)
    expect(
      screen.getByText('Included in a private preview candidate.').closest('details')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })
  it('associates an empty section submit error with the labelled content group', async () => {
    let submitted = false
    server.use(
      http.get('*/admin/settings/policies', () =>
        HttpResponse.json({ data: [{ ...policy, sections: [] }] })
      ),
      http.put('*/admin/settings/policies/policy.returns', () => {
        submitted = true
        return HttpResponse.json({ data: policy })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['policies.read', 'policies.write']}>
        <MemoryRouter>
          <PoliciesPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    await screen.findByDisplayValue('Returns policy')
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    const error = await screen.findByText(/(?:sections|Structured content).*required/i)
    const group = screen.getByRole('group', { name: 'Structured content' })
    expect(group.id).toBeTruthy()
    expect(group.getAttribute('aria-invalid')).toBe('true')
    expect(group.getAttribute('aria-required')).toBe('true')
    const descriptions = group.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(descriptions.some((id) => document.getElementById(id)?.contains(error))).toBe(true)
    expect(submitted).toBe(false)
  })

  it('saves a Policy draft without handwritten notes', async () => {
    let submitted: unknown
    server.use(
      http.get('*/admin/settings/policies', () => HttpResponse.json({ data: [policy] })),
      http.put('*/admin/settings/policies/policy.returns', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: { ...policy, version: 2 } })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['policies.read', 'policies.write']}>
        <MemoryRouter>
          <PoliciesPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    await screen.findByDisplayValue('Returns policy')
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(submitted).toMatchObject({ reason: '', expectedVersion: 1, sections: policy.sections })
    )
  })

  it('reviews exact rendered bytes before exposing separately permitted approval', async () => {
    let submitted: unknown
    let reviewedVersion: string | null = null
    server.use(
      http.get('*/admin/settings/policies', () => HttpResponse.json({ data: [policy] })),
      http.get('*/admin/settings/policies/policy.returns/review', ({ request }) => {
        reviewedVersion = new URL(request.url).searchParams.get('version')
        return HttpResponse.json({
          data: {
            current: policy,
            digest: 'a'.repeat(64),
            previous: null,
            previousRenderedText: null,
            renderedText: 'Returns in 30 days.',
          },
        })
      }),
      http.post('*/admin/settings/policies/policy.returns/approve', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: { ...policy, status: 'approved' } })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['policies.read', 'policies.approve']}>
        <MemoryRouter>
          <PoliciesPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Review policy' }))
    expect(await screen.findByText('Returns in 30 days.')).toBeTruthy()
    expect(reviewedVersion).toBe('1')
    expect(screen.getByText(`Digest: ${'a'.repeat(64)}`)).toBeTruthy()
    expect(screen.getByText('Effective date: 2026-10-01')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Legal reviewed the exact version' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact version' }))
    expect(await screen.findByText('Approve this exact Policy version?')).toBeTruthy()
    expect(submitted).toBeUndefined()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
  })

  it('invalidates a stale review and recovers to the latest version after a conflict', async () => {
    const latest = { ...policy, title: 'Updated returns policy', version: 2 }
    let latestReview = false
    let submitted: unknown
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
      http.post('*/admin/settings/policies/policy.returns/approve', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json(
          { error: { code: 'policy_conflict', message: 'The Policy changed.' } },
          { status: 409 }
        )
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['policies.read', 'policies.approve']}>
        <MemoryRouter>
          <PoliciesPage />
        </MemoryRouter>
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Review policy' }))
    expect(await screen.findByText('Returns in 30 days.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Approve the exact reviewed version' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve exact version' }))
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }))

    expect(await screen.findByText('Review · version 2')).toBeTruthy()
    expect(submitted).toEqual({
      confirm: true,
      expectedVersion: 1,
      reason: 'Approve the exact reviewed version',
    })
    expect(latestReview).toBe(true)
    expect(screen.getByText('Updated returns policy')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Approve exact version' }).hasAttribute('disabled')
    ).toBe(true)
  })
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
