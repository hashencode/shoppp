import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@rstest/core'

const listPlaywrightTests = (env: NodeJS.ProcessEnv) =>
  spawnSync('bun', ['run', 'test:e2e', '--', '--list'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  })

describe('Playwright config', () => {
  it('previews the already-built candidate without invoking a development auth workflow', () => {
    const source = readFileSync('playwright.config.ts', 'utf8')
    expect(source).toContain('bunx rsbuild preview')
    expect(source).not.toContain('E2E_ENV_MODE')
    expect(source).not.toMatch(/dev:(?:test|development|production)/)
  })

  it('discovers the runnable smoke without executing templates', () => {
    const result = listPlaywrightTests(process.env)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('scaffold-smoke.spec.ts')
    expect(result.stdout).not.toContain('templates/new-flow')
  })

  it('keeps live Fashion acceptance serial, headed-capable, and free of retained browser state', () => {
    const source = readFileSync('playwright.fashion-staging.config.ts', 'utf8')
    const liveSpec = readFileSync('e2e/storefront-theme-preview.live.spec.ts', 'utf8')
    expect(source).toContain("testMatch: 'storefront-theme-preview.live.spec.ts'")
    expect(source).toContain('workers: 1')
    expect(source).toContain("FASHION_U8_INTERACTIVE_ACCEPTANCE !== '1'")
    expect(liveSpec).not.toContain('test.skip')
    expect(liveSpec).toContain('FASHION_U8_HUMAN_EVIDENCE_FILE')
    expect(liveSpec).not.toContain("required('FASHION_U8_MISSING_REFERENCE_LABEL')")
    expect(liveSpec).not.toContain("required('FASHION_U8_EDITABLE_HEADING_LABEL')")
    expect(liveSpec).toContain("'fashion-store-home featured-collection'")
    expect(liveSpec).toContain("'fashion-store-home merchandising-title'")
    expect(liveSpec).toContain('waitForResponse')
    expect(liveSpec).toContain('expect(competingSaveResponse.status()).toBe(200)')
    expect(liveSpec).toContain('expect(staleSaveResponse.status()).toBe(409)')
    expect(liveSpec).toContain('toBeVisible({ timeout: 60_000 })')
    expect(source).toContain("trace: 'off'")
    expect(source).toContain("screenshot: 'off'")
    expect(source).toContain("video: 'off'")
    expect(source).not.toContain('storageState')
    expect(source).not.toContain('retries: 1')
  })
})
