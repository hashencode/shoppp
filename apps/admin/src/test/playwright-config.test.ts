import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
    expect(result.stdout).not.toContain('storefront-theme-preview.live.spec.ts')
  })

  it('removes the runner-held interactive acceptance protocol', () => {
    expect(existsSync('playwright.fashion-staging.config.ts')).toBe(false)
    expect(existsSync('e2e/storefront-theme-preview.live.spec.ts')).toBe(false)
    const automatedSpec = readFileSync('e2e/storefront-theme-preview.spec.ts', 'utf8')
    expect(automatedSpec).not.toMatch(/FASHION_U8_(?:INTERACTIVE|HUMAN_EVIDENCE)/)
  })
})
