import { describe, expect, it } from '@rstest/core'
import type { ApiErrorCode } from '../../infrastructure/http/api-client'
import { translateMessage, type AppLocale } from '../contexts/i18n-context'
import { localizeApiError } from './api-error'

const localizedMessage = (code: ApiErrorCode, locale: AppLocale) =>
  localizeApiError(Object.assign(new Error('raw server message'), { code }), (message, values) =>
    translateMessage(locale, message, values)
  )

describe('localizeApiError', () => {
  it('should explain theme conflict and stale validation while suppressing server prose', () => {
    expect(localizedMessage('storefront_experience_draft_conflict', 'zh-CN')).toBe(
      '店面体验草稿已变更，请重新加载后再保存。'
    )
    expect(localizedMessage('storefront_experience_validation_stale', 'zh-CN')).toBe(
      '请先验证当前草稿版本，再创建快照。'
    )
    expect(localizedMessage('catalog_release_unavailable', 'en-US')).toBe(
      'Select a deployed Catalog Release.'
    )
  })
  it('localizes timeout and server failures without exposing raw messages', () => {
    expect(localizedMessage('QUERY_TIMEOUT', 'en-US')).toBe(
      'The request timed out. Please try again.'
    )
    expect(localizedMessage('QUERY_TIMEOUT', 'zh-CN')).toBe('请求超时，请重试。')
    expect(localizedMessage('QUERY_SERVER_ERROR', 'en-US')).toBe(
      'Request failed. Please try again later.'
    )
    expect(localizedMessage('QUERY_SERVER_ERROR', 'zh-CN')).toBe('请求失败，请稍后重试。')
  })

  it('localizes unknown and not-found failures', () => {
    expect(localizedMessage('UNKNOWN_ERROR', 'en-US')).toBe(
      'Request failed. Please try again later.'
    )
    expect(localizedMessage('UNKNOWN_ERROR', 'zh-CN')).toBe('请求失败，请稍后重试。')
    expect(localizedMessage('RESOURCE_NOT_FOUND', 'zh-CN')).toBe('请求的资源不存在。')
  })
})
