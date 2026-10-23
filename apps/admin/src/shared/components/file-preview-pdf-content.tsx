import { Alert } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import { useI18n } from '../contexts/i18n-context'

void React

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const PDF_PAGE_MAX_WIDTH = 800
const PDF_PAGE_HORIZONTAL_PADDING = 32

const useResponsivePdfPageWidth = (open: boolean) => {
  const observerRef = useRef<ResizeObserver | null>(null)
  const [pageWidth, setPageWidth] = useState(PDF_PAGE_MAX_WIDTH)

  const previewContainerRef = useCallback(
    (container: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null

      if (!open || !container) {
        return
      }

      const updatePageWidth = (containerWidth: number) => {
        setPageWidth(
          Math.min(
            PDF_PAGE_MAX_WIDTH,
            Math.max(1, Math.floor(containerWidth - PDF_PAGE_HORIZONTAL_PADDING))
          )
        )
      }

      const initialWidth = container.clientWidth
      if (initialWidth > 0) {
        updatePageWidth(initialWidth)
      }

      observerRef.current = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width
        if (width && width > 0) {
          updatePageWidth(width)
        }
      })
      observerRef.current.observe(container)
    },
    [open]
  )

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  return { pageWidth, previewContainerRef }
}

type FilePreviewPdfContentProps = {
  open: boolean
  source: string
  onError: () => void
  onReady: () => void
}

export const FilePreviewPdfContent = ({
  open,
  source,
  onError,
  onReady,
}: FilePreviewPdfContentProps) => {
  const { t } = useI18n()
  const [numPages, setNumPages] = useState<number>()
  const { pageWidth, previewContainerRef } = useResponsivePdfPageWidth(open)

  return (
    <div ref={previewContainerRef} className="h-full overflow-y-auto overflow-x-hidden">
      {open ? (
        <Document
          file={source}
          loading={null}
          error={
            <div className="flex h-full items-center justify-center p-6">
              <Alert
                showIcon
                type="warning"
                title={t('PDF preview failed')}
                description={t('Online preview is unavailable. Download the file to view it.')}
              />
            </div>
          }
          onLoadError={onError}
          onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
        >
          {Array.from({ length: numPages ?? 0 }, (_, index) => (
            <div key={`page_${index + 1}`} className="mb-4 flex justify-center last:mb-0">
              <Page
                loading={null}
                pageNumber={index + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onLoadError={onError}
                onRenderError={onError}
                onRenderSuccess={index === 0 ? onReady : undefined}
              />
            </div>
          ))}
        </Document>
      ) : null}
    </div>
  )
}
