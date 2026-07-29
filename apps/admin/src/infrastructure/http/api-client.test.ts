import { describe, expect, it } from '@rstest/core'
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import {
  apiClient,
  EXPORT_REQUEST_TIMEOUT_MS,
  normalizeApiError,
  resolveApiBaseUrl,
  UPLOAD_REQUEST_TIMEOUT_MS,
  type ApiErrorCode,
} from './api-client'

describe('request timeout policy', () => {
  it('uses 30 seconds for regular requests and no timeout for exports', () => {
    expect(apiClient.defaults.timeout).toBe(30_000)
    expect(EXPORT_REQUEST_TIMEOUT_MS).toBe(0)
    expect(UPLOAD_REQUEST_TIMEOUT_MS).toBe(0)
  })

  it('uses no timeout for FormData uploads without changing regular requests', async () => {
    const createAdapter = () => async (config: InternalAxiosRequestConfig) => ({
      data: null,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    const formData = new FormData()
    formData.append('file', new File(['content'], 'example.txt'))

    const uploadResponse = await apiClient.request({
      url: '/upload',
      method: 'POST',
      data: formData,
      adapter: createAdapter(),
    })
    const regularResponse = await apiClient.request({
      url: '/save',
      method: 'POST',
      data: { name: 'example' },
      adapter: createAdapter(),
    })

    expect(uploadResponse.config.timeout).toBe(0)
    expect(regularResponse.config.timeout).toBe(30_000)
  })
})

type ErrorBody = {
  message?: string
  errorCode?: ApiErrorCode
}

const createAxiosError = ({
  message = 'request failed',
  code,
  status,
  data,
}: {
  message?: string
  code?: string
  status?: number
  data?: ErrorBody
}) => {
  const config = {
    url: '/api/mock',
    headers: new AxiosHeaders(),
  } as InternalAxiosRequestConfig
  const response =
    status === undefined
      ? undefined
      : ({
          status,
          statusText: String(status),
          headers: {},
          config,
          data: data ?? {},
        } as AxiosResponse<ErrorBody>)

  return new AxiosError<ErrorBody>(message, code, config, undefined, response)
}

describe('normalizeApiError', () => {
  it('maps axios timeout to QUERY_TIMEOUT with status', () => {
    const normalized = normalizeApiError(
      createAxiosError({
        code: 'ECONNABORTED',
        status: 504,
        data: { message: '请求超时' },
      })
    )

    expect(normalized.code).toBe('QUERY_TIMEOUT')
    expect(normalized.status).toBe(504)
    expect(normalized.message).toBe('请求超时')
  })

  it('maps 404 response to RESOURCE_NOT_FOUND', () => {
    const normalized = normalizeApiError(
      createAxiosError({
        status: 404,
        data: { message: '记录不存在', errorCode: 'ROUTE_PARAM_INVALID' },
      })
    )

    expect(normalized.code).toBe('RESOURCE_NOT_FOUND')
    expect(normalized.status).toBe(404)
    expect(normalized.message).toBe('记录不存在')
  })

  it('maps 5xx response to QUERY_SERVER_ERROR', () => {
    const normalized = normalizeApiError(
      createAxiosError({
        status: 500,
        data: { message: '服务异常' },
      })
    )

    expect(normalized.code).toBe('QUERY_SERVER_ERROR')
    expect(normalized.status).toBe(500)
    expect(normalized.message).toBe('服务异常')
  })

  it('uses business errorCode for non-404/5xx responses', () => {
    const normalized = normalizeApiError(
      createAxiosError({
        status: 400,
        data: {
          message: '参数非法',
          errorCode: 'ROUTE_PARAM_INVALID',
        },
      })
    )

    expect(normalized.code).toBe('ROUTE_PARAM_INVALID')
    expect(normalized.status).toBe(400)
    expect(normalized.message).toBe('参数非法')
  })

  it('falls back to UNKNOWN_ERROR for non-axios errors', () => {
    const normalized = normalizeApiError(new Error('unexpected'))

    expect(normalized.code).toBe('UNKNOWN_ERROR')
    expect(normalized.status).toBeUndefined()
    expect(normalized.message).toBe('请求失败，请稍后重试。')
  })
})

describe('resolveApiBaseUrl', () => {
  it('should use configured api base when provided', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe('https://api.example.com')
  })

  it('should fallback to the environment-isolated same-origin API gateway', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api')
  })
})
