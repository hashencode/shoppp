import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the bounded human U8 lane`)
  return value
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('completes the real invalid-reference, conflict, preview-return, and approval path', async ({
  context,
  page,
}, testInfo) => {
  const runStartedAt = Date.now()

  const manifestPath = required('FASHION_U8_RUN_MANIFEST_FILE')
  const manifestBytes = await readFile(manifestPath)
  const manifest = JSON.parse(manifestBytes.toString()) as Record<string, unknown>
  const manifestDigest = createHash('sha256').update(manifestBytes).digest('hex')
  expect(manifestDigest).toBe(required('FASHION_U8_RUN_MANIFEST_DIGEST'))
  expect(manifest.themeId).toBe('fashion-store')
  expect(manifest.runId).toBe(required('FASHION_U8_RUN_ID'))

  const sourceDraftId = required('FASHION_U8_SOURCE_DRAFT_ID')
  const catalogReleaseId = required('FASHION_U8_CATALOG_RELEASE_ID')
  expect(manifest.catalogReleaseId).toBe(catalogReleaseId)
  expect(manifest.sourceDraftId).toBe(sourceDraftId)
  const missingReferenceLabel = required('FASHION_U8_MISSING_REFERENCE_LABEL')
  const replacementReferenceName = required('FASHION_U8_REPLACEMENT_REFERENCE_NAME')
  const editableHeadingLabel = required('FASHION_U8_EDITABLE_HEADING_LABEL')
  const reason = `Fashion U8 ${manifest.runId} ${manifestDigest}`

  await page.goto('/login')
  expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:/)
  await expect(page.getByText('Sign in to Shoppp Admin', { exact: true })).toBeVisible()
  expect(process.env.TEST_API_ORIGIN).toContain('shoppp-api-fashion-staging')
  expect(process.env.TEST_API_ORIGIN).not.toMatch(/production/)

  // The operator enters the single-use bootstrap credential directly into this headed browser.
  // It never enters Playwright configuration, argv, environment variables, storage state, or evidence.
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 5 * 60_000 })
  await page.goto(`/storefront/themes/${sourceDraftId}`)
  await expect(page.getByRole('combobox', { name: 'Catalog Release' })).toContainText(
    catalogReleaseId,
  )
  await page.getByRole('textbox', { name: 'Change reason' }).fill(reason)

  const missingReference = page.getByRole('group', { name: missingReferenceLabel })
  const missingReferenceTarget = await missingReference.evaluate(
    (element) => element.parentElement?.id,
  )
  expect(missingReferenceTarget).toMatch(/^experience-field-/)
  await expect(
    missingReference.getByText('The selected reference is missing from the current release.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save and preview' }).click()
  const validationSummary = page.locator('[aria-labelledby="experience-validation-summary-heading"]')
  await expect(validationSummary).toBeFocused()
  const affectedFieldLink = validationSummary.locator(`a[href="#${missingReferenceTarget}"]`)
  const affectedFieldTarget = await affectedFieldLink.getAttribute('href')
  expect(affectedFieldTarget).toMatch(/^#experience-field-/)
  await affectedFieldLink.click()
  await expect(page.locator(affectedFieldTarget!)).toBeFocused()

  const replacementPicker = missingReference.getByRole('combobox', { name: missingReferenceLabel })
  await replacementPicker.click()
  await page
    .getByRole('option', { name: new RegExp(escapeRegExp(replacementReferenceName), 'i') })
    .click()
  await expect(replacementPicker).toBeFocused()
  await expect(missingReference).not.toContainText(
    'The selected reference is missing from the current release.',
  )
  await expect(page.locator('[aria-live="polite"]')).toContainText(
    'Reference changed. Validation is required again.',
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  const stalePage = await context.newPage()
  await stalePage.goto(page.url())
  await expect(stalePage.getByRole('textbox', { name: editableHeadingLabel })).toBeVisible()
  await stalePage.getByRole('textbox', { name: 'Change reason' }).fill(reason)

  await page
    .getByRole('textbox', { name: editableHeadingLabel })
    .fill(`Competing U8 edit ${manifest.runId}`)
  await page.getByRole('button', { name: 'Save' }).click()
  await stalePage
    .getByRole('textbox', { name: editableHeadingLabel })
    .fill(`Accepted U8 successor ${manifest.runId}`)
  await stalePage.getByRole('button', { name: 'Save' }).click()
  await expect(
    stalePage.getByText('The saved draft changed while local edits were open'),
  ).toBeVisible()
  await expect(stalePage.getByRole('button', { name: 'Keep local edits' })).toBeFocused()
  await stalePage.getByRole('button', { name: 'Save local edits as successor' }).click()
  await expect(stalePage.locator('[aria-live="polite"]')).toContainText(
    'Local edits were saved as successor draft',
  )
  const successorDraftId = new URL(stalePage.url()).pathname.split('/').at(-1)
  expect(successorDraftId).toBeTruthy()
  expect(successorDraftId).not.toBe(sourceDraftId)

  await stalePage.getByRole('button', { name: 'Save and preview' }).click()
  await expect(stalePage.getByText('Ready', { exact: true })).toBeVisible({ timeout: 10 * 60_000 })
  const buildId = (await stalePage.getByText(/^preview-build-/).first().textContent())?.trim()
  expect(buildId).toBeTruthy()
  await expect(stalePage.getByText(catalogReleaseId, { exact: true })).toBeVisible()

  const popupPromise = context.waitForEvent('page')
  await stalePage.getByRole('button', { name: 'Open authenticated preview' }).click()
  const preview = await popupPromise
  await expect(preview.getByRole('complementary', { name: 'Private preview context' })).toContainText(
    catalogReleaseId,
  )
  await preview.getByRole('link', { name: 'Return to editor' }).click()
  await expect(preview.getByRole('button', { name: 'Open authenticated preview' })).toBeFocused({
    timeout: 60_000,
  })
  await expect(preview.locator('[aria-live="polite"]')).toContainText(
    'Returned from private preview.',
  )

  await stalePage.getByRole('textbox', { name: 'Approval reason' }).fill(reason)
  const approvalResponsePromise = stalePage.waitForResponse(
    (response) => response.url().endsWith('/approve') && response.request().method() === 'POST',
  )
  await stalePage.getByRole('button', { name: /^Approve exact draft v\d+$/ }).click()
  const approvalResponse = await approvalResponsePromise
  expect(approvalResponse.ok()).toBe(true)
  const approval = (await approvalResponse.json()) as { data: { contentDigest: string; id: string } }
  await expect(stalePage.getByText(new RegExp(escapeRegExp(approval.data.id)))).toBeVisible()

  const voiceOverPath = required('FASHION_U8_VOICEOVER_RECORD_FILE')
  await expect
    .poll(
      async () => {
        try {
          const candidate = JSON.parse(await readFile(voiceOverPath, 'utf8')) as {
            checkpoints?: unknown[]
          }
          return candidate.checkpoints?.length ?? 0
        } catch {
          return 0
        }
      },
      { timeout: 5 * 60_000 },
    )
    .toBeGreaterThanOrEqual(6)
  const voiceOver = JSON.parse(await readFile(voiceOverPath, 'utf8')) as Record<string, unknown>
  expect(voiceOver).toMatchObject({
    buildId,
    harnessSha: manifest.harnessSha,
    runId: manifest.runId,
    successorSnapshotId: approval.data.id,
  })
  expect(Array.isArray(voiceOver.checkpoints)).toBe(true)
  const checkpoints = voiceOver.checkpoints as Array<Record<string, unknown>>
  const requiredCheckpoints = [
    'validation-summary',
    'missing-reference-replacement',
    'conflict-recovery',
    'preview-readiness',
    'preview-return',
    'approval-result',
  ]
  expect(new Set(checkpoints.map(({ name }) => name))).toEqual(new Set(requiredCheckpoints))
  for (const checkpoint of checkpoints) {
    expect(checkpoint.expected).toEqual(expect.any(String))
    expect(checkpoint.observed).toEqual(expect.any(String))
    expect(checkpoint.status).toBe('passed')
    const observedAt = Date.parse(String(checkpoint.observedAt))
    expect(new Date(observedAt).toISOString()).toBe(checkpoint.observedAt)
    expect(observedAt).toBeGreaterThanOrEqual(runStartedAt)
    expect(observedAt).toBeLessThanOrEqual(Date.now())
  }
  expect((await stat(voiceOverPath)).mtimeMs).toBeGreaterThanOrEqual(runStartedAt)
  expect(JSON.stringify(voiceOver)).not.toMatch(
    /authorization|bearer|cart.?token|cookie|grant|password|session|storage.?state/i,
  )

  const humanEvidence = {
        approvalAuditId: `audit-${approval.data.id}`,
        buildId,
        candidateSha: manifest.candidateSha,
        catalogReleaseId,
        harnessSha: manifest.harnessSha,
        manifestDigest,
        runId: manifest.runId,
        sourceDraftId,
        successorContentDigest: approval.data.contentDigest,
        successorDraftId,
        successorSnapshotId: approval.data.id,
        voiceOver,
      }
  const humanEvidenceBytes = Buffer.from(JSON.stringify(humanEvidence))
  await writeFile(required('FASHION_U8_HUMAN_EVIDENCE_FILE'), humanEvidenceBytes, { flag: 'wx' })
  await testInfo.attach('fashion-u8-human-evidence.json', {
    body: humanEvidenceBytes,
    contentType: 'application/json',
  })
})
