import type { ApiErrorCode } from '../../infrastructure/http/api-client'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { useCallback } from 'react'
import { useCurrentTranslate } from '../contexts/i18n-context'

type Translate = (message: string, values?: Record<string, number | string>) => string

const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  fashion_u8_operator_run_canceled: 'The operator acceptance run was canceled.',
  fashion_u8_operator_run_consumed: 'The operator acceptance run has already been consumed.',
  fashion_u8_operator_run_expired: 'The operator acceptance run has expired.',
  fashion_u8_operator_run_rejected: 'The operator acceptance run was rejected.',
  storefront_preview_origin_invalid: 'The request does not match the private preview origin.',
  catalog_release_unavailable: 'Select a deployed Catalog Release.',
  catalog_release_invalid: 'The deployed Catalog Release is invalid.',
  storefront_theme_version_invalid: 'The selected theme package version is not available.',
  storefront_theme_package_invalid: 'The selected theme package is invalid.',
  storefront_theme_incompatible:
    'The selected theme package is incompatible with this platform contract.',
  storefront_theme_preset_invalid: 'The selected preset is not available in this theme package.',
  storefront_experience_draft_conflict:
    'The storefront experience draft changed. Reload it before saving again.',
  storefront_experience_successor_source_invalid:
    'The successor source version is newer than the saved draft.',
  storefront_experience_validation_stale:
    'Validate the current draft version before creating a snapshot.',
  storefront_experience_validation_invalid: 'The validated draft no longer resolves safely.',
  storefront_experience_snapshot_conflict:
    'The immutable storefront experience snapshot could not be reconciled.',
  storefront_experience_migration_unavailable:
    'No configuration migration is available for these schema versions.',
  storefront_experience_migration_target_invalid:
    'The target package and configuration schema versions do not match.',
  storefront_experience_migration_stale:
    'The migration does not belong to the current draft version.',
  storefront_experience_migration_conflicts:
    'Resolve stable-instance migration conflicts before approval.',
  storefront_experience_migration_invalid:
    'The migrated configuration does not satisfy the target package.',
  storefront_experience_migration_conflict: 'The migration successor changed concurrently.',
  storefront_preview_build_input_invalid:
    'The preview build does not match its immutable Catalog input.',
  storefront_preview_build_allocation_conflict:
    'The preview build could not allocate an attempt after concurrent requests.',
  storefront_preview_artifact_unavailable:
    'A current immutable preview artifact is required before issuing access.',
  fashion_u8_operator_run_conflict: 'The operator run changed before approval was recorded.',
  fashion_u8_operator_catalog_release_mismatch:
    'Approval must use the Catalog Release frozen by the operator run.',
  fashion_u8_operator_approval_conflict:
    'The existing operator approval does not match this request.',
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
  invalid_audit_cursor: 'The audit cursor is invalid.',
  last_admin_change_denied: 'The last protected administrator cannot be changed.',
  password_change_conflict: 'The password changed concurrently. Please try again.',
  password_reset_token_invalid: 'This password reset link is invalid or expired.',
  policy_conflict: 'This Policy changed. Reload the latest version and review it again.',
  content_conflict: 'This Content record changed. Reload it before continuing.',
  content_media_invalid: 'Choose media from currently published Catalog products.',
  content_referenced: 'Remove the current storefront references before continuing.',
  content_redirect_required: 'Confirm a redirect from the previous storefront route.',
  content_route_conflict: 'That storefront route is already in use.',
  content_transition_invalid: 'This Content lifecycle action is no longer available.',
  navigation_conflict: 'This Navigation menu changed. Reload it before continuing.',
  navigation_referenced: 'Remove the current storefront references before archiving.',
  navigation_target_unpublished: 'Choose a currently published Navigation target.',
  navigation_transition_invalid: 'This Navigation lifecycle action is no longer available.',
  catalog_candidate_sources_locked:
    'Catalog sources are frozen while a Preview candidate is building. Retry shortly.',
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
