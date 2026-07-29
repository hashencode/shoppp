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

- `bun run dev` - start development server
- `bun run dev:development` - start development server with `.env.development`
- `bun run dev:test` - start development server with `.env.test`
- `bun run dev:production` - start development server with `.env.production`
- `bun run build` - typecheck and build production bundle
- `bun run build:development` - build with `.env.development`
- `bun run build:test` - build with `.env.test`
- `bun run build:production` - build with `.env.production`
- `bun run preview` - preview production build
- `bun run preview:development` - preview with `.env.development`
- `bun run preview:test` - preview with `.env.test`
- `bun run preview:production` - preview with `.env.production`
- `bun run test` - run unit tests

## Structure

- `src/routes` - route config, router builder, and provider
- `src/routes/form-route-contract.ts` - form route mode contract utilities
- `src/infrastructure/auth` - role and permission sandbox
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
