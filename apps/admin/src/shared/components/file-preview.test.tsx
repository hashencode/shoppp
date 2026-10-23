import { render } from '../../test/render-with-app'
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { Button } from 'antd'
import { FilePreview } from './file-preview'

void React

let pdfPageErrorMode: 'load' | 'render' | null = null

rstest.mock('react-pdf', () => ({
  pdfjs: {
    GlobalWorkerOptions: {},
  },
  Document: ({
    children,
    file,
    onLoadError,
    onLoadSuccess,
  }: {
    children?: React.ReactNode
    file?: string
    onLoadError?: (error: Error) => void
    onLoadSuccess?: (result: { numPages: number }) => void
  }) => (
    <div data-testid="pdf-document">
      {file?.includes('broken') ? (
        <button type="button" onClick={() => onLoadError?.(new Error('load failed'))}>
          模拟 PDF 加载失败
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              pdfPageErrorMode = file?.includes('page-load-error')
                ? 'load'
                : file?.includes('page-render-error')
                  ? 'render'
                  : null
              onLoadSuccess?.({ numPages: 2 })
            }}
          >
            模拟 PDF 加载完成
          </button>
          {children}
        </>
      )}
    </div>
  ),
  Page: ({
    onLoadError,
    onRenderError,
    onRenderSuccess,
    pageNumber,
    width,
  }: {
    onLoadError?: (error: Error) => void
    onRenderError?: (error: Error) => void
    onRenderSuccess?: () => void
    pageNumber: number
    width: number
  }) => (
    <div data-testid={`pdf-page-${pageNumber}`} data-width={width}>
      <button type="button" onClick={() => onRenderSuccess?.()}>
        模拟第 {pageNumber} 页渲染完成
      </button>
      {pageNumber === 1 && pdfPageErrorMode === 'load' ? (
        <button type="button" onClick={() => onLoadError?.(new Error('page load failed'))}>
          模拟 PDF 页面加载失败
        </button>
      ) : null}
      {pageNumber === 1 && pdfPageErrorMode === 'render' ? (
        <button type="button" onClick={() => onRenderError?.(new Error('page render failed'))}>
          模拟 PDF 页面渲染失败
        </button>
      ) : null}
    </div>
  ),
}))

rstest.mock('./video-player', () => ({
  VideoPlayer: ({
    onError,
    source,
    sourceKind,
  }: {
    onError?: (message: string) => void
    source: string
    sourceKind: string
  }) => (
    <div data-testid="video-player" data-source={source} data-source-kind={sourceKind}>
      <button type="button" onClick={() => onError?.('视频预览加载失败')}>
        模拟视频错误
      </button>
    </div>
  ),
}))

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: { width: 420 },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    )
  }

  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get: () => 420,
})

let fetchedUrl = ''
let fetchedCredentials: RequestCredentials | undefined
let anchorClickCalled = 0
let clickedDownload = ''
let windowOpenCalled = 0

const originalFetch = globalThis.fetch
const originalCreateObjectURL = window.URL.createObjectURL
const originalRevokeObjectURL = window.URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click
const originalWindowOpen = window.open

beforeEach(() => {
  pdfPageErrorMode = null
  fetchedUrl = ''
  fetchedCredentials = undefined
  anchorClickCalled = 0
  clickedDownload = ''
  windowOpenCalled = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchedUrl = String(input)
    fetchedCredentials = init?.credentials

    return {
      ok: true,
      blob: async () => new Blob(['file'], { type: 'application/octet-stream' }),
      headers: new Headers({
        'content-disposition': "attachment; filename*=UTF-8''ticket.pdf",
      }),
    } as Response
  }) as typeof fetch

  window.URL.createObjectURL = () => 'blob:file-preview-test'
  window.URL.revokeObjectURL = () => undefined
  HTMLAnchorElement.prototype.click = function click() {
    anchorClickCalled += 1
    clickedDownload = this.download
  }
  window.open = (() => {
    windowOpenCalled += 1
    return null
  }) as typeof window.open
})

afterEach(() => {
  globalThis.fetch = originalFetch
  window.URL.createObjectURL = originalCreateObjectURL
  window.URL.revokeObjectURL = originalRevokeObjectURL
  HTMLAnchorElement.prototype.click = originalAnchorClick
  window.open = originalWindowOpen
  Object.defineProperty(navigator, 'pdfViewerEnabled', {
    configurable: true,
    value: undefined,
  })
})

describe('FilePreview', () => {
  it('keeps one PDF loading indicator until the first page renders and resets on source change', async () => {
    const view = render(<FilePreview open title="课件预览" source="/courseware.pdf" />)
    const loading = screen.getByRole('status')
    const viewport = loading.parentElement as HTMLElement
    expect(viewport.getAttribute('aria-busy')).toBe('true')

    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载完成' }))
    expect(screen.getAllByRole('status')).toEqual([loading])
    fireEvent.click(screen.getByRole('button', { name: '模拟第 2 页渲染完成' }))
    expect(screen.getAllByRole('status')).toEqual([loading])
    fireEvent.click(screen.getByRole('button', { name: '模拟第 1 页渲染完成' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(viewport.getAttribute('aria-busy')).toBe('false')

    view.rerender(<FilePreview open title="课件预览" source="/updated.pdf" />)
    expect(screen.getByRole('status').parentElement?.getAttribute('aria-busy')).toBe('true')
  })

  it('keeps the PDF viewport and loading through native fetch, then exposes failure recovery', async () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: true })
    let resolveFetch: ((response: Response) => void) | undefined
    globalThis.fetch = (() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })) as typeof fetch
    render(<FilePreview open title="课件预览" source="/broken.pdf" />)
    const loading = screen.getByRole('status')
    const viewport = loading.parentElement

    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载失败' }))
    expect(resolveFetch).toBeDefined()
    expect(screen.getAllByRole('status')).toEqual([loading])
    expect(loading.parentElement).toBe(viewport)

    await act(async () => {
      resolveFetch!({ ok: true, blob: async () => new Blob(['pdf']) } as Response)
    })
    const frame = await screen.findByTitle('课件预览')
    expect(frame.parentElement).toBe(viewport)
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.error(frame)
    expect(await screen.findByText('PDF 预览加载失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /下载文件/ })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('classifies image from trusted MIME before the file name', async () => {
    render(
      <FilePreview
        title="图片预览"
        source="/uploads/file.bin?token=1"
        fileName="document.pdf"
        contentType="image/png"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '预览' }))

    await waitFor(() => expect(document.querySelector('.ant-image-preview')).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: '图片预览' })).toBeNull()
    expect(windowOpenCalled).toBe(0)
  })

  it('renders PDF pages responsively and keeps download after a renderer failure', async () => {
    const view = render(
      <FilePreview title="课件预览" source="/courseware.pdf?token=1" fileName="课程讲义.PDF" />
    )

    fireEvent.click(screen.getByRole('button', { name: '预览' }))
    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载完成' }))
    expect((await screen.findByTestId('pdf-page-1')).getAttribute('data-width')).toBe('388')
    expect(screen.getByTestId('pdf-page-2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /关.*闭/ }))
    view.rerender(
      <FilePreview
        title="课件预览"
        source="/broken.pdf"
        fileName="课程讲义"
        trigger={<Button>查看课件</Button>}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '查看课件' }))
    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载失败' }))

    expect(await screen.findByText('PDF 预览加载失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /下载文件/ })).toBeTruthy()
  })

  it('falls back through native preview after PDF page failures', async () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: true })
    const view = render(
      <FilePreview title="课件预览" source="/page-load-error.pdf" fileName="页面加载异常.pdf" />
    )
    fireEvent.click(screen.getByRole('button', { name: '预览' }))
    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载完成' }))
    fireEvent.click(screen.getByRole('button', { name: '模拟 PDF 页面加载失败' }))
    expect(await screen.findByTitle('课件预览')).toBeTruthy()
    expect(fetchedCredentials).toBe('include')

    view.rerender(
      <FilePreview title="课件预览" source="/page-render-error.pdf" fileName="页面渲染异常.pdf" />
    )
    fireEvent.click(await screen.findByRole('button', { name: '模拟 PDF 加载完成' }))
    fireEvent.click(screen.getByRole('button', { name: '模拟 PDF 页面渲染失败' }))
    expect(await screen.findByTitle('课件预览')).toBeTruthy()
  })

  it('aborts a pending native fetch and falls back after the bounded timeout', async () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: true })
    let fetchSignal: AbortSignal | undefined
    globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
      fetchSignal = init?.signal ?? undefined
      fetchedCredentials = init?.credentials
      return new Promise<Response>((_, reject) => {
        fetchSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }) as typeof fetch
    render(<FilePreview title="课件预览" source="/broken.pdf" fileName="课程讲义.pdf" />)

    fireEvent.click(screen.getByRole('button', { name: '预览' }))
    const failure = await screen.findByRole('button', { name: '模拟 PDF 加载失败' })
    rstest.useFakeTimers()
    try {
      fireEvent.click(failure)
      expect(fetchSignal).toBeDefined()
      expect(fetchedCredentials).toBe('include')
      await act(async () => {
        await rstest.advanceTimersByTimeAsync(15_000)
      })
      expect(fetchSignal?.aborted).toBe(true)
      expect(screen.getByText('PDF 预览加载失败')).toBeTruthy()
    } finally {
      rstest.useRealTimers()
    }
  })

  it('loads HLS and MP4-family video only after opening and clears errors on source change', async () => {
    const view = render(
      <FilePreview title="视频预览" source="/lesson.MOV?token=1" fileName="课程视频.mov" />
    )

    expect(screen.queryByTestId('video-player')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '预览' }))
    expect((await screen.findByTestId('video-player')).getAttribute('data-source-kind')).toBe('mp4')

    fireEvent.click(screen.getByRole('button', { name: '模拟视频错误' }))
    expect(await screen.findByText('视频预览加载失败')).toBeTruthy()

    view.rerender(<FilePreview title="视频预览" source="/updated.m3u8" fileName="更新视频.m3u8" />)
    expect((await screen.findByTestId('video-player')).getAttribute('data-source-kind')).toBe('hls')
    expect(screen.queryByText('视频预览加载失败')).toBeNull()
  })

  it('shows unsupported feedback without automatically downloading', async () => {
    render(<FilePreview title="附件预览" source="/uploads/archive.zip" fileName="资料.zip" />)

    fireEvent.click(screen.getByRole('button', { name: '预览' }))

    expect(await screen.findByText('暂不支持在线预览')).toBeTruthy()
    expect(fetchedUrl).toBe('')
    expect(windowOpenCalled).toBe(0)
  })

  it('downloads only after the explicit action', async () => {
    render(
      <FilePreview
        title="准考证预览"
        source="/ticket.pdf"
        fileName="张三的准考证"
        trigger={<Button>查看准考证</Button>}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '查看准考证' }))
    expect(fetchedUrl).toBe('')
    fireEvent.click(await screen.findByRole('button', { name: /下载文件/ }))

    await waitFor(() => {
      expect(fetchedUrl).toBe('/ticket.pdf')
      expect(fetchedCredentials).toBe('include')
      expect(anchorClickCalled).toBe(1)
      expect(clickedDownload).toBe('ticket.pdf')
    })
  })

  it('rejects unsafe sources and unsafe inline unknown files', () => {
    const view = render(
      <FilePreview title="附件预览" source="javascript:alert(1)" fileName="资料.pdf" />
    )
    expect((screen.getByRole('button', { name: '预览' }) as HTMLButtonElement).disabled).toBe(true)

    view.rerender(
      <FilePreview title="附件预览" source="data:text/plain;base64,dGVzdA==" fileName="资料.zip" />
    )
    expect((screen.getByRole('button', { name: '预览' }) as HTMLButtonElement).disabled).toBe(true)
    expect(windowOpenCalled).toBe(0)
  })
})
