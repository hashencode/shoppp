declare module '*.css'
declare const __ENABLE_TEMPLATE_ROUTES__: boolean

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly PUBLIC_API_BASE?: string
  readonly PUBLIC_APP_BASE?: string
  readonly PUBLIC_PREVIEW_ORIGIN?: string
  readonly PUBLIC_STOREFRONT_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
