import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { ListPromptGeneratorPage } from './list-prompt-generator-page'

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

if (!window.BroadcastChannel) {
  class BroadcastChannelMock {
    name: string
    onmessage: ((event: MessageEvent) => void) | null = null
    constructor(name: string) {
      this.name = name
    }
    postMessage(data: unknown) {
      void data
    }
    close() {}
  }

  window.BroadcastChannel = BroadcastChannelMock as unknown as typeof BroadcastChannel
}

describe('ListPromptGeneratorPage', () => {
  it('renders default generated prompt content', () => {
    render(<ListPromptGeneratorPage />)

    const output = screen.getByLabelText('生成提示词结果') as HTMLTextAreaElement
    const specOutput = screen.getByLabelText('生成Spec结果') as HTMLTextAreaElement
    expect(output.value).toContain('在当前项目实现【年级管理】相关页面')
    expect(output.value).toContain('GET /api/v1/grades')
    expect(output.value).toContain('PATCH /api/v1/grades/{id}/status')
    expect(output.value).toContain('UI 交互约束（必须遵守）')
    expect(output.value).toContain('禁止新增未在 spec 声明的 UI 结构')
    expect(output.value).toContain('列表必须使用 useListViewPreferences 持久化表格视图配置')
    expect(output.value).toContain('defaultColumnKeys 必须由 columns 动态推导，禁止手写固定字段数组')
    expect(specOutput.value).toContain('"bizName": "年级管理"')
    expect(specOutput.value).toContain('"formRoute": "/dev/base-data/grade/form"')
    expect(specOutput.value).toContain('"uiInteractionConstraints"')
    expect(specOutput.value).toContain('"listViewPreferences"')
    expect(specOutput.value).toContain('"defaultColumnKeysSource": "columns-derived"')
  })

  it('updates prompt when 查看 button is disabled', () => {
    render(<ListPromptGeneratorPage />)

    fireEvent.click(screen.getByLabelText('列表项按钮-启用-查看'))

    const output = screen.getByLabelText('生成提示词结果') as HTMLTextAreaElement
    expect(output.value).not.toContain('查看：跳转 /dev/base-data/grade/form?mode=readonly&id=<id>')
  })

  it('shows validation error when form route is empty', () => {
    render(<ListPromptGeneratorPage />)

    fireEvent.change(screen.getByDisplayValue('/dev/base-data/grade/form'), {
      target: { value: '' },
    })

    expect(screen.getByText('表单路由不能为空')).toBeTruthy()
  })
})
