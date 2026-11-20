import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { defineConfig } from '@rstest/core'
import { rspack } from '@rsbuild/core'

const pdfCmaps = resolve(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'cmaps'
)

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
  tools: {
    rspack: {
      resolve: {
        alias: {
          'pdfjs-dist$': createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs'),
        },
      },
      plugins: [
        new rspack.CopyRspackPlugin({
          patterns: [{ from: pdfCmaps, to: 'static/pdf-cmaps' }],
        }),
      ],
    },
  },
})
