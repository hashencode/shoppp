import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { Button } from 'antd'
import { RoutePageMetaProvider } from '../../layout/route-page-meta-context'
import { CustomPageRecipe } from './custom-page-recipe'

void React

describe('CustomPageRecipe', () => {
  it.each([
    ['normal', <div key="normal">业务内容</div>],
    ['loading', <div key="loading">加载中</div>],
    [
      'error-like',
      <div key="error" role="alert">
        加载失败
      </div>,
    ],
  ])('keeps one level-4 route title in the %s composition', (_state, content) => {
    render(
      <RoutePageMetaProvider value={{ title: '课程分类', breadcrumbItems: [] }}>
        <CustomPageRecipe>{content}</CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    const heading = screen.getByRole('heading', { level: 4, name: '课程分类' })

    expect(heading).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(heading.classList.contains('!mb-1')).toBe(true)
    expect(heading.closest('.space-y-4')?.classList.contains('pb-20')).toBe(true)
    expect(content.props.children ? screen.getByText(content.props.children) : null).toBeTruthy()
  })

  it('lets explicit title override route meta title', () => {
    render(
      <RoutePageMetaProvider value={{ title: '路由标题', breadcrumbItems: [] }}>
        <CustomPageRecipe title="页面标题">
          <div>业务内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    expect(screen.getByRole('heading', { level: 4, name: '页面标题' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: '路由标题' })).toBeNull()
  })

  it('supports hidden title, header actions, and back action', () => {
    let backCount = 0

    const { rerender } = render(
      <RoutePageMetaProvider value={{ title: '隐藏标题', breadcrumbItems: [] }}>
        <CustomPageRecipe titleHidden extra={<Button>刷新</Button>}>
          <div>业务内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    expect(screen.queryByRole('heading', { name: '隐藏标题' })).toBeNull()
    expect(screen.getByRole('button', { name: /刷\s*新/ })).toBeTruthy()

    rerender(
      <RoutePageMetaProvider value={{ title: '编辑课程', breadcrumbItems: [] }}>
        <CustomPageRecipe
          onBack={() => {
            backCount += 1
          }}
        >
          <div>表单内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    fireEvent.click(screen.getByLabelText('返回'))
    expect(backCount).toBe(1)
  })
})
