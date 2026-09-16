import { describe, expect, it } from '@rstest/core'
import {
  createPdfPreviewFallbackState,
  reducePdfPreviewFallbackState,
} from './pdf-preview-fallback'

describe('PDF preview fallback reducer', () => {
  it('advances PDF.js to native and then download once per session', () => {
    const initial = createPdfPreviewFallbackState('/file.pdf', 2)
    const native = reducePdfPreviewFallbackState(initial, {
      type: 'pdfjs-error',
      source: '/file.pdf',
      session: 2,
      nativeSupported: true,
    })
    expect(native.renderer).toBe('native')
    expect(
      reducePdfPreviewFallbackState(native, {
        type: 'native-error',
        source: '/file.pdf',
        session: 2,
      }).renderer
    ).toBe('download')
  })

  it('ignores stale source and session errors', () => {
    const initial = createPdfPreviewFallbackState('/file.pdf', 2)
    expect(
      reducePdfPreviewFallbackState(initial, {
        type: 'pdfjs-error',
        source: '/old.pdf',
        session: 1,
        nativeSupported: true,
      })
    ).toBe(initial)
  })
})
