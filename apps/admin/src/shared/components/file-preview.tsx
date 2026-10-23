import { DownloadOutlined } from '@ant-design/icons'
import { Alert, Button, Image, Modal, Spin, App, theme } from 'antd'
import type { ModalProps } from 'antd'
import React, {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { downloadBlob } from '../utils/download'
import { useCurrentTranslate, useI18n } from '../contexts/i18n-context'
import {
  buildNativePdfUrl,
  createPdfPreviewFallbackState,
  reducePdfPreviewFallbackState,
  supportsNativePdfPreview,
} from './pdf-preview-fallback'

void React

type FilePreviewType = 'image' | 'pdf' | 'video' | 'unknown'
type VideoSourceKind = 'hls' | 'mp4'

type LazyVideoPlayerProps = {
  source: string
  sourceKind: VideoSourceKind
  primaryColor: string
  onError: (message: string) => void
}

type RendererErrorState = {
  previewKey: string
  message: string
}

export type FilePreviewProps = {
  title: string
  source?: string | null
  fileName?: string
  contentType?: string
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modalStyles?: ModalProps['styles']
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const VIDEO_EXTENSIONS = new Set(['m3u8', 'mp4', 'm4v', 'mov'])
const IMAGE_CONTENT_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])
const MP4_CONTENT_TYPES = new Set([
  'application/mp4',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
])
const HLS_CONTENT_TYPES = new Set(['application/vnd.apple.mpegurl', 'application/x-mpegurl'])
const GENERIC_CONTENT_TYPES = new Set(['application/octet-stream', 'binary/octet-stream'])
const NATIVE_PDF_FETCH_TIMEOUT_MS = 15_000

const stripQueryAndHash = (value: string) => value.split(/[?#]/)[0] || value

const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizeContentType = (contentType?: string) =>
  contentType?.split(';')[0]?.trim().toLowerCase() || ''

const readExtension = (value?: string | null) => {
  if (!value?.trim()) {
    return ''
  }

  const path = (() => {
    try {
      return new URL(value, window.location.origin).pathname
    } catch {
      return stripQueryAndHash(value)
    }
  })()
  return (
    decodePath(stripQueryAndHash(path))
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/)?.[1] || ''
  )
}

const resolveTypeFromExtension = (extension: string): FilePreviewType => {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  }
  if (extension === 'pdf') {
    return 'pdf'
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  return 'unknown'
}

const resolveFilePreviewType = ({
  contentType,
  fileName,
  source,
}: Pick<FilePreviewProps, 'contentType' | 'fileName' | 'source'>): FilePreviewType => {
  const normalizedContentType = normalizeContentType(contentType)
  if (normalizedContentType && !GENERIC_CONTENT_TYPES.has(normalizedContentType)) {
    if (IMAGE_CONTENT_TYPES.has(normalizedContentType)) {
      return 'image'
    }
    if (normalizedContentType === 'application/pdf') {
      return 'pdf'
    }
    if (
      MP4_CONTENT_TYPES.has(normalizedContentType) ||
      HLS_CONTENT_TYPES.has(normalizedContentType)
    ) {
      return 'video'
    }
    return 'unknown'
  }

  const fileNameType = resolveTypeFromExtension(readExtension(fileName))
  if (fileNameType !== 'unknown') {
    return fileNameType
  }

  return resolveTypeFromExtension(readExtension(source))
}

const resolveVideoSourceKind = ({
  contentType,
  fileName,
  source,
}: Pick<FilePreviewProps, 'contentType' | 'fileName' | 'source'>): VideoSourceKind => {
  const normalizedContentType = normalizeContentType(contentType)
  if (HLS_CONTENT_TYPES.has(normalizedContentType)) {
    return 'hls'
  }
  if (MP4_CONTENT_TYPES.has(normalizedContentType)) {
    return 'mp4'
  }

  const extension = readExtension(fileName) || readExtension(source)
  return extension === 'm3u8' ? 'hls' : 'mp4'
}

const normalizeSource = (source?: string | null) => {
  const normalized = source?.trim() || ''
  if (!normalized) {
    return { source: '', allowed: false, fallbackAllowed: false, inlineOnly: false }
  }

  if (/^(blob:|data:)/i.test(normalized)) {
    return { source: normalized, allowed: true, fallbackAllowed: false, inlineOnly: true }
  }

  if (/^(https?:)?\/\//i.test(normalized) || /^(\/|\.\/|\.\.\/)/.test(normalized)) {
    return { source: normalized, allowed: true, fallbackAllowed: true, inlineOnly: false }
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(normalized)) {
    return { source: normalized, allowed: false, fallbackAllowed: false, inlineOnly: false }
  }

  return { source: normalized, allowed: true, fallbackAllowed: true, inlineOnly: false }
}

const readFileNameFromSource = (source: string) => {
  const rawName = stripQueryAndHash(source).split('/').pop() || ''
  return decodePath(rawName)
}

const withExpectedExtension = (fileName: string, type: FilePreviewType) => {
  if (!fileName || readExtension(fileName)) {
    return fileName
  }
  if (type === 'pdf') {
    return `${fileName}.pdf`
  }
  return fileName
}

const buildDownloadFileName = (
  source: string,
  fileName: string | undefined,
  type: FilePreviewType
) => withExpectedExtension(fileName?.trim() || readFileNameFromSource(source) || 'File', type)

const downloadPreviewFile = async ({
  source,
  fileName,
  fallbackAllowed,
}: {
  source: string
  fileName: string
  fallbackAllowed: boolean
}) => {
  await downloadBlob({
    request: async () => {
      const response = await fetch(source, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('File download failed')
      }

      return {
        data: await response.blob(),
        headers: response.headers,
      }
    },
    fallbackFileName: fileName,
    fallbackUrl: fallbackAllowed ? source : undefined,
  })
}

const FilePreviewUnavailable = ({ title, description }: { title: string; description: string }) => (
  <div className="flex min-h-[360px] items-center justify-center p-6">
    <Alert showIcon type="warning" title={title} description={description} />
  </div>
)

type LazyPdfContentProps = {
  open: boolean
  source: string
  onError: () => void
  onReady: () => void
}

class PdfRendererErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

const FilePreviewPdfContentLoader = ({ open, source, onError, onReady }: LazyPdfContentProps) => {
  const [PdfContent, setPdfContent] = useState<ComponentType<LazyPdfContentProps> | null>(null)

  useEffect(() => {
    let active = true
    void import('./file-preview-pdf-content')
      .then((module) => {
        if (active) setPdfContent(() => module.FilePreviewPdfContent)
      })
      .catch(() => {
        if (active) onError()
      })
    return () => {
      active = false
    }
  }, [onError])

  if (!PdfContent) {
    return null
  }

  return (
    <PdfRendererErrorBoundary onError={onError}>
      <PdfContent open={open} source={source} onError={onError} onReady={onReady} />
    </PdfRendererErrorBoundary>
  )
}

const NativePdfFrame = ({
  source,
  title,
  onError,
  onReady,
}: {
  source: string
  title: string
  onError: () => void
  onReady: () => void
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameSource, setFrameSource] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    let abortReason: 'cleanup' | 'timeout' | null = null
    const timeoutId = window.setTimeout(() => {
      abortReason = 'timeout'
      controller.abort()
      onError()
    }, NATIVE_PDF_FETCH_TIMEOUT_MS)

    void fetch(source, { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`PDF request failed with status ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        const pdfBlob =
          blob.type === 'application/pdf' ? blob : blob.slice(0, blob.size, 'application/pdf')
        objectUrl = URL.createObjectURL(pdfBlob)
        setFrameSource(buildNativePdfUrl(objectUrl))
      })
      .catch(() => {
        if (abortReason === null) onError()
      })
      .finally(() => window.clearTimeout(timeoutId))

    return () => {
      window.clearTimeout(timeoutId)
      abortReason = 'cleanup'
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [onError, source])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || !frameSource) return
    frame.addEventListener('error', onError)
    frame.src = frameSource
    onReady()
    return () => frame.removeEventListener('error', onError)
  }, [frameSource, onError, onReady])

  if (!frameSource) {
    return null
  }

  return <iframe ref={frameRef} title={title} className="h-full w-full border-0" />
}

const FilePreviewPdf = ({
  open,
  source,
  session,
  title,
}: {
  open: boolean
  source: string
  session: number
  title: string
}) => {
  const { t } = useI18n()
  const { token } = theme.useToken()
  const [pdfReady, setPdfReady] = useState(false)
  const [nativeReady, setNativeReady] = useState(false)
  const handlePdfReady = useCallback(() => setPdfReady(true), [])
  const handleNativeReady = useCallback(() => setNativeReady(true), [])
  const [rendererState, dispatchRendererEvent] = useReducer(
    reducePdfPreviewFallbackState,
    undefined,
    () => createPdfPreviewFallbackState(source, session)
  )
  const handlePdfRendererError = useCallback(() => {
    dispatchRendererEvent({
      type: 'pdfjs-error',
      source,
      session,
      nativeSupported: supportsNativePdfPreview(),
    })
  }, [session, source])
  const handleNativePdfError = useCallback(() => {
    dispatchRendererEvent({ type: 'native-error', source, session })
  }, [session, source])

  if (rendererState.renderer === 'download') {
    return (
      <FilePreviewUnavailable
        title={t('PDF preview failed')}
        description={t('Online preview is unavailable. Download the file to view it.')}
      />
    )
  }
  const loading = rendererState.renderer === 'native' ? !nativeReady : !pdfReady

  return (
    <div
      className="relative h-[70vh] min-h-[480px] overflow-hidden rounded-md border border-solid"
      aria-busy={loading}
      style={{
        backgroundColor: token.colorBgLayout,
        borderColor: token.colorBorderSecondary,
      }}
    >
      {loading ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: token.colorBgLayout }}
          role="status"
        >
          <Spin description={t('Loading PDF preview')} />
        </div>
      ) : null}
      {rendererState.renderer === 'native' ? (
        <NativePdfFrame
          source={source}
          title={title}
          onError={handleNativePdfError}
          onReady={handleNativeReady}
        />
      ) : (
        <FilePreviewPdfContentLoader
          open={open}
          source={source}
          onError={handlePdfRendererError}
          onReady={handlePdfReady}
        />
      )}
    </div>
  )
}

const FilePreviewVideoContent = ({
  source,
  sourceKind,
  primaryColor,
  onError,
}: LazyVideoPlayerProps) => {
  const { t } = useI18n()
  const [VideoPlayer, setVideoPlayer] = useState<ComponentType<LazyVideoPlayerProps> | null>(null)

  useEffect(() => {
    let active = true

    void import('./video-player')
      .then((module) => {
        if (active) {
          setVideoPlayer(() => module.VideoPlayer)
        }
      })
      .catch(() => {
        if (active) {
          onError(t('Video preview failed'))
        }
      })

    return () => {
      active = false
    }
  }, [onError, t])

  if (!VideoPlayer) {
    return (
      <div className="flex min-h-[360px] items-center justify-center" role="status">
        <Spin description={t('Loading video preview')} />
      </div>
    )
  }

  return (
    <VideoPlayer
      source={source}
      sourceKind={sourceKind}
      primaryColor={primaryColor}
      onError={onError}
    />
  )
}

export const FilePreview = ({
  title,
  source,
  fileName,
  contentType,
  trigger,
  open: controlledOpen,
  onOpenChange,
  modalStyles,
}: FilePreviewProps) => {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const [innerOpen, setInnerOpen] = useState(false)
  const [downloadLoadingKey, setDownloadLoadingKey] = useState('')
  const [rendererErrorState, setRendererErrorState] = useState<RendererErrorState | null>(null)
  const [previewSession, setPreviewSession] = useState(0)
  const normalizedSource = useMemo(() => normalizeSource(source), [source])
  const previewType = useMemo(
    () => resolveFilePreviewType({ contentType, fileName, source: normalizedSource.source }),
    [contentType, fileName, normalizedSource.source]
  )
  const sourceAllowed =
    normalizedSource.allowed && (!normalizedSource.inlineOnly || previewType !== 'unknown')
  const previewKey = `${normalizedSource.source}:${previewType}`
  const downloadLoading = downloadLoadingKey === previewKey
  const rendererError =
    rendererErrorState?.previewKey === previewKey ? rendererErrorState.message : ''
  const videoSourceKind = useMemo(
    () =>
      resolveVideoSourceKind({
        contentType,
        fileName,
        source: normalizedSource.source,
      }),
    [contentType, fileName, normalizedSource.source]
  )
  const open = controlledOpen ?? innerOpen
  const downloadFileName = useMemo(
    () => buildDownloadFileName(normalizedSource.source, fileName, previewType),
    [fileName, normalizedSource.source, previewType]
  )

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInnerOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
      if (!nextOpen) {
        setDownloadLoadingKey('')
        setRendererErrorState(null)
        setPreviewSession((current) => current + 1)
      }
    },
    [controlledOpen, onOpenChange]
  )

  const handleRendererError = useCallback(
    (messageText: string) => setRendererErrorState({ previewKey, message: messageText }),
    [previewKey]
  )

  const handleTriggerClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    if (!sourceAllowed) {
      return
    }
    setOpen(true)
  }

  const handleDownload = async () => {
    if (!sourceAllowed || !normalizedSource.source) {
      return
    }

    const downloadSource = normalizedSource.source
    const activeDownloadKey = previewKey
    setDownloadLoadingKey(activeDownloadKey)
    try {
      await downloadPreviewFile({
        source: downloadSource,
        fileName: downloadFileName,
        fallbackAllowed: normalizedSource.fallbackAllowed,
      })
    } catch {
      void message.error(translateNow('File download failed. Please try again later.'))
    } finally {
      setDownloadLoadingKey((current) => (current === activeDownloadKey ? '' : current))
    }
  }

  const imageOpen = open && sourceAllowed && previewType === 'image' && !rendererError
  const modalOpen = open && sourceAllowed && !imageOpen
  const hasModalSession = modalOpen || (previewSession > 0 && previewType !== 'image')

  return (
    <>
      {trigger !== null ? (
        <span className="inline-flex" onClick={handleTriggerClick}>
          {trigger ?? (
            <Button
              type="link"
              disabled={!sourceAllowed}
              className="!px-0 hover:!bg-transparent active:!bg-transparent"
            >
              {t('Preview')}
            </Button>
          )}
        </span>
      ) : null}

      {open && sourceAllowed && previewType === 'image' ? (
        <Image
          key={`${normalizedSource.source}:${previewSession}`}
          alt={fileName || t('File preview image')}
          styles={{ root: { display: 'none' } }}
          preview={{
            open: imageOpen,
            focusTrap: true,
            onOpenChange: (nextOpen) => setOpen(nextOpen),
            afterOpenChange: (visible) => {
              if (!visible && imageOpen) {
                setOpen(false)
              }
            },
            actionsRender: (originalNode) => (
              <>
                {originalNode}
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  loading={downloadLoading}
                  aria-label={t('Download file')}
                  title={t('Download file')}
                  onClick={() => {
                    void handleDownload()
                  }}
                />
              </>
            ),
          }}
          src={normalizedSource.source}
          onError={() => handleRendererError(t('Image preview failed'))}
        />
      ) : null}

      {hasModalSession ? (
        <Modal
          open={modalOpen}
          title={title}
          width={960}
          styles={modalStyles}
          destroyOnHidden
          onCancel={() => setOpen(false)}
          footer={[
            <Button
              key="download"
              icon={<DownloadOutlined />}
              loading={downloadLoading}
              disabled={!sourceAllowed}
              onClick={() => {
                void handleDownload()
              }}
            >
              {t('Download file')}
            </Button>,
            <Button key="close" type="primary" onClick={() => setOpen(false)}>
              {t('Close')}
            </Button>,
          ]}
        >
          {modalOpen && rendererError ? (
            <FilePreviewUnavailable
              title={rendererError}
              description={t('Online preview is unavailable. Download the file to view it.')}
            />
          ) : null}
          {modalOpen && !rendererError && previewType === 'pdf' ? (
            <FilePreviewPdf
              key={`${normalizedSource.source}:${previewSession}`}
              open={modalOpen}
              source={normalizedSource.source}
              session={previewSession}
              title={title}
            />
          ) : null}
          {modalOpen && !rendererError && previewType === 'video' ? (
            <FilePreviewVideoContent
              key={`${normalizedSource.source}:${previewSession}`}
              source={normalizedSource.source}
              sourceKind={videoSourceKind}
              primaryColor={token.colorPrimary}
              onError={handleRendererError}
            />
          ) : null}
          {modalOpen && !rendererError && previewType === 'unknown' ? (
            <FilePreviewUnavailable
              title={t('Online preview is not supported')}
              description={t(
                'This file type cannot be previewed online. Download the file to view it.'
              )}
            />
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}
