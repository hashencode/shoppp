import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import type { UploadProps } from 'antd'
import { ListExcelActions } from './list-excel-actions'

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

const createDeferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    reject,
    resolve,
  }
}

describe('ListExcelActions', () => {
  it('renders export only without import or template actions', () => {
    render(
      <ListExcelActions
        exportAction={{
          label: '导出数据',
          onClick: () => undefined,
        }}
      />
    )

    expect(screen.getByRole('button', { name: /导出数据/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /数据导入/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /下载导入模板/ })).toBeNull()
  })

  it('renders import before the adjacent template link action', () => {
    render(
      <ListExcelActions
        importAction={{
          uploadProps: {},
        }}
        templateAction={{
          onClick: () => undefined,
        }}
      />
    )

    expect(
      screen
        .getAllByRole('button', { name: /数据导入|下载导入模板/ })
        .map((button) => button.textContent)
    ).toEqual(['数据导入', '下载导入模板'])
  })

  it('renders template download as a link-style button without a download icon', () => {
    render(
      <ListExcelActions
        importAction={{
          uploadProps: {},
        }}
        templateAction={{
          label: '下载导入模板',
          onClick: () => undefined,
        }}
      />
    )

    const templateButton = screen.getByRole('button', { name: /下载导入模板/ })
    expect(templateButton.className).toContain('ant-btn-link')
    expect(templateButton.querySelector('.anticon-download')).toBeNull()
  })

  it('shows export loading while async action is pending', async () => {
    const deferred = createDeferred()

    render(
      <ListExcelActions
        exportAction={{
          label: '导出数据',
          onClick: () => deferred.promise,
        }}
      />
    )

    const exportButton = screen.getByRole('button', { name: /导出数据/ })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(exportButton.className).toContain('ant-btn-loading')
    })

    deferred.resolve()

    await waitFor(() => {
      expect(exportButton.className).not.toContain('ant-btn-loading')
    })
  })

  it('ignores repeated export clicks while the async action is pending', async () => {
    const deferred = createDeferred()
    let clickCount = 0
    render(
      <ListExcelActions exportAction={{
        label: '导出数据',
        onClick: () => {
          clickCount += 1
          return deferred.promise
        },
      }} />
    )

    const exportButton = screen.getByRole('button', { name: /导出数据/ })
    fireEvent.click(exportButton)
    fireEvent.click(exportButton)
    expect(clickCount).toBe(1)
    deferred.resolve()
    await waitFor(() => expect(exportButton.className).not.toContain('ant-btn-loading'))
  })

  it('releases the export guard after an async action rejects', async () => {
    const deferred = createDeferred()
    let clickCount = 0
    render(
      <ListExcelActions exportAction={{
        label: '导出数据',
        onClick: () => {
          clickCount += 1
          return deferred.promise
        },
      }} />
    )

    const exportButton = screen.getByRole('button', { name: /导出数据/ })
    fireEvent.click(exportButton)
    deferred.reject(new Error('导出失败'))
    await waitFor(() => expect(exportButton.className).not.toContain('ant-btn-loading'))
    fireEvent.click(exportButton)
    expect(clickCount).toBe(2)
  })

  it('lets explicit loading override internal async loading', async () => {
    const deferred = createDeferred()

    render(
      <ListExcelActions
        exportAction={{
          label: '导出数据',
          loading: false,
          onClick: () => deferred.promise,
        }}
      />
    )

    const exportButton = screen.getByRole('button', { name: /导出数据/ })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(exportButton.className).not.toContain('ant-btn-loading')
    })

    deferred.resolve()
  })

  it('shows template loading while async action is pending', async () => {
    const deferred = createDeferred()

    render(
      <ListExcelActions
        importAction={{
          uploadProps: {},
        }}
        templateAction={{
          onClick: () => deferred.promise,
        }}
      />
    )

    const templateButton = screen.getByRole('button', { name: /下载导入模板/ })
    fireEvent.click(templateButton)

    await waitFor(() => {
      expect(templateButton.className).toContain('ant-btn-loading')
    })

    deferred.resolve()

    await waitFor(() => {
      expect(templateButton.className).not.toContain('ant-btn-loading')
    })
  })

  it('ignores repeated template clicks while the async action is pending', async () => {
    const deferred = createDeferred()
    let clickCount = 0
    render(
      <ListExcelActions
        importAction={{ uploadProps: {} }}
        templateAction={{
          onClick: () => {
            clickCount += 1
            return deferred.promise
          },
        }}
      />
    )

    const templateButton = screen.getByRole('button', { name: /下载导入模板/ })
    fireEvent.click(templateButton)
    fireEvent.click(templateButton)
    expect(clickCount).toBe(1)
    deferred.resolve()
    await waitFor(() => expect(templateButton.className).not.toContain('ant-btn-loading'))
  })

  it('keeps template action outside the import modal', async () => {
    render(
      <ListExcelActions
        importAction={{
          uploadProps: {},
          uploadHint: '支持 `.xls/.xlsx` 文件，上传后自动导入',
        }}
        templateAction={{
          onClick: () => undefined,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /数据导入/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('点击或拖拽文件至此区域')).toBeTruthy()
    expect(within(dialog).getByText('支持 `.xls/.xlsx` 文件，上传后自动导入')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /下载导入模板/ })).toBeNull()
  })

  it('allows upload props to close the import modal after success', async () => {
    const buildUploadProps = ({ close }: { close: () => void }): UploadProps => ({
      showUploadList: false,
      customRequest: (options) => {
        options.onSuccess?.({ data: true })
        close()
      },
    })

    render(
      <ListExcelActions
        importAction={{
          uploadProps: buildUploadProps,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /数据导入/ }))
    const dialog = await screen.findByRole('dialog')
    const input = dialog.querySelector('input[type="file"]')
    expect(input).toBeTruthy()

    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [new File(['score'], 'score.xlsx')],
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog').className).toContain('ant-zoom-leave')
    })
  })
})
