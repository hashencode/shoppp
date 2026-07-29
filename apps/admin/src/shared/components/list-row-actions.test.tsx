import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { ListRowActions, type ListRowActionSpec } from './list-row-actions'

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

describe('ListRowActions', () => {
  it('renders direct actions with vertical dividers', () => {
    const actions: ListRowActionSpec[] = [
      { key: 'view', label: '查看', onClick: () => undefined },
      { key: 'edit', label: '修改', onClick: () => undefined },
    ]

    const { container } = render(<ListRowActions actions={actions} />)

    expect(screen.getByRole('button', { name: '查看' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '修改' })).toBeTruthy()
    expect(container.querySelectorAll('.ant-divider-vertical').length).toBe(1)
  })

  it('renders all visible actions directly when action count exceeds four', () => {
    const actions: ListRowActionSpec[] = [
      { key: 'view', label: '查看', onClick: () => undefined },
      { key: 'edit', label: '修改', onClick: () => undefined },
      { key: 'copy', label: '复制', onClick: () => undefined },
      { key: 'disable', label: '禁用', onClick: () => undefined },
      { key: 'delete', label: '删除', onClick: () => undefined },
    ]

    const { container } = render(<ListRowActions actions={actions} />)

    expect(screen.getByRole('button', { name: '查看' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '修改' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '复制' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '禁用' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '更多操作' })).toBeNull()
    expect(container.querySelectorAll('.ant-divider-vertical').length).toBe(4)
  })

  it('renders link actions with href metadata', () => {
    const actions: ListRowActionSpec[] = [
      {
        key: 'booking',
        label: '订舱',
        href: 'https://example.com/booking',
        target: '_blank',
        rel: 'noreferrer',
      },
    ]

    render(<ListRowActions actions={actions} />)

    const linkAction = screen.getByRole('link', { name: '订舱' })
    expect(linkAction.getAttribute('href')).toBe('https://example.com/booking')
    expect(linkAction.getAttribute('target')).toBe('_blank')
  })

  it('prefixes internal link actions with the configured app base', () => {
    render(<ListRowActions appBasePath="/admin" actions={[{ key: 'view', label: '查看', href: '/users/1' }]} />)
    expect(screen.getByRole('link', { name: '查看' }).getAttribute('href')).toBe('/admin/users/1')
  })

  it('wraps dangerous actions with popconfirm', async () => {
    let deleteCount = 0
    const actions: ListRowActionSpec[] = [
      {
        key: 'delete',
        label: '删除',
        danger: true,
        confirm: {
          title: '确认删除这条规则吗？',
          description: '删除后将从当前列表中移除。',
          okText: '确认删除',
          cancelText: '取消',
        },
        onClick: () => {
          deleteCount += 1
        },
      },
    ]

    render(<ListRowActions actions={actions} />)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(await screen.findByText('确认删除这条规则吗？')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(deleteCount).toBe(1)
    })
  })

  it('supports custom rendered actions inline with later actions', () => {
    const actions: ListRowActionSpec[] = [
      {
        key: 'custom-direct',
        label: '自定义直出',
        render: <button type="button">自定义直出</button>,
      },
      {
        key: 'view',
        label: '查看',
        onClick: () => undefined,
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: () => undefined,
      },
      {
        key: 'disable',
        label: '禁用',
        onClick: () => undefined,
      },
      {
        key: 'custom-overflow',
        label: '自定义后续操作',
        render: <button type="button">自定义后续操作</button>,
      },
    ]

    render(<ListRowActions actions={actions} />)

    expect(screen.getByRole('button', { name: '自定义直出' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '禁用' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '自定义后续操作' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '更多操作' })).toBeNull()
  })
})
