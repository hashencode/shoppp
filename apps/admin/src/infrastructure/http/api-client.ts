import axios, { AxiosError } from 'axios'
import { adminAuthErrorCodeSchema, type AdminAuthErrorCode } from '@shoppp/contracts'

const NO_REQUEST_TIMEOUT_MS = 0

export const EXPORT_REQUEST_TIMEOUT_MS = NO_REQUEST_TIMEOUT_MS
export const UPLOAD_REQUEST_TIMEOUT_MS = NO_REQUEST_TIMEOUT_MS

const LOCAL_API_ERROR_CODES = [
  'last_admin_change_denied',
  'role_has_dependencies',
  'self_role_edit_denied',
  'stale_role_version',
  'stale_user_version',
  'system_role_archive_denied',
  'QUERY_TIMEOUT',
  'QUERY_SERVER_ERROR',
  'RESOURCE_NOT_FOUND',
  'ROUTE_PARAM_INVALID',
  'ROUTE_PARAM_MISSING_ID',
  'UNKNOWN_ERROR',
] as const

type LocalApiErrorCode = (typeof LOCAL_API_ERROR_CODES)[number]
export type ApiErrorCode = AdminAuthErrorCode | LocalApiErrorCode

function isLocalApiErrorCode(value: unknown): value is LocalApiErrorCode {
  return typeof value === 'string' && LOCAL_API_ERROR_CODES.some((candidate) => candidate === value)
}

function parseApiErrorCode(value: unknown): ApiErrorCode | undefined {
  const authCode = adminAuthErrorCodeSchema.safeParse(value)
  if (authCode.success) return authCode.data
  if (isLocalApiErrorCode(value)) return value
  return undefined
}

export type ApiError = Error & {
  code: ApiErrorCode
  details?: unknown
  status?: number
  cause?: unknown
}

export const resolveApiBaseUrl = (apiBase?: string): string => {
  return apiBase || '/api'
}

export const normalizeApiError = (error: unknown): ApiError => {
  if (
    error instanceof Error &&
    !axios.isAxiosError(error) &&
    'code' in error &&
    parseApiErrorCode(error.code)
  ) {
    return error as ApiError
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string
      errorCode?: ApiErrorCode
      error?: { code?: string; details?: unknown; message?: string }
    }>
    const status = axiosError.response?.status
    const message =
      axiosError.response?.data?.error?.message ??
      axiosError.response?.data?.message ??
      axiosError.message ??
      '请求失败，请稍后重试。'

    const details = axiosError.response?.data?.error?.details

    if (axiosError.code === 'ECONNABORTED') {
      return Object.assign(new Error(message), {
        code: 'QUERY_TIMEOUT' as const,
        status,
        details,
        cause: error,
      })
    }

    if (status === 404) {
      return Object.assign(new Error(message), {
        code: 'RESOURCE_NOT_FOUND' as const,
        status,
        details,
        cause: error,
      })
    }

    if (status && status >= 500) {
      return Object.assign(new Error(message), {
        code: 'QUERY_SERVER_ERROR' as const,
        status,
        details,
        cause: error,
      })
    }

    const errorCode = parseApiErrorCode(
      axiosError.response?.data?.errorCode ?? axiosError.response?.data?.error?.code
    )
    if (errorCode) {
      return Object.assign(new Error(message), {
        code: errorCode,
        details,
        status,
        cause: error,
      })
    }

    return Object.assign(new Error(message), {
      code: 'UNKNOWN_ERROR' as const,
      status,
      details,
      cause: error,
    })
  }

  if (error instanceof Error && 'code' in error) {
    return Object.assign(new Error(error.message), {
      code: 'UNKNOWN_ERROR' as const,
      status: (error as Error & { status?: number }).status,
      cause: error,
    })
  }

  return Object.assign(new Error('请求失败，请稍后重试。'), {
    code: 'UNKNOWN_ERROR' as const,
    cause: error,
  })
}

export const apiClient = axios.create({
  // Production uses the environment-isolated same-origin Worker service binding.
  baseURL: resolveApiBaseUrl(import.meta.env.PUBLIC_API_BASE),
  timeout: 30_000,
})

apiClient.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.timeout = UPLOAD_REQUEST_TIMEOUT_MS
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(normalizeApiError(error))
  }
)
