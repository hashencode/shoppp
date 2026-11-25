import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alert, Button, Space, Tag } from 'antd'
import {
  editorChildMessageSchema,
  isEditorMessageSource,
  type EditorDocument,
  type EditorParentMessage,
} from '@shoppp/contracts'
import { apiClient } from '../../../infrastructure/http/api-client'
import { useI18n } from '../../../shared/contexts/i18n-context'

void React
type Identity = { id: string; nonce: string; expiresAt: string }
type Props = {
  draftId: string
  releaseId: string
  revision: number
  document: EditorDocument
  templateId: string
  selectedId: string
  path: string
  mode: 'inspect' | 'browse'
  width: number | '100%'
  onSelect: (id: string) => void
  onNavigate: (path: string) => void
}

export const EditorPreviewPane = (props: Props) => {
  const { t } = useI18n()
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })
  const connection = useRef<{ identity: Identity; scope: string; initialized: boolean } | null>(
    null
  )
  const generation = useRef(0)
  const [ready, setReady] = useState(0)
  const [applied, setApplied] = useState<{ scope: string; revision: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scope = `${props.draftId}:${props.releaseId}`
  const post = useCallback(
    (message: EditorParentMessage) =>
      frame.current?.contentWindow?.postMessage(message, window.location.origin),
    []
  )
  const send = useCallback(() => {
    const current = connection.current,
      value = latest.current
    if (!current?.initialized || current.scope !== `${value.draftId}:${value.releaseId}`) return
    post({
      kind: 'update',
      protocol: 1,
      sessionId: current.identity.id,
      nonce: current.identity.nonce,
      revision: value.revision,
      document: value.document,
      templateId: value.templateId,
      selectedId: value.selectedId,
      path: value.path,
      mode: value.mode,
    })
  }, [post])
  const connect = useCallback(async () => {
    const value = latest.current,
      request = ++generation.current
    connection.current = null
    if (!value.releaseId) return
    try {
      const response = await apiClient.post<{ data: Identity }>(
        `/admin/storefront-experiences/drafts/${value.draftId}/editor-sessions`,
        { catalogReleaseId: value.releaseId }
      )
      if (request !== generation.current) return
      connection.current = {
        identity: response.data.data,
        scope: `${value.draftId}:${value.releaseId}`,
        initialized: false,
      }
      setError(null)
      post({
        kind: 'initialize',
        protocol: 1,
        sessionId: response.data.data.id,
        nonce: response.data.data.nonce,
      })
    } catch (cause) {
      if (request === generation.current)
        setError(cause instanceof Error ? cause.message : t('Preview unavailable'))
    }
  }, [post, t])
  const connectRef = useRef(connect)
  useLayoutEffect(() => {
    connectRef.current = connect
  })
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        !isEditorMessageSource(event, window.location.origin, frame.current?.contentWindow ?? null)
      )
        return
      const parsed = editorChildMessageSchema.safeParse(event.data)
      if (!parsed.success) return
      const message = parsed.data
      if (message.kind === 'ready') {
        setReady((value) => value + 1)
        return
      }
      const current = connection.current
      if (
        !current ||
        message.sessionId !== current.identity.id ||
        message.nonce !== current.identity.nonce
      )
        return
      if (message.kind === 'applied' && message.revision === 0) {
        current.initialized = true
        send()
        return
      }
      if (message.kind === 'error' && message.revision === 0 && !current.initialized) {
        setError(message.message)
        return
      }
      if (message.revision !== latest.current.revision) return
      if (message.kind === 'applied') {
        setApplied({ scope: current.scope, revision: message.revision })
        setError(null)
      } else if (message.kind === 'error') setError(message.message)
      else if (message.kind === 'select') latest.current.onSelect(message.instanceId)
      else if (message.kind === 'navigate') latest.current.onNavigate(message.path)
    }
    window.addEventListener('message', receive)
    return () => {
      generation.current++
      connection.current = null
      window.removeEventListener('message', receive)
    }
  }, [send])
  useEffect(() => {
    if (ready) void connectRef.current()
    return () => {
      generation.current++
      connection.current = null
    }
  }, [scope, ready])
  useEffect(() => {
    send()
  }, [
    props.document,
    props.revision,
    props.templateId,
    props.path,
    props.mode,
    props.selectedId,
    send,
  ])
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t('Design preview')}>
      <Space wrap>
        <Tag
          color={
            applied?.scope === scope && applied.revision === props.revision && !error
              ? 'success'
              : 'default'
          }
        >
          {t(
            applied?.scope === scope && applied.revision === props.revision && !error
              ? 'Preview updated'
              : 'Preview not updated'
          )}
        </Tag>
        <Button size="small" onClick={() => void connect()} disabled={!props.releaseId}>
          {t('Reconnect preview')}
        </Button>
      </Space>
      {error ? <Alert type="warning" title={t('Preview unavailable')} description={error} /> : null}
      {!props.releaseId ? (
        <Alert type="info" title={t('Choose published sources to preview the store.')} />
      ) : null}
      <div
        className="min-w-0 overflow-auto rounded-lg border border-solid p-2"
        style={{
          background: 'var(--ant-color-fill-tertiary)',
          borderColor: 'var(--ant-color-border)',
        }}
      >
        <iframe
          ref={frame}
          title={t('Design preview')}
          src="/theme-editor/"
          sandbox="allow-scripts allow-same-origin"
          className="block min-h-[640px] max-w-none border-0 bg-white"
          style={{ width: props.width, marginInline: 'auto' }}
        />
      </div>
    </section>
  )
}
