import React, { useState } from 'react'
import { App, Button, Form, Input, Modal } from 'antd'
import { cleanup, waitFor } from '@testing-library/react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { CrudFormDrawerRecipe } from './crud-form-drawer-recipe'
import { renderInLocale } from '../../../test/render-in-locale'

void React

afterEach(cleanup)

const Harness = ({
  longForm = false,
  initialName = '',
}: {
  longForm?: boolean
  initialName?: string
}) => {
  const [form] = Form.useForm<{ name: string }>()
  const [closed, setClosed] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [writes, setWrites] = useState(0)
  return (
    <App>
      <output>请求次数：{writes}</output>
      {closed ? (
        <span>抽屉已关闭</span>
      ) : (
        <CrudFormDrawerRecipe
          spec={{
            form,
            title: '浏览器表单',
            successTitle: '保存成功',
            initialValues: { name: initialName },
            parsedMode: { ok: true, mode: 'add' },
            permissionDenied: false,
            detailLoading: false,
            detailError: null,
            saveLoading: false,
            isReadonly: false,
            onRetryDetail: () => undefined,
            onResetAll: () => form.resetFields(),
            hasUnsavedChanges: () => form.getFieldValue('name') !== initialName,
            onSubmit: async () => {
              setWrites((value) => value + 1)
              return { success: true }
            },
            onClose: () => setClosed(true),
            onSaved: async () => undefined,
            nestedModalOpen: nestedOpen,
            renderFields: () => (
              <>
                <Button onClick={() => setNestedOpen(true)}>选择关联记录</Button>
                {longForm ? <div style={{ height: 1800 }} /> : null}
                <Form.Item
                  name="name"
                  label="底部必填项"
                  rules={[{ required: true, message: '请输入底部必填项' }]}
                >
                  <Input />
                </Form.Item>
              </>
            ),
            renderAfterForm: (
              <Modal
                open={nestedOpen}
                title="关联记录"
                footer={null}
                onCancel={() => setNestedOpen(false)}
              >
                可选记录
              </Modal>
            ),
          }}
        />
      )}
    </App>
  )
}

describe('CrudFormDrawerRecipe browser behavior', () => {
  it('scrolls the drawer body to its first invalid field without making a write', async () => {
    renderInLocale(<Harness longForm />, 'zh-CN')
    await expect.element(page.getByRole('dialog', { name: '浏览器表单' })).toBeVisible()
    const body = document.querySelector('.ant-drawer-body') as HTMLElement
    expect(body.scrollTop).toBe(0)
    await page.getByRole('button', { name: /保\s*存/ }).click()
    await expect.element(page.getByText('请输入底部必填项')).toBeVisible()
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(1000), { timeout: 5000 })
    const input = document.querySelector('input') as HTMLElement
    const bounds = body.getBoundingClientRect()
    const fieldBounds = input.getBoundingClientRect()
    expect(fieldBounds.top).toBeGreaterThanOrEqual(bounds.top)
    expect(fieldBounds.bottom).toBeLessThanOrEqual(bounds.bottom)
    expect(document.querySelector('output')?.textContent).toBe('请求次数：0')
    expect(document.querySelector('.ant-alert-error')).toBeNull()
  })

  it('lets the nested Modal consume Escape before the clean outer drawer closes', async () => {
    renderInLocale(<Harness />, 'zh-CN')
    await page.getByRole('button', { name: '选择关联记录' }).click()
    await expect.element(page.getByRole('dialog', { name: '关联记录' })).toBeVisible()
    await page.getByRole('dialog', { name: '关联记录' }).press('Escape')
    await expect.element(page.getByRole('dialog', { name: '关联记录' })).not.toBeVisible()
    await expect.element(page.getByRole('dialog', { name: '浏览器表单' })).toBeVisible()
    await page.getByRole('dialog', { name: '浏览器表单' }).press('Escape')
    await expect.element(page.getByText('抽屉已关闭')).toBeVisible()
  })
  it('renders a 720px desktop drawer with reachable footer and waits for real exit motion', async () => {
    renderInLocale(<Harness initialName="代表性较长的记录名称用于核对完整内容" />, 'zh-CN')
    await expect.element(page.getByRole('dialog', { name: '浏览器表单' })).toBeVisible()
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    const body = document.querySelector('.ant-drawer-body') as HTMLElement
    const footer = document.querySelector('.ant-drawer-footer') as HTMLElement
    await waitFor(() => expect(Math.round(wrapper.getBoundingClientRect().width)).toBe(720))
    expect(window.innerWidth).toBeGreaterThanOrEqual(720)
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
    expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    await page.getByRole('dialog', { name: '浏览器表单' }).press('Escape')
    expect(wrapper.isConnected).toBe(true)
    expect(document.body.textContent).not.toContain('抽屉已关闭')
    await expect.element(page.getByText('抽屉已关闭')).toBeVisible()
    expect(wrapper.isConnected).toBe(false)
  })
})
