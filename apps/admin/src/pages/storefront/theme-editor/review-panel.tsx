import { localizeThemeError } from '../theme-feedback'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Tag,
} from 'antd'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import { useI18n } from '../../../shared/contexts/i18n-context'
import {
  approveStorefrontExperienceDraft,
  createStorefrontPreviewGrant,
  fetchStorefrontPreviewBuild,
  fetchStorefrontPreviewContext,
  previewStorefrontExperienceDraft,
  storefrontPreviewOrigin,
  validateStorefrontExperienceDraft,
  type StorefrontExperienceDraft,
  type StorefrontExperienceSnapshot,
  type StorefrontPreviewResolution,
} from '../../../services/storefront/api'
import { StorefrontPublicationPanel } from '../storefront-publication-panel'

void React
export const EditorReviewPanel = ({
  draft,
  releaseId,
  dirty,
  sourceReady = true,
  onSelect,
}: {
  draft: StorefrontExperienceDraft
  releaseId: string
  dirty: boolean
  sourceReady?: boolean
  onSelect: (id: string) => void
}) => {
  const { t } = useI18n(),
    { message } = App.useApp(),
    { role, permissions } = useAuth()
  const canWrite = hasPermission(role, 'themes.write', permissions)
  const canPreview = hasPermission(role, 'themes.preview', permissions)
  const canApprove = hasPermission(role, 'themes.approve', permissions)
  const scope = `${draft.id}:${draft.version}:${releaseId}`
  const blocked = dirty || !sourceReady
  const current = useRef({ scope, dirty: blocked })
  useLayoutEffect(() => {
    current.current = { scope, dirty: blocked }
  })
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const [preview, setPreview] = useState<{
    scope: string
    result: StorefrontPreviewResolution
  } | null>(null)
  const [issues, setIssues] = useState<{
    scope: string
    values: Array<{ instanceId?: string; path?: string; message: string }>
  } | null>(null)
  const [approval, setApproval] = useState<{
    scope: string
    snapshot: StorefrontExperienceSnapshot
  } | null>(null)
  const [confirmScope, setConfirmScope] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const result = preview?.scope === scope ? preview.result : null
  useEffect(() => {
    let active = true
    if (canPreview && releaseId)
      void fetchStorefrontPreviewContext(draft.id, draft.version, releaseId)
        .then((result) => {
          if (active) {
            setPreview(result ? { scope, result } : null)
            setError(null)
          }
        })
        .catch((cause) => {
          if (active) setError(cause)
        })
    return () => {
      active = false
    }
  }, [scope, draft.id, draft.version, releaseId, canPreview, restoreAttempt])
  useEffect(() => {
    if (!result || !['pending', 'building'].includes(result.build.status)) return
    let active = true
    const timer = window.setInterval(
      () =>
        void fetchStorefrontPreviewBuild(result.build.id)
          .then((build) => {
            if (active && current.current.scope === scope)
              setPreview({ scope, result: { ...result, build } })
          })
          .catch((cause) => {
            if (active) setError(cause)
          }),
      2000
    )
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [result, scope, t])
  const run = async (action: () => Promise<void>) => {
    if (lock.current || blocked || !releaseId) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      if (current.current.scope === scope) setError(cause)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const review = () =>
    run(async () => {
      const validation = await validateStorefrontExperienceDraft(
        draft.id,
        draft.version,
        '',
        releaseId
      )
      if (current.current.scope !== scope || current.current.dirty) return
      setIssues({ scope, values: validation.issues })
      if (validation.status !== 'valid') return
      const next = await previewStorefrontExperienceDraft(draft.id, draft.version, '', releaseId)
      if (current.current.scope === scope && !current.current.dirty)
        setPreview({ scope, result: next })
    })
  return (
    <Space orientation="vertical" className="w-full" size="middle">
      <Card title={t('Review saved design')}>
        <Space orientation="vertical" className="w-full">
          {dirty ? (
            <Alert type="info" title={t('Save your changes before formal review.')} />
          ) : null}
          {!sourceReady ? (
            <Alert type="info" title={t('Connect published resources before formal review.')} />
          ) : null}
          {error ? (
            <Alert
              type="error"
              title={t('Review could not be completed')}
              description={localizeThemeError(error, t)}
              action={
                <Button
                  disabled={busy || !canPreview}
                  onClick={() => setRestoreAttempt((value) => value + 1)}
                >
                  {t('Retry')}
                </Button>
              }
            />
          ) : null}
          <Space wrap>
            <Button
              disabled={!canWrite || !canPreview || blocked || busy || !releaseId}
              loading={busy}
              onClick={() => void review()}
            >
              {t('Build formal preview')}
            </Button>
            <Button
              disabled={
                !canPreview ||
                blocked ||
                busy ||
                result?.build.status !== 'deployed' ||
                !storefrontPreviewOrigin()
              }
              onClick={() =>
                void run(async () => {
                  if (!result) return
                  const grant = await createStorefrontPreviewGrant(
                    result.snapshot.id,
                    storefrontPreviewOrigin()!,
                    '',
                    releaseId
                  )
                  if (current.current.scope !== scope || current.current.dirty) return
                  const form = document.createElement('form')
                  form.method = 'POST'
                  form.action = grant.redeemUrl
                  form.target = '_blank'
                  form.rel = 'noopener'
                  const input = document.createElement('input')
                  input.type = 'hidden'
                  input.name = 'grant'
                  input.value = grant.grant
                  form.append(input)
                  document.body.append(form)
                  form.submit()
                  form.remove()
                })
              }
            >
              {t('Open authenticated preview')}
            </Button>
            <Button
              disabled={!canApprove || blocked || busy || result?.build.status !== 'deployed'}
              onClick={() => {
                setReason('')
                setConfirmScope(scope)
              }}
            >
              {t('Approve saved design')}
            </Button>
            {result ? <Tag>{result.build.status}</Tag> : null}
            {approval?.scope === scope && !dirty ? (
              <Tag color="success">{t('Approved')}</Tag>
            ) : null}
          </Space>
          {issues?.scope === scope
            ? issues.values.map((issue, index) => (
                <Button
                  key={index}
                  type="link"
                  className="!h-auto whitespace-normal text-left"
                  onClick={() => onSelect(issue.instanceId ?? issue.path?.split('.')[0] ?? '')}
                >
                  {issue.message}
                </Button>
              ))
            : null}
        </Space>
      </Card>
      <StorefrontPublicationPanel
        draft={draft}
        selectedReleaseId={releaseId}
        dirty={blocked}
        busy={busy}
        refreshToken={approval?.snapshot.sourceDraftVersion ?? 0}
        retainedApproval={approval?.scope === scope ? approval.snapshot : null}
      />
      <Collapse
        items={[
          {
            key: 'details',
            label: t('Version details'),
            children: (
              <Descriptions
                size="small"
                column={1}
                styles={{ content: { overflowWrap: 'anywhere' } }}
                items={[
                  { key: 'draft', label: t('Draft identity'), children: draft.id },
                  { key: 'version', label: t('Version'), children: draft.version },
                  {
                    key: 'theme',
                    label: t('Theme package'),
                    children: `${draft.themeId}@${draft.themeVersion}`,
                  },
                  { key: 'catalog', label: t('Catalog version'), children: releaseId || '—' },
                  { key: 'snapshot', label: t('Snapshot'), children: result?.snapshot.id ?? '—' },
                  { key: 'build', label: t('Build'), children: result?.build.status ?? '—' },
                ]}
              />
            ),
          },
        ]}
      />
      <Modal
        title={t('Approve saved design')}
        open={confirmScope !== null}
        confirmLoading={busy}
        closable={!busy}
        mask={{ closable: !busy }}
        keyboard={!busy}
        okButtonProps={{ disabled: blocked || confirmScope !== scope || reason.trim().length < 3 }}
        onCancel={() => {
          if (!lock.current) setConfirmScope(null)
        }}
        onOk={() =>
          void run(async () => {
            if (
              !canApprove ||
              confirmScope !== scope ||
              reason.trim().length < 3 ||
              result?.build.status !== 'deployed'
            )
              return
            const snapshot = await approveStorefrontExperienceDraft(
              draft.id,
              draft.version,
              reason.trim(),
              releaseId
            )
            if (current.current.scope !== scope || current.current.dirty) return
            setApproval({ scope, snapshot })
            setConfirmScope(null)
            void message.success(t('Approved'))
          })
        }
      >
        <Form layout="vertical">
          <Form.Item label={t('Reason')} required>
            <Input.TextArea
              aria-label={t('Reason')}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
