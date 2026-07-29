import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { TemplateListContent } from './template-list-content'

void React

describe('TemplateListContent', () => {
  it('renders loading state', () => {
    render(
      <TemplateListContent
        showInitialLoading={true}
        showError={false}
        showPartial={false}
        showEmpty={false}
        onRetry={() => undefined}
        onReloadPartial={() => undefined}
        onResetEmpty={() => undefined}
        tableNode={<div>table content</div>}
      />
    )

    expect(screen.getByText('正在加载规则列表...')).toBeTruthy()
  })

  it('renders error state and triggers retry callback', () => {
    let retryCallCount = 0
    const onRetry = () => {
      retryCallCount += 1
    }

    render(
      <TemplateListContent
        showInitialLoading={false}
        showError={true}
        showPartial={false}
        showEmpty={false}
        errorMessage="network failed"
        onRetry={onRetry}
        onReloadPartial={() => undefined}
        onResetEmpty={() => undefined}
        tableNode={<div>table content</div>}
      />
    )

    expect(screen.getByText('规则列表加载失败')).toBeTruthy()
    expect(screen.getByText('network failed')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: /重\s*试/ })
    expect(retryButton.className).not.toContain('ant-btn-primary')

    fireEvent.click(retryButton)
    expect(retryCallCount).toBe(1)
  })

  it('renders partial state and triggers reload callback', () => {
    let reloadCount = 0
    render(
      <TemplateListContent
        showInitialLoading={false}
        showError={false}
        showPartial={true}
        showEmpty={false}
        partialMessage="partial data"
        onRetry={() => undefined}
        onReloadPartial={() => {
          reloadCount += 1
        }}
        onResetEmpty={() => undefined}
        tableNode={<div>table content</div>}
      />
    )

    expect(screen.getByText('当前仅返回部分数据')).toBeTruthy()
    expect(screen.getByText('partial data')).toBeTruthy()
    expect(screen.getByText('table content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(reloadCount).toBe(1)
  })

  it('renders empty state and triggers reset callback', () => {
    let resetCount = 0
    render(
      <TemplateListContent
        showInitialLoading={false}
        showError={false}
        showPartial={false}
        showEmpty={true}
        onRetry={() => undefined}
        onReloadPartial={() => undefined}
        onResetEmpty={() => {
          resetCount += 1
        }}
        tableNode={<div>table content</div>}
      />
    )

    expect(screen.getByText('尝试重置筛选条件后重新查询。')).toBeTruthy()
    const resetButton = screen.getByRole('button', { name: '重置筛选' })
    expect(resetButton.className).not.toContain('ant-btn-primary')

    fireEvent.click(resetButton)
    expect(resetCount).toBe(1)
  })

  it('renders normal table when no special state is active', () => {
    render(
      <TemplateListContent
        showInitialLoading={false}
        showError={false}
        showPartial={false}
        showEmpty={false}
        onRetry={() => undefined}
        onReloadPartial={() => undefined}
        onResetEmpty={() => undefined}
        tableNode={<div>table content</div>}
      />
    )

    expect(screen.getByText('table content')).toBeTruthy()
  })
})
