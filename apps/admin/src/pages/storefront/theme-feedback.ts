import { localizeApiError } from '../../shared/i18n/api-error'

export type Translate = (message: string, values?: Record<string, number | string>) => string
export type ThemeMessage = { message: string; values?: Record<string, number | string> }

// Local preconditions retain their message keys; transport prose is never a translation key.
export const localThemeMessages = {
  missingDraft: 'The experience draft ID is missing.',
  missingTheme: 'The exact approved theme package is no longer available.',
  unloadedDraft: 'The exact draft package is not loaded.',
  missingRelease: 'Select a deployed Catalog Release before previewing.',
  missingPreviewOrigin: 'The private preview origin is not configured.',
  stalePreview: 'The deployed preview no longer matches this draft context.',
} as const
export class LocalThemeError extends Error {
  readonly messageKey: (typeof localThemeMessages)[keyof typeof localThemeMessages]
  constructor(messageKey: (typeof localThemeMessages)[keyof typeof localThemeMessages]) {
    super(messageKey)
    this.messageKey = messageKey
  }
}
export const localizeThemeError = (error: unknown, t: Translate) =>
  error instanceof LocalThemeError ? t(error.messageKey) : localizeApiError(error, t)

export const validationStatusMessages: Record<string, string> = {
  valid: 'Valid',
  invalid: 'Invalid',
}

export const validationIssueMessages: Record<string, string> = {
  configuration_schema_mismatch:
    'The draft configuration schema does not match its exact theme package.',
  preset_not_found: 'The selected preset is not declared by the theme package.',
  override_schema_mismatch: 'The override does not match the selected preset schema.',
  duplicate_template_override: 'The template has more than one override.',
  unknown_template_override: 'The override references an unknown template.',
  required_capability_missing: 'The template is missing a required capability.',
  override_invalid: 'The override could not be resolved.',
  resolved_template_invalid: 'The resolved template does not satisfy the theme schema.',
  duplicate_binding_id: 'Resource binding IDs must be unique.',
  duplicate_fixture_binding: 'Fixture bindings must be unique.',
  duplicate_catalog_binding: 'Each catalog reference field may have only one binding.',
  resource_binding_unknown: 'The resource binding references an unknown instance.',
  fixture_binding_missing: 'The visible instance has no fixture binding.',
  catalog_binding_setting_invalid: 'The catalog binding does not match a declared reference field.',
  catalog_reference_missing: 'The catalog reference is missing from the selected Catalog Release.',
  catalog_binding_missing: 'A required catalog reference is missing.',
  content_reference_missing:
    'The content destination is missing from the selected Catalog Release.',
}

export const migrationConflictMessages: Record<string, string> = {
  'instance-removed': 'The target package removed an instance with local overrides.',
  'setting-removed': 'The target package removed a setting with local overrides.',
}

export const previewFailureMessages: Record<string, string> = {
  'preview.build-failed':
    'The private preview build failed. Review the build diagnostics and retry.',
  storefront_preview_build_hook_failed: 'The storefront preview build could not be started.',
  storefront_preview_build_hook_not_configured:
    'The storefront preview build hook is not configured.',
}

export const resourceKindMessages: Record<string, string> = {
  product: 'Product',
  collection: 'Collection',
  page: 'Page',
  policy: 'Policy',
  article: 'Article',
}
export const diagnosticMessages = {
  unknownStatus: 'Unknown validation status ({code}).',
  unknownIssue: 'Unknown theme diagnostic. Review the technical code before continuing.',
  withCode: '{explanation} ({code})',
} as const
export const validationStatusMessage = (status: string, t: Translate) =>
  Object.hasOwn(validationStatusMessages, status)
    ? t(validationStatusMessages[status])
    : t(diagnosticMessages.unknownStatus, { code: status })

export const themeDiagnosticMessage = (
  kind: 'validation' | 'migration' | 'preview',
  code: string,
  t: Translate
) => {
  const messages =
    kind === 'validation'
      ? validationIssueMessages
      : kind === 'migration'
        ? migrationConflictMessages
        : previewFailureMessages
  const explanation = Object.hasOwn(messages, code)
    ? t(messages[code])
    : t(diagnosticMessages.unknownIssue)
  return t(diagnosticMessages.withCode, { explanation, code })
}
