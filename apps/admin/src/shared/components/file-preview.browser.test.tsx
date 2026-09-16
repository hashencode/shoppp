import { render } from '../../test/render-with-app'
import { ConfigProvider, theme } from 'antd'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { FilePreview } from './file-preview'

void React

const IMAGE_SOURCE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#1677ff"/></svg>'
  )

const HLS_SOURCE =
  'data:application/vnd.apple.mpegurl;base64,I0VYVE0zVQojRVhULVgtVkVSU0lPTjozCiNFWFQtWC1FTkRMSVNUCg=='

const INVALID_PDF_SOURCE = 'data:application/pdf;base64,bm90IGEgcGRm'
const OTHER_INVALID_PDF_SOURCE = 'data:application/pdf;base64,c3RpbGwgbm90IGEgcGRm'
const originalPromiseWithResolversDescriptor = Object.getOwnPropertyDescriptor(
  Promise,
  'withResolvers'
)
const originalPdfViewerEnabledDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'pdfViewerEnabled'
)

afterEach(() => {
  if (originalPromiseWithResolversDescriptor) {
    Object.defineProperty(Promise, 'withResolvers', originalPromiseWithResolversDescriptor)
  } else {
    Reflect.deleteProperty(Promise, 'withResolvers')
  }
  if (originalPdfViewerEnabledDescriptor) {
    Object.defineProperty(navigator, 'pdfViewerEnabled', originalPdfViewerEnabledDescriptor)
  } else {
    Reflect.deleteProperty(navigator, 'pdfViewerEnabled')
  }
  cleanup()
})

describe('FilePreview browser rendering', () => {
  it('keeps the real image toolbar available and restores focus after close', async () => {
    render(<FilePreview title="图片预览" source={IMAGE_SOURCE} fileName="学习记录.png" />)

    const trigger = page.getByRole('button', { name: '预览' })
    await trigger.focus()
    await trigger.click()

    await expect.element(page.getByRole('dialog', { name: '学习记录.png' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'zoomIn' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: 'rotateRight' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: '下载文件' })).toBeVisible()

    await page.getByRole('button', { name: 'close' }).click()
    await waitFor(() => {
      expect(document.activeElement?.textContent).toContain('预览')
    })
  })

  it('keeps unsupported feedback readable in a responsive dark-theme modal', async () => {
    render(
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <FilePreview title="附件预览" source="/uploads/archive.zip" fileName="资料.zip" />
      </ConfigProvider>
    )

    await page.getByRole('button', { name: '预览' }).click()

    await expect.element(page.getByRole('dialog', { name: '附件预览' })).toBeVisible()
    await expect.element(page.getByRole('alert')).toBeVisible()
    await expect.element(page.getByText('暂不支持在线预览', { exact: true })).toBeVisible()

    const modal = document.querySelector<HTMLElement>('.ant-modal')
    expect(modal).toBeTruthy()
    expect(modal?.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth)
    expect(getComputedStyle(modal as HTMLElement).color).not.toBe('')
  })

  it('recreates native PDF resources across source changes and a controlled reopen', async () => {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      configurable: true,
      value: true,
    })
    const originalRevokeObjectURL = window.URL.revokeObjectURL
    const revokedObjectUrls: string[] = []
    window.URL.revokeObjectURL = (url) => {
      revokedObjectUrls.push(String(url))
      originalRevokeObjectURL.call(window.URL, url)
    }
    const preview = (open: boolean, source: string) => (
      <FilePreview
        open={open}
        onOpenChange={() => undefined}
        trigger={null}
        title="PDF 会话预览"
        source={source}
        fileName="会话课件.pdf"
      />
    )

    try {
      const view = render(preview(true, INVALID_PDF_SOURCE))
      const firstFrame = await screen.findByTitle('PDF 会话预览', undefined, {
        timeout: 10_000,
      })

      view.rerender(preview(true, OTHER_INVALID_PDF_SOURCE))
      expect(screen.queryByTitle('PDF 会话预览')).toBeNull()
      const secondFrame = await screen.findByTitle('PDF 会话预览', undefined, {
        timeout: 10_000,
      })
      expect(secondFrame).not.toBe(firstFrame)
      await waitFor(() => expect(revokedObjectUrls.length).toBeGreaterThanOrEqual(1))

      view.rerender(preview(false, OTHER_INVALID_PDF_SOURCE))
      await waitFor(() => expect(screen.queryByTitle('PDF 会话预览')).toBeNull())

      view.rerender(preview(true, OTHER_INVALID_PDF_SOURCE))
      const reopenedFrame = await screen.findByTitle('PDF 会话预览', undefined, {
        timeout: 10_000,
      })
      expect(reopenedFrame).not.toBe(secondFrame)
      expect(screen.queryByText('PDF 预览加载失败')).toBeNull()
    } finally {
      window.URL.revokeObjectURL = originalRevokeObjectURL
    }
  }, 30_000)

  it('mounts the video player only while open and destroys it after close', async () => {
    render(
      <FilePreview
        title="视频预览"
        source={HLS_SOURCE}
        fileName="课程视频.m3u8"
        contentType="application/vnd.apple.mpegurl"
      />
    )

    expect(document.querySelector('.video-player-stage.xgplayer')).toBeNull()
    await page.getByRole('button', { name: '预览' }).click()

    await waitFor(
      () => {
        expect(document.querySelector('.video-player-stage.xgplayer')).toBeTruthy()
      },
      { timeout: 10_000 }
    )

    fireEvent.click(screen.getByRole('button', { name: /关\s*闭/ }))
    await waitFor(() => {
      expect(document.querySelector('.video-player-stage.xgplayer')).toBeNull()
    })
  }, 20_000)
})
