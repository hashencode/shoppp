import { defineConfig, devices } from '@playwright/test'
import { normalizeAppBasePath } from './src/shared/utils/normalize-app-base-path'

const appBasePath = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)

const port = Number(process.env.E2E_PORT || 3417)
const externalBaseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '')
const origin = externalBaseUrl || `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/templates/**', '**/*.live.spec.ts'],
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
        command: `bun run build:test && bunx rsbuild preview --host 127.0.0.1 --port ${port}`,
        env: {
          ...process.env,
          PUBLIC_PREVIEW_ORIGIN:
            process.env.PUBLIC_PREVIEW_ORIGIN || 'https://preview.example.test',
        },
        url: `${origin}${appBasePath}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
