import { describe, expect, it, rs } from '@rstest/core'
import { createFormSaveSuccessModalConfig } from './form-save-success-modal'

describe('createFormSaveSuccessModalConfig', () => {
  it('keeps close on the page and runs navigation only from confirm', () => {
    const onConfirm = rs.fn()
    const config = createFormSaveSuccessModalConfig({
      content: '保存成功',
      onConfirm,
    })

    expect(config).toMatchObject({
      title: '提示',
      content: '保存成功',
      closable: true,
      okText: '确定',
      onOk: onConfirm,
    })
    expect(config.footer).toBeUndefined()
    expect(config.onCancel).toBeUndefined()
  })
})
