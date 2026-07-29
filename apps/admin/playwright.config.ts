import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import { normalizeAppBasePath } from './src/shared/utils/normalize-app-base-path'

const supportedModes = new Set(['development', 'test', 'production'])
const envMode = process.env.E2E_ENV_MODE?.trim() || 'test'
if (!supportedModes.has(envMode)) {
  throw new Error('E2E_ENV_MODE 仅支持 development、test 或 production。')
}

const envFile = resolve(process.cwd(), `.env.${envMode}`)
if (existsSync(envFile)) loadEnvFile(envFile)

const appBasePath = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)

const port = Number(process.env.E2E_PORT || 3417)
const externalBaseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '')
const origin = externalBaseUrl || `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/templates/**',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `bun run dev:${envMode} -- --port ${port}`,
        url: `${origin}${appBasePath}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
