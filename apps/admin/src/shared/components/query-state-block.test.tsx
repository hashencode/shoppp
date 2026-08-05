import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { QueryStateBlock } from './query-state-block'

void React

describe('QueryStateBlock', () => {
  it('renders retry-style error actions as default buttons', () => {
    render(
      <QueryStateBlock
        state="error"
        title="加载失败"
        primaryActionLabel="重试"
        primaryActionButtonType="default"
        onPrimaryAction={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: /重\s*试/ }).className).not.toContain('ant-btn-primary')
  })

  it('keeps navigation recovery actions primary by default', () => {
    render(
      <QueryStateBlock
        state="error"
        title="加载失败"
        primaryActionLabel="返回列表"
        onPrimaryAction={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: '返回列表' }).className).toContain('ant-btn-primary')
  })

  it('renders reset-filter empty actions as default buttons', () => {
    render(
      <QueryStateBlock
        state="empty"
        title="暂无数据"
        primaryActionLabel="重置筛选"
        primaryActionButtonType="default"
        onPrimaryAction={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: '重置筛选' }).className).not.toContain('ant-btn-primary')
  })
})
