import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { Form, Input } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { getFormModeViewModel } from '../../../routes/form-route-contract'
import { BasicCrudFormRecipe } from './basic-crud-form-recipe'
import type { BasicCrudFormSpec } from '../specs/basic-crud-form-spec'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

type DemoValues = {
  name: string
}

const createBaseSpec = (form: ReturnType<typeof Form.useForm<DemoValues>>[0]): BasicCrudFormSpec<DemoValues> => ({
  parsedMode: { ok: true, mode: 'modify', resourceKey: '7' },
  modeView: getFormModeViewModel('modify'),
  permissionDenied: false,
  detailLoading: false,
  detailError: null,
  saveLoading: false,
  isReadonly: false,
  form,
  initialValues: { name: 'demo' },
  title: '编辑演示',
  stateCopy: {
    submitBlockedMessage: '查看模式不允许提交。',
    submitSuccessMessage: '保存成功！',
  },
  onBackToList: () => undefined,
  onRetryDetail: () => undefined,
  onResetAll: () => undefined,
  onSubmit: async () => undefined,
  renderFields: () => (
    <Form.Item label="名称" name="name">
      <Input placeholder="请输入名称" />
    </Form.Item>
  ),
})

describe('BasicCrudFormRecipe', () => {
  it('uses compact content width and shared alignment class by default', () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()

      return <BasicCrudFormRecipe spec={createBaseSpec(form)} />
    }

    const { container } = render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    expect(container.querySelector('form')?.className).toContain('max-w-[800px]')
    expect(container.querySelector('form')?.className).toContain('admin-form-content-align')
  })

  it('renders independently sized section cards with one submit toolbar', () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const spec: BasicCrudFormSpec<DemoValues> = {
        ...createBaseSpec(form),
        renderFields: undefined,
        sections: [
          {
            key: 'base',
            title: '基础信息',
            renderFields: () => (
              <Form.Item label="名称" name="name">
                <Input placeholder="请输入名称" />
              </Form.Item>
            ),
          },
          {
            key: 'extra',
            title: '扩展信息',
            contentWidthPreset: 'wide',
            renderFields: () => <div>扩展字段</div>,
          },
        ],
      }

      return <BasicCrudFormRecipe spec={spec} />
    }

    const { container } = render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    const cardBodies = container.querySelectorAll('.ant-card-body')
    expect(screen.getByText('基础信息')).toBeTruthy()
    expect(screen.getByText('扩展信息')).toBeTruthy()
    expect(cardBodies[0]?.className).toContain('max-w-[800px]')
    expect(cardBodies[1]?.className).toContain('max-w-[1200px]')
    expect(screen.getAllByRole('button', { name: /保\s*存/ })).toHaveLength(1)
  })

  it('shows route param error when parsed mode is invalid', async () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const spec: BasicCrudFormSpec<DemoValues> = {
        ...createBaseSpec(form),
        parsedMode: { ok: false, errorCode: 'ROUTE_PARAM_INVALID', message: 'bad mode' },
        modeView: null,
        title: '演示表单',
      }

      return <BasicCrudFormRecipe spec={spec} />
    }

    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('路由参数错误')).toBeTruthy()
    })
    expect(screen.getByText('bad mode')).toBeTruthy()
  })

  it('hides actions without rendering a readonly notice in readonly mode', () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const spec: BasicCrudFormSpec<DemoValues> = {
        ...createBaseSpec(form),
        parsedMode: { ok: true, mode: 'readonly', resourceKey: '7' },
        modeView: getFormModeViewModel('readonly'),
        isReadonly: true,
        title: '查看演示',
      }

      return <BasicCrudFormRecipe spec={spec} />
    }

    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    expect(screen.queryByText('当前为查看模式，表单内容仅可查看，不可编辑或保存。')).toBeNull()
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(screen.getByPlaceholderText('请输入名称')).toBeTruthy()
  })

  it('calls resetAll from the unified reset action', async () => {
    let resetCount = 0

    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const spec: BasicCrudFormSpec<DemoValues> = {
        ...createBaseSpec(form),
        onResetAll: () => {
          resetCount += 1
        },
      }

      return <BasicCrudFormRecipe spec={spec} />
    }

    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /重\s*置/ }))
    fireEvent.click(await screen.findByRole('button', { name: /确\s*认/ }))
    expect(resetCount).toBe(1)
  })

  it('focuses the first invalid field when submit validation fails', async () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const spec: BasicCrudFormSpec<DemoValues> = {
        ...createBaseSpec(form),
        initialValues: { name: '' },
        renderFields: () => (
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入名称" />
          </Form.Item>
        ),
      }

      return <BasicCrudFormRecipe spec={spec} />
    }

    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))

    expect(await screen.findByText('请输入名称')).toBeTruthy()
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByPlaceholderText('请输入名称'))
    })
  })
})
