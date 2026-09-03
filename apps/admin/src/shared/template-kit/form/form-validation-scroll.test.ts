import { describe, expect, it, rs } from '@rstest/core'
import type { FormInstance } from 'antd'
import {
  FORM_ERROR_SCROLL_OPTIONS,
  isFormValidationError,
  validateFieldsWithScroll,
} from './form-validation-scroll'

type DemoValues = {
  name: string
}

describe('isFormValidationError', () => {
  it('recognizes validation rejections with an errorFields array', () => {
    expect(isFormValidationError({ errorFields: [{ name: ['name'] }] })).toBe(true)
    expect(isFormValidationError({ errorFields: [] })).toBe(true)
  })

  it.each([
    null,
    undefined,
    'failed',
    new Error('failed'),
    {},
    { errorFields: null },
    { errorFields: {} },
  ])('rejects a non-validation error: %s', (error) => {
    expect(isFormValidationError(error)).toBe(false)
  })
})

describe('validateFieldsWithScroll', () => {
  it('returns validated values without scrolling when validation succeeds', async () => {
    const scrollToField = rs.fn()
    const form = {
      scrollToField,
      validateFields: rs.fn(async () => ({ name: '演示' })),
    } as unknown as FormInstance<DemoValues>

    await expect(validateFieldsWithScroll(form)).resolves.toEqual({ name: '演示' })
    expect(scrollToField).not.toHaveBeenCalled()
  })

  it('scrolls to the first invalid field and rethrows the validation error', async () => {
    const error = {
      errorFields: [
        { name: ['institutionIdList'], errors: ['请选择所属基地'] },
        { name: ['name'], errors: ['请输入名称'] },
      ],
    }
    const scrollToField = rs.fn()
    const form = {
      scrollToField,
      validateFields: rs.fn(async () => Promise.reject(error)),
    } as unknown as FormInstance<DemoValues>

    await expect(validateFieldsWithScroll(form)).rejects.toBe(error)
    expect(scrollToField).toHaveBeenCalledWith(['institutionIdList'], FORM_ERROR_SCROLL_OPTIONS)
  })

  it.each([null, undefined, new Error('failed'), { errorFields: null }, { errorFields: [] }])(
    'preserves a rejection without a scrollable field: %s',
    async (error) => {
      const scrollToField = rs.fn()
      const form = {
        scrollToField,
        validateFields: rs.fn(async () => Promise.reject(error)),
      } as unknown as FormInstance<DemoValues>

      await expect(validateFieldsWithScroll(form)).rejects.toBe(error)
      expect(scrollToField).not.toHaveBeenCalled()
    }
  )
})
