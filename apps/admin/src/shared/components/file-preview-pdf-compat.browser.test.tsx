import '../../index.css'
import React from 'react'
import { afterAll, expect, it } from '@rstest/core'
import { render } from '../../test/render-with-app'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { FilePreview } from './file-preview'

void React

const originalResolvers = Object.getOwnPropertyDescriptor(Promise, 'withResolvers')
const originalViewer = Object.getOwnPropertyDescriptor(navigator, 'pdfViewerEnabled')

afterAll(() => {
  cleanup()
  if (originalResolvers) Object.defineProperty(Promise, 'withResolvers', originalResolvers)
  else Reflect.deleteProperty(Promise, 'withResolvers')
  if (originalViewer) Object.defineProperty(navigator, 'pdfViewerEnabled', originalViewer)
  else Reflect.deleteProperty(navigator, 'pdfViewerEnabled')
})

it('should draw and reopen Chinese PDFs without Promise.withResolvers or a native PDF viewer', async () => {
  // This file has its own browser context; PDF.js has not been imported yet.
  Reflect.deleteProperty(Promise, 'withResolvers')
  Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: false })
  const source = new URL('../../test/fixtures/chinese-cid-font.pdf', import.meta.url).href
  const preview = (file: string) => (
    <FilePreview open title="PDF 兼容预览" source={file} fileName="中文材料.pdf" />
  )
  const view = render(preview(source))

  const expectDrawn = async () => {
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 10_000 })
    const dialog = screen.getByRole('dialog')
    const canvas = dialog.querySelector('canvas')!
    expect(canvas).toBeTruthy()
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 3] > 0 && pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180) ink++
    expect(ink).toBeGreaterThan(1000)
    expect(dialog.querySelector('iframe')).toBeNull()
  }

  await expectDrawn()
  view.unmount()
  render(preview(source))
  await expectDrawn()
}, 25_000)
