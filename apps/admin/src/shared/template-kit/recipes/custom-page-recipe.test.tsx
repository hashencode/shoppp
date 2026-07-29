import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { Button } from 'antd'
import { RoutePageMetaProvider } from '../../layout/route-page-meta-context'
import { CustomPageRecipe } from './custom-page-recipe'

void React

describe('CustomPageRecipe', () => {
  it('renders the current route title from AppShell meta by default', () => {
    render(
      <RoutePageMetaProvider value={{ title: '课程分类', breadcrumbItems: [] }}>
        <CustomPageRecipe>
          <div>业务内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    expect(screen.getByRole('heading', { name: '课程分类' })).toBeTruthy()
    expect(screen.getByText('业务内容')).toBeTruthy()
  })

  it('lets explicit title override route meta title', () => {
    render(
      <RoutePageMetaProvider value={{ title: '路由标题', breadcrumbItems: [] }}>
        <CustomPageRecipe title="页面标题">
          <div>业务内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    expect(screen.getByRole('heading', { name: '页面标题' })).toBeTruthy()
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
        <CustomPageRecipe onBack={() => {
          backCount += 1
        }}>
          <div>表单内容</div>
        </CustomPageRecipe>
      </RoutePageMetaProvider>
    )

    fireEvent.click(screen.getByLabelText('返回'))
    expect(backCount).toBe(1)
  })
})
