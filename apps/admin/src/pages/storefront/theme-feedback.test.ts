import { describe, expect, it } from '@rstest/core'
import { translateMessage } from '../../shared/contexts/i18n-context'
import {
  LocalThemeError,
  localThemeMessages,
  localizeThemeError,
  themeDiagnosticMessage,
  validationStatusMessage,
  validationIssueMessages,
  migrationConflictMessages,
  previewFailureMessages,
} from './theme-feedback'

const zh = (key: string, values?: Record<string, number | string>) =>
  translateMessage('zh-CN', key, values)
const en = (key: string, values?: Record<string, number | string>) =>
  translateMessage('en-US', key, values)

describe('theme feedback', () => {
  it('should retain every local precondition and retranslate without exposing unknown prose', () => {
    for (const key of Object.values(localThemeMessages)) {
      const error = new LocalThemeError(key)
      expect(localizeThemeError(error, en)).toBe(key)
      expect(localizeThemeError(error, zh)).toBe(zh(key))
      expect(localizeThemeError(error, zh)).not.toBe('请求失败，请稍后重试。')
    }
    expect(localizeThemeError(new Error('private server sentence'), zh)).toBe(
      '请求失败，请稍后重试。'
    )
  })
  it('should explain all known validation, migration and preview codes and retain technical codes', () => {
    for (const [kind, catalog] of [
      ['validation', validationIssueMessages],
      ['migration', migrationConflictMessages],
      ['preview', previewFailureMessages],
    ] as const) {
      for (const [code, key] of Object.entries(catalog)) {
        expect(themeDiagnosticMessage(kind, code, zh)).toContain(zh(key))
        expect(themeDiagnosticMessage(kind, code, zh)).toContain(code)
        expect(themeDiagnosticMessage(kind, code, en)).toContain(key)
      }
      expect(themeDiagnosticMessage(kind, 'future-code', zh)).toBe(
        '未知主题诊断，请检查技术代码后再继续。（future-code）'
      )
    }
  })
  it('should never describe an unknown validation status as success', () => {
    expect(validationStatusMessage('valid', zh)).toBe('有效')
    expect(validationStatusMessage('invalid', zh)).toBe('无效')
    expect(validationStatusMessage('future-state', zh)).toBe('未知验证状态（future-state）。')
  })
})
