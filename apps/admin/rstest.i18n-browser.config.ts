import { defineConfig } from '@rstest/core'

// Separate contexts are separate runs: the browser runner shares provider options.
const narrow = process.env.ADMIN_I18N_BROWSER_PROFILE === 'narrow'

export default defineConfig({
  include: [
    'src/pages/storefront/theme-editor-page.browser.test.tsx',
    'src/pages/iam/iam-pages.browser.test.tsx',
    'src/pages/orders/order-detail.browser.test.tsx',
    'src/pages/reports/order-report-page.browser.test.tsx',
  ],
  browser: {
    enabled: true,
    provider: 'playwright',
    browser: 'chromium',
    headless: true,
    viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    providerOptions: {
      context: {
        locale: narrow ? 'zh-CN' : 'en-US',
        timezoneId: narrow ? 'UTC' : 'Asia/Shanghai',
      },
    },
  },
  testTimeout: 20_000,
  globals: true,
  source: {
    tsconfigPath: './tsconfig.app.json',
    define: {
      'process.env.ADMIN_I18N_BROWSER_PROFILE': JSON.stringify(narrow ? 'narrow' : 'desktop'),
    },
  },
})
