import type { NotificationJob } from '@shoppp/contracts'
import { expect, test } from '@playwright/test'
import { mockAdminSession } from './support'

test('operator safely replays an exhausted notification', async ({ page }) => {
  await mockAdminSession(page)
  let job: NotificationJob = {
    attemptCount: 3,
    attempts: [
      {
        attemptNumber: 3,
        completedAt: '2026-07-30T00:03:00.000Z',
        errorCode: 'email_provider_timeout',
        id: 'attempt-e2e-003',
        result: 'exhausted',
        startedAt: '2026-07-30T00:02:59.000Z',
      },
    ],
    createdAt: '2026-07-30T00:00:00.000Z',
    deadLetteredAt: '2026-07-30T00:03:00.000Z',
    id: 'notify-recovery-e2e-001',
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
  let idempotencyKey = ''

  await page.route('**/admin/operations/jobs**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        json: { data: [job], meta: { page: 1, pageSize: 20, total: 1 } },
      })
      return
    }
    replayBody = await request.postDataJSON()
    idempotencyKey = request.headers()['idempotency-key'] ?? ''
    job = {
      ...job,
      deadLetteredAt: null,
      lastErrorCode: null,
      replayCount: 1,
      status: 'pending',
    }
    await route.fulfill({ contentType: 'application/json', json: { data: job } })
  })

  await page.goto('/operations/jobs')
  await expect(page.getByText('notify-recovery-e2e-001')).toBeVisible()
  await page.getByRole('button', { name: 'Replay' }).click()
  await page.getByRole('textbox', { name: 'Reason' }).fill('Email provider configuration corrected')
  await page.getByRole('button', { name: 'Confirm replay' }).click()

  await expect(page.getByText('Notification queued for safe replay.')).toBeVisible()
  await expect(page.getByText('pending')).toBeVisible()
  expect(replayBody).toEqual({
    confirm: true,
    reason: 'Email provider configuration corrected',
  })
  expect(idempotencyKey).toMatch(/^notification-replay-/)
})
