import { defineConfig } from '@rstest/core'

export default defineConfig({
  include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  exclude: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
  testEnvironment: 'jsdom',
  setupFiles: ['./rstest.setup.ts'],
  globals: true,
  source: {
    tsconfigPath: './tsconfig.app.json',
  },
})
