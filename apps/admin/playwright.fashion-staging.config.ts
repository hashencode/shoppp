import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.FASHION_U8_ADMIN_PORT || 3418)
const origin = `http://127.0.0.1:${port}`

if (process.env.ADMIN_DEVELOPMENT_PROFILE !== 'fashion-staging') {
  throw new Error('ADMIN_DEVELOPMENT_PROFILE must be fashion-staging for live Admin acceptance')
}
if (process.env.FASHION_U8_INTERACTIVE_ACCEPTANCE !== '1') {
  throw new Error('FASHION_U8_INTERACTIVE_ACCEPTANCE must be 1 for live Admin acceptance')
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'storefront-theme-preview.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 20 * 60_000,
  actionTimeout: 60_000,
  reporter: 'list',
  outputDir: 'test-results-fashion-staging',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin,
    headless: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'bun run dev',
    env: { ...process.env, E2E_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${origin}/login`,
  },
})
