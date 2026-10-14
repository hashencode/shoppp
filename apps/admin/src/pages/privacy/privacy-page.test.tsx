import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { PrivacyPage } from './privacy-page'

void React

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const server = setupServer(
  http.get('*/admin/privacy/requests', () => HttpResponse.json({ data: [] }))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('PrivacyPage', () => {
  it('shows identity verification guidance when recording a request', async () => {
    renderInLocale(
      <AuthTestProvider>
        <ThemeProvider>
          <MemoryRouter>
            <PrivacyPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )

    const heading = screen.getByRole('heading', { level: 4, name: 'Privacy requests' })
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Record verified request' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Record verified request' }))
    const guidance = await screen.findByText(
      "Before proceeding, confirm that the requester's identity has been verified."
    )
    expect(screen.getByRole('dialog').contains(guidance)).toBe(true)
    expect(heading.parentElement?.contains(guidance)).toBe(false)
    expect((await screen.findAllByText('No data')).length).toBeGreaterThan(0)
  })
  it('blocks incomplete correction input then submits the exact verified correction once and reads once', async () => {
    let writes = 0
    let reads = 0
    let payload: unknown
    let idempotencyKey: string | null = null
    let saved = false
    const completed = {
      completedAt: '2026-10-14T03:00:00.000Z',
      createdAt: '2026-10-14T03:00:00.000Z',
      decision: 'retained_immutable_financial_records',
      expiresAt: null,
      id: 'prv_0123456789abcdef0123456789abcdef',
      status: 'completed',
      subjectReference: '012345abcdef',
      type: 'correction',
    }
    server.use(
      http.get('*/admin/privacy/requests', () => {
        reads += 1
        return HttpResponse.json({ data: saved ? [completed] : [] })
      }),
      http.post('*/admin/privacy/requests', async ({ request }) => {
        writes += 1
        payload = await request.json()
        idempotencyKey = request.headers.get('Idempotency-Key')
        saved = true
        return HttpResponse.json({ data: completed })
      })
    )
    renderInLocale(
      <AuthTestProvider>
        <ThemeProvider>
          <MemoryRouter>
            <PrivacyPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await waitFor(() => expect(reads).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Record verified request' }))
    fireEvent.change(screen.getByLabelText('Verified subject email'), {
      target: { value: 'subject@example.test' },
    })
    fireEvent.mouseDown(screen.getByLabelText('Request type'))
    fireEvent.click((await screen.findAllByText('correction')).at(-1)!)
    fireEvent.mouseDown(await screen.findByLabelText('Correction field'))
    fireEvent.click((await screen.findAllByText('email', { exact: true })).at(-1)!)
    fireEvent.change(screen.getByLabelText('Verification and action reason'), {
      target: { value: 'Verified signed correction request' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and execute' }))
    await waitFor(() =>
      expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull()
    )
    expect(writes).toBe(0)
    fireEvent.change(screen.getByLabelText('Requested value'), {
      target: { value: 'updated@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and execute' }))
    expect(await screen.findByText(completed.subjectReference)).toBeTruthy()
    expect(payload).toEqual({
      confirm: true,
      email: 'subject@example.test',
      reason: 'Verified signed correction request',
      type: 'correction',
      correction: { field: 'email', requestedValue: 'updated@example.test' },
    })
    expect(idempotencyKey).toMatch(/^privacy-request-/)
    expect(writes).toBe(1)
    expect(reads).toBe(2)
  })
})
