import { render } from '../../test/render-with-app'
import '../../index.css'
import { ConfigProvider, theme } from 'antd'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it, rstest } from '@rstest/core'
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
const PDF_BYTES = (() => {
  const stream = 'BT /F1 14 Tf 40 100 Td (PDF loading preview) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...[3, 4].map(
      () =>
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>'
    ),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let content = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(content.length)
    content += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const startXref = content.length
  content += `xref\n0 7\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
  return new TextEncoder().encode(content)
})()
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
  it.each(['light', 'dark'] as const)(
    'keeps a single centered loading state and stable PDF viewport in %s theme',
    async (mode) => {
      const originalFetch = window.fetch
      let resolvePdf: ((response: Response) => void) | undefined
      const fetchSpy = rstest.spyOn(window, 'fetch').mockImplementation((input, init) => {
        if (String(input).includes('/loading-preview.pdf')) {
          return new Promise<Response>((resolve) => {
            resolvePdf = resolve
          })
        }
        return originalFetch(input, init)
      })
      try {
        render(
          <ConfigProvider
            theme={{
              algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
              token: { motion: false },
            }}
          >
            <FilePreview open title="PDF 加载预览" source="/loading-preview.pdf" />
          </ConfigProvider>
        )
        const loading = screen.getByRole('status')
        const viewport = loading.parentElement as HTMLElement
        const bounds = viewport.getBoundingClientRect()
        const background = getComputedStyle(viewport).backgroundColor
        await waitFor(() => expect(resolvePdf).toBeDefined())
        expect(screen.getAllByRole('status')).toEqual([loading])
        expect(bounds.height).toBeGreaterThanOrEqual(480)
        expect(viewport.getBoundingClientRect().height).toBe(bounds.height)
        expect(background).toBe(mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(245, 245, 245)')
        const spinner = loading.querySelector('.ant-spin')!.getBoundingClientRect()
        expect(Math.abs(spinner.x + spinner.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(
          2
        )
        expect(
          Math.abs(spinner.y + spinner.height / 2 - bounds.y - bounds.height / 2)
        ).toBeLessThan(2)

        resolvePdf!(new Response(PDF_BYTES, { headers: { 'Content-Type': 'application/pdf' } }))
        await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 10_000 })
        expect(viewport.getAttribute('aria-busy')).toBe('false')
        expect(viewport.getBoundingClientRect().height).toBe(bounds.height)
        expect(getComputedStyle(viewport).backgroundColor).toBe(background)
        expect(viewport.querySelectorAll('canvas')).toHaveLength(2)
        expect(viewport.querySelector('canvas')!.width).toBeGreaterThan(0)
      } finally {
        fetchSpy.mockRestore()
      }
    },
    15_000
  )

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
