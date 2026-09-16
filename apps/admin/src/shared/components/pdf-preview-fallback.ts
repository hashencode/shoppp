export type PdfPreviewRenderer = 'pdfjs' | 'native' | 'download'

export type PdfPreviewFallbackState = {
  source: string
  session: number
  renderer: PdfPreviewRenderer
}

export type PdfPreviewFallbackEvent =
  | { type: 'pdfjs-error'; source: string; session: number; nativeSupported: boolean }
  | { type: 'native-error'; source: string; session: number }

export const createPdfPreviewFallbackState = (
  source: string,
  session: number
): PdfPreviewFallbackState => ({ source, session, renderer: 'pdfjs' })

export const reducePdfPreviewFallbackState = (
  state: PdfPreviewFallbackState,
  event: PdfPreviewFallbackEvent
): PdfPreviewFallbackState => {
  if (event.source !== state.source || event.session !== state.session) return state

  if (event.type === 'pdfjs-error') {
    if (state.renderer !== 'pdfjs') return state
    return {
      source: state.source,
      session: state.session,
      renderer: event.nativeSupported ? 'native' : 'download',
    }
  }

  if (state.renderer !== 'native') return state
  return { source: state.source, session: state.session, renderer: 'download' }
}

export const supportsNativePdfPreview = () =>
  typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true

export const buildNativePdfUrl = (source: string) =>
  `${source}${source.includes('#') ? '&' : '#'}toolbar=0&navpanes=0`
