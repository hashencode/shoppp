import { defineConfig } from '@rstest/core'

export default defineConfig({
  include: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
  browser: {
    enabled: true,
    provider: 'playwright',
    browser: 'chromium',
    headless: true,
  },
  globals: true,
  source: {
    tsconfigPath: './tsconfig.app.json',
  },
})
