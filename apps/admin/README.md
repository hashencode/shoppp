# Codex Admin Quick Start

A reusable admin template built with React, TypeScript, Ant Design v6, Tailwind CSS, ESLint, and Prettier.

## Stack

- React 19
- TypeScript
- Ant Design v6
- Tailwind CSS
- Rsbuild (bundler)
- RSTest + Testing Library

## Scripts (Bun)

- `bun run dev` / `bun run dev:test` - load the repository `.env`, run the fail-closed preflight, local Rsbuild server, and named Cloudflare Tunnel against the test API and test D1 only
- `bun run build` - typecheck and build production bundle
- `bun run build:test` - build with `.env.test`
- `bun run build:production` - build with `.env.production`
- `bun run test` - run unit tests
- `bun run test:browser` - run real-browser component tests
- `bun run test:e2e` - run Playwright end-to-end tests

## Structure

- `src/routes` - route config, router builder, and provider
- `src/routes/form-route-contract.ts` - form route mode contract utilities
- `src/infrastructure/auth` - authoritative password session and permission guards
- `src/infrastructure/http` - shared HTTP client and error normalization
- `src/infrastructure/msw` - dev-only MSW bootstrap and handlers (`/dev` routes only)
- `src/pages/home/*` - public pages
- `src/pages/templates/*` - template pages and feature API modules
- `src/shared/layout` - admin shell layout
- `src/shared/contexts` - global cross-page runtime contexts (for example theme mode)
- `src/shared/components/upload-form-item.tsx` - shared form-field upload control; business projects inject upload APIs through adapters
- `src/shared/hooks` - reusable React hooks (for example table pagination behavior)
- `src/shared/utils` - focused pure helpers (for example display name normalization)

## Notes

- No Ant Design Pro is used.
- Routing, permissions, and menu are driven by typed route contracts.
- Theme mode supports `light` / `dark` / `system`; avoid hardcoded light-only background colors in new UI code.
- Form upload fields should reuse `UploadFormItem`; keep API paths, headers, and response parsing inside a business adapter. Upload help text belongs in `tooltip`, not Ant Design `Form.Item extra`, so spacing stays consistent with the upload card.

Example adapter boundary:

```tsx
import { Form } from 'antd'
import type { FormItemProps } from 'antd'
import React from 'react'
import { UploadFormItem } from '../components/upload-form-item'

void React

type BusinessUploadFormItemProps<TValues extends object> = Omit<FormItemProps<TValues>, 'children'> & {
  readonly?: boolean
}

const uploadBusinessFile = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  // Call the business HTTP client here and return the uploaded file URL.
  return String(formData.get('file') instanceof File ? '/uploads/example.png' : '')
}

export const BusinessUploadFormItem = <TValues extends object>({
  extra,
  readonly,
  ...formItemProps
}: BusinessUploadFormItemProps<TValues>) => (
  <Form.Item<TValues> {...formItemProps}>
    <UploadFormItem readonly={readonly} tooltip={extra} uploadFile={uploadBusinessFile} />
  </Form.Item>
)
```

## AI Documentation Pack

- Index: `docs/ai/README.md`
- Business routing map: `docs/ai/business-map.yaml`
- Component catalog: `docs/ai/component-catalog.yaml`
- Page recipes: `docs/ai/page-recipes.yaml`
- Rules: `docs/ai/ai-rules.md`
