import { spawnSync } from 'node:child_process'
import { describe, expect, it } from '@rstest/core'

const listPlaywrightTests = (env: NodeJS.ProcessEnv) =>
  spawnSync('bun', ['run', 'test:e2e', '--', '--list'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  })

describe('Playwright config', () => {
  it('rejects invalid environment modes', () => {
    const result = listPlaywrightTests({ ...process.env, E2E_ENV_MODE: 'invalid' })
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('E2E_ENV_MODE 仅支持')
  })

  it('discovers the runnable smoke without executing templates', () => {
    const result = listPlaywrightTests({ ...process.env, E2E_ENV_MODE: 'test' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('scaffold-smoke.spec.ts')
    expect(result.stdout).not.toContain('templates/new-flow')
  })
})
