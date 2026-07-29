import { describe, expect, it, rs } from '@rstest/core'
import type { FormInstance } from 'antd'
import { FORM_ERROR_SCROLL_OPTIONS, validateFieldsWithScroll } from './form-validation-scroll'

type DemoValues = {
  name: string
}

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
})
