import { Modal } from 'antd'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { buildStandardModalProps } from './standard-modal-rules'

void React

afterEach(() => {
  cleanup()
})

describe('standard modal rules browser rendering', () => {
  it('should move wide modals upward in the real browser', async () => {
    render(
      <Modal open title="宽弹窗" footer={null} {...buildStandardModalProps(1000)}>
        内容
      </Modal>
    )

    await expect.element(page.getByRole('dialog')).toBeVisible()
    expect(document.querySelector<HTMLElement>('.ant-modal')?.style.top).toBe('24px')
  })

  it('should preserve the default position below the width threshold', async () => {
    render(
      <Modal open title="窄弹窗" footer={null} {...buildStandardModalProps(999)}>
        内容
      </Modal>
    )

    await expect.element(page.getByRole('dialog')).toBeVisible()
    expect(document.querySelector<HTMLElement>('.ant-modal')?.style.top).toBe('')
  })
})
