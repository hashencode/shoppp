import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { Button, Form } from 'antd'
import type { TemplateListFilterField } from './template-list-filter-form'
import {
  DEFAULT_TEMPLATE_LIST_FILTER_ROW_GUTTER,
  resolveSelectPopupMatchWidthByOptions,
  TemplateListFilterForm,
} from './template-list-filter-form'

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
  name?: string
  status?: number
  sort?: number
  updatedAt?: string
  statusDetail?: string
}

const baseLayoutProps = {
  fieldColProps: { span: 8 },
  actionsColProps: { span: 8 },
}

describe('TemplateListFilterForm', () => {
  it('uses the shared responsive row gutter defaults', () => {
    expect(DEFAULT_TEMPLATE_LIST_FILTER_ROW_GUTTER).toEqual([
      { xs: 8, sm: 12, md: 16, lg: 16, xl: 16, xxl: 16 },
      { xs: 8, sm: 10, md: 12, lg: 12, xl: 12, xxl: 12 },
    ])
  })

  it('sets popupMatchSelectWidth to 300 when any option label exceeds 10 chars', () => {
    const resolvedWidth = resolveSelectPopupMatchWidthByOptions(
      [
        { label: '短文本', value: 1 },
        { label: '这是一个超过十个字的报名计划名称', value: 2 },
      ],
      undefined
    )

    expect(resolvedWidth).toBe(300)
  })

  it('keeps popupMatchSelectWidth undefined when option labels are within 10 chars', () => {
    const resolvedWidth = resolveSelectPopupMatchWidthByOptions(
      [
        { label: '短文本', value: 1 },
        { label: '十个字刚刚好啊', value: 2 },
      ],
      undefined
    )

    expect(resolvedWidth).toBeUndefined()
  })

  it('respects explicit popupMatchSelectWidth value', () => {
    const resolvedWidth = resolveSelectPopupMatchWidthByOptions(
      [{ label: '这是一个超过十个字的报名计划名称', value: 2 }],
      true
    )

    expect(resolvedWidth).toBe(true)
  })

  it('renders normally when custom rowGutter overrides the defaults', () => {
    const fields: TemplateListFilterField<DemoValues>[] = [
      {
        type: 'input',
        name: 'name',
        label: '名称',
      },
    ]

    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()

      return (
        <TemplateListFilterForm<DemoValues>
          form={form}
          fields={fields}
          onSubmit={() => undefined}
          onReset={() => undefined}
          rowGutter={[4, 6]}
          {...baseLayoutProps}
        />
      )
    }

    render(<Demo />)

    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /重\s*置/ })).toBeTruthy()
  })

  it('renders number fields and only submits after query is clicked', async () => {
    const submittedValues: DemoValues[] = []
    const fields: TemplateListFilterField<DemoValues>[] = [
      {
        type: 'number',
        name: 'sort',
        label: '排序值',
        inputNumberProps: { min: 0, precision: 0, placeholder: '请输入排序值' },
      },
    ]

    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      return (
        <TemplateListFilterForm<DemoValues>
          form={form}
          fields={fields}
          onSubmit={(values) => submittedValues.push(values)}
          onReset={() => undefined}
          {...baseLayoutProps}
        />
      )
    }

    render(<Demo />)
    fireEvent.change(screen.getByPlaceholderText('请输入排序值'), { target: { value: '7' } })
    expect(submittedValues).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))
    await waitFor(() => expect(submittedValues).toEqual([{ sort: 7 }]))
  })

  it('renders remote-select fields and reloads the empty keyword without submitting on clear', async () => {
    const requestLog: Array<[string, number | undefined]> = []
    const submittedValues: DemoValues[] = []
    const fields: TemplateListFilterField<DemoValues>[] = [
      {
        type: 'remote-select',
        name: 'status',
        label: '状态',
        defaultOptions: [{ label: '开启', value: 1 }],
        fetchOptions: async (keyword, current) => {
          requestLog.push([keyword, current])
          return []
        },
        remoteSelectProps: { loadOnMount: false },
      },
    ]

    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      return (
        <TemplateListFilterForm<DemoValues>
          form={form}
          fields={fields}
          formProps={{ initialValues: { status: 1 } }}
          onSubmit={(values) => submittedValues.push(values)}
          onReset={() => undefined}
          {...baseLayoutProps}
        />
      )
    }

    const { container } = render(<Demo />)
    const clearTrigger = container.querySelector('.ant-select-clear')
    expect(clearTrigger).toBeTruthy()
    fireEvent.mouseDown(clearTrigger as HTMLElement)
    fireEvent.click(clearTrigger as HTMLElement)

    await waitFor(() => expect(requestLog).toContainEqual(['', 1]))
    expect(submittedValues).toEqual([])
  })

  it('keeps the form-selected remote label across searches without submitting filters', async () => {
    const submittedValues: DemoValues[] = []
    const fields: TemplateListFilterField<DemoValues>[] = [
      {
        type: 'remote-select',
        name: 'status',
        label: '状态',
        defaultOptions: [
          { label: '当前状态', value: 1 },
          { label: '无关状态', value: 2 },
        ],
        fetchOptions: async () => [{ label: '匹配状态', value: 3 }],
        remoteSelectProps: { open: true, loadOnMount: false },
      },
    ]
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      return (
        <TemplateListFilterForm<DemoValues>
          form={form}
          fields={fields}
          formProps={{ initialValues: { status: 1 } }}
          onSubmit={(values) => submittedValues.push(values)}
          onReset={() => form.resetFields()}
          {...baseLayoutProps}
        />
      )
    }

    render(<Demo />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '匹配' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    await screen.findByText('匹配状态')
    const optionLabels = Array.from(
      document.querySelectorAll('.ant-select-item-option-content')
    ).map((option) => option.textContent)
    expect(optionLabels).toContain('当前状态')
    expect(optionLabels).not.toContain('无关状态')
    expect(submittedValues).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))
    await waitFor(() => expect(submittedValues).toEqual([{ status: 1 }]))
  })

  it('renders conditional field only when visibleWhen is satisfied', async () => {
    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const fields: TemplateListFilterField<DemoValues>[] = [
        {
          type: 'select',
          name: 'status',
          label: '状态',
          options: [
            { label: '关闭', value: 0 },
            { label: '异常', value: 3 },
          ],
        },
        {
          type: 'input',
          name: 'name',
          label: '名称',
        },
        {
          type: 'custom',
          key: 'status-detail-tip',
          visibleWhen: (values) => values.status === 3,
          render: () => <div data-testid="status-detail-tip">异常标签</div>,
        },
      ]

      return (
        <>
          <Button onClick={() => form.setFieldValue('status', 3)}>set-status-error</Button>
          <TemplateListFilterForm<DemoValues>
            form={form}
            fields={fields}
            onSubmit={() => undefined}
            onReset={() => undefined}
            {...baseLayoutProps}
          />
        </>
      )
    }

    render(<Demo />)
    expect(screen.queryByTestId('status-detail-tip')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'set-status-error' }))

    await waitFor(() => {
      expect(screen.getByTestId('status-detail-tip')).toBeTruthy()
    })
  })

  it('loads select options only when dependsOn fields change and aborts stale request', async () => {
    let loadCount = 0
    const seenSignals: AbortSignal[] = []

    const loader = async ({
      values,
      signal,
    }: {
      values: Partial<DemoValues>
      signal: AbortSignal
    }) => {
      loadCount += 1
      seenSignals.push(signal)
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'))
          return
        }

        const timer = window.setTimeout(resolve, 30)
        signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timer)
            reject(new DOMException('aborted', 'AbortError'))
          },
          { once: true }
        )
      })

      return [{ label: values.name ?? 'fallback', value: 'ok' }]
    }

    const Demo = () => {
      const [form] = Form.useForm<DemoValues>()
      const fields: TemplateListFilterField<DemoValues>[] = [
        {
          type: 'input',
          name: 'name',
          label: '名称',
        },
        {
          type: 'input',
          name: 'updatedAt',
          label: '更新时间',
        },
        {
          type: 'select',
          name: 'statusDetail',
          label: '异常标签',
          dependsOn: ['name'],
          optionsLoader: loader,
        },
      ]

      return (
        <>
          <Button onClick={() => form.setFieldValue('updatedAt', String(Date.now()))}>
            set-unrelated
          </Button>
          <Button onClick={() => form.setFieldValue('name', `name-${Date.now()}`)}>set-name</Button>
          <TemplateListFilterForm<DemoValues>
            form={form}
            fields={fields}
            onSubmit={() => undefined}
            onReset={() => undefined}
            {...baseLayoutProps}
          />
        </>
      )
    }

    render(<Demo />)

    await waitFor(() => {
      expect(loadCount).toBeGreaterThan(0)
    })
    const initialCount = loadCount

    fireEvent.click(screen.getByRole('button', { name: 'set-unrelated' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(loadCount).toBe(initialCount)

    fireEvent.click(screen.getByRole('button', { name: 'set-name' }))
    await waitFor(() => {
      expect(loadCount).toBeGreaterThan(initialCount)
    })

    fireEvent.click(screen.getByRole('button', { name: 'set-name' }))
    await waitFor(() => {
      expect(seenSignals.some((signal) => signal.aborted)).toBe(true)
    })
  })
})
