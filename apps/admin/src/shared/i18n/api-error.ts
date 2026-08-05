import type { ApiErrorCode } from '../../infrastructure/http/api-client'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { useCallback } from 'react'
import { useCurrentTranslate } from '../contexts/i18n-context'

type Translate = (message: string, values?: Record<string, number | string>) => string

const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  account_activation_conflict: 'This activation link has already been used or changed.',
  account_activation_failed: 'Account activation failed. Please try again.',
  account_activation_invalid: 'This activation link is invalid or expired.',
  admin_auth_not_configured: 'Administrator authentication is not configured.',
  admin_login_required: 'Administrator login is required.',
  admin_login_throttled: 'Too many login attempts. Please try again later.',
  admin_session_invalid: 'Your administrator session is invalid. Please sign in again.',
  current_password_invalid: 'The current password is incorrect.',
  human_password_required: 'A human administrator account is required.',
  identity_not_enabled: 'This administrator account is disabled.',
  invalid_admin_credentials: 'The email or password is incorrect.',
  last_admin_change_denied: 'The last protected administrator cannot be changed.',
  password_change_conflict: 'The password changed concurrently. Please try again.',
  password_reset_token_invalid: 'This password reset link is invalid or expired.',
  protected_admin_password_reset_denied: 'Online reset is disabled for protected administrators.',
  QUERY_TIMEOUT: 'The request timed out. Please try again.',
  QUERY_SERVER_ERROR: 'Request failed. Please try again later.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',
  role_has_dependencies: 'This role is still assigned and cannot be archived.',
  ROUTE_PARAM_INVALID: 'The route parameters are invalid.',
  ROUTE_PARAM_MISSING_ID: 'The route is missing a required record ID.',
  self_role_edit_denied: 'You cannot change your own role assignment.',
  service_credential_invalid: 'The service credential is invalid.',
  stale_role_version: 'This role changed. Refresh and try again.',
  stale_user_version: 'This user changed. Refresh and try again.',
  system_role_archive_denied: 'System roles cannot be archived.',
  UNKNOWN_ERROR: 'Request failed. Please try again later.',
}

export const localizeApiError = (error: unknown, t: Translate) => {
  const normalized = normalizeApiError(error)
  return t(API_ERROR_MESSAGE[normalized.code] ?? API_ERROR_MESSAGE.UNKNOWN_ERROR)
}

export const useLocalizedApiError = () => {
  const translate = useCurrentTranslate()
  return useCallback((error: unknown) => localizeApiError(error, translate), [translate])
}
