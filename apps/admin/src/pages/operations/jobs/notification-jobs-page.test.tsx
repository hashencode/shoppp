import type { NotificationJob } from '@shoppp/contracts'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import React from 'react'
import { ThemeProvider } from '../../../shared/contexts/theme-context'
import type { Role } from '../../../shared/types/roles'
import { AuthTestProvider } from '../../../test/auth-context-fixture'
import { NotificationJobsPage } from './notification-jobs-page'

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

const deadLetter: NotificationJob = {
  attemptCount: 3,
  attempts: [
    {
      attemptNumber: 3,
      completedAt: '2026-07-30T00:03:00.000Z',
      errorCode: 'email_provider_timeout',
      id: 'attempt-3',
      result: 'exhausted',
      startedAt: '2026-07-30T00:02:59.000Z',
    },
  ],
  createdAt: '2026-07-30T00:00:00.000Z',
  deadLetteredAt: '2026-07-30T00:03:00.000Z',
  id: 'notify-dead-letter-001',
  kind: 'notification',
  lastErrorCode: 'email_provider_timeout',
  maxAttempts: 3,
  orderReference: 'ORD-NOTIFY001',
  recipient: 's***@example.test',
  replayCount: 0,
  status: 'dead_letter',
  type: 'order_receipt',
  updatedAt: '2026-07-30T00:03:00.000Z',
}

let replayBody: unknown
let replayIdempotencyKey: string | null
const server = setupServer(
  http.get('*/admin/operations/jobs', () =>
    HttpResponse.json({
      data: [deadLetter],
      meta: { page: 1, pageSize: 20, total: 1 },
    })
  ),
  http.post('*/admin/operations/jobs/notify-dead-letter-001/replay', async ({ request }) => {
    replayBody = await request.json()
    replayIdempotencyKey = request.headers.get('Idempotency-Key')
    return HttpResponse.json({
      data: {
        ...deadLetter,
        deadLetteredAt: null,
        lastErrorCode: null,
        replayCount: 1,
        status: 'pending',
      },
    })
  })
)

const renderPage = (role: Role) =>
  render(
    <AuthTestProvider role={role}>
      <ThemeProvider>
        <NotificationJobsPage />
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  replayBody = undefined
  replayIdempotencyKey = null
  server.resetHandlers()
})
afterAll(() => server.close())

describe('NotificationJobsPage', () => {
  it('shows masked recovery facts and hides replay from viewers', async () => {
    renderPage('viewer')

    await waitFor(() => expect(screen.getByText('notify-dead-letter-001')).toBeTruthy())
    expect(screen.getByText('s***@example.test')).toBeTruthy()
    expect(screen.getByText('email_provider_timeout')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
  })

  it('requires a reason and explicit confirmation for safe replay', async () => {
    renderPage('editor')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(
      screen.getByText(
        'Replay keeps the original provider idempotency identity and is fully audited.'
      )
    ).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Provider configuration corrected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replay' }))

    await waitFor(() =>
      expect(replayBody).toEqual({
        confirm: true,
        reason: 'Provider configuration corrected',
      })
    )
    expect(replayIdempotencyKey).toMatch(/^notification-replay-/)
    await waitFor(() => expect(screen.getByText('pending')).toBeTruthy())
  })
})
