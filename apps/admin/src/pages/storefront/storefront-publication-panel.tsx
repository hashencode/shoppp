import React, { useEffect, useRef, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import {
  sameStorefrontPublicationIdentity,
  type StorefrontPublication,
  type StorefrontPublicationContext,
  type StorefrontPublicationIdentity,
} from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import {
  fetchStorefrontPublicationContext,
  publishStorefront,
  rollbackStorefrontPublication,
  type StorefrontExperienceDraft,
  type StorefrontExperienceSnapshot,
} from '../../services/storefront/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import { themeErrorCode } from './theme-feedback'

import { useFormDialog } from '../../shared/hooks/use-form-dialog'

void React

type Props = {
  draft: StorefrontExperienceDraft
  selectedReleaseId?: string
  dirty: boolean
  busy: boolean
  refreshToken: number
  retainedApproval?: StorefrontExperienceSnapshot | null
}
type Confirmation =
  | { kind: 'publish'; identity: StorefrontPublicationIdentity; expectedActiveId: string | null }
  | { kind: 'rollback'; targetId: string; expectedActiveId: string }

const statusMessages: Record<StorefrontPublication['status'], string> = {
  queued: 'Publication queued',
  building: 'Publishing storefront',
  succeeded: 'Previously published',
  failed: 'Publication failed',
  unresolved: 'Publication needs verification',
}
const failureMessages: Record<string, string> = {
  storefront_publication_pending:
    'Another publication is in progress. Refresh its status before continuing.',
  storefront_publication_active_changed:
    'The online version changed. Refresh and review it before continuing.',
  storefront_publication_approval_stale:
    'The approved design changed. Reload the draft and approve the current version.',
  storefront_publication_approval_invalid:
    'The approved design is unavailable. Reload the draft and approve the current version.',
  storefront_publication_identity_mismatch:
    'The approved sources changed. Reload the draft before publishing.',
  storefront_publication_source_changed:
    'The approved sources changed. Reload the draft before publishing.',
  storefront_publication_contact_stale:
    'Store contact details changed. Prepare a new preview and approve it before publishing.',
  storefront_publication_candidate_unavailable:
    'The preview sources expired. Prepare a new preview and approve it before publishing.',
  storefront_publication_live_required:
    'Approve a design with published store sources before publishing.',
  storefront_publication_rollback_invalid:
    'This version cannot be restored. Refresh and choose a previously published version.',
  build_hook_failed: 'Publication could not start. Retry after the delivery service is available.',
  build_hook_not_configured: 'Ask an administrator to configure storefront delivery, then retry.',
  production_gate_required:
    'Production approval is required. Ask an administrator to complete the release approvals.',
}

export const StorefrontPublicationPanel = ({
  draft,
  selectedReleaseId,
  dirty,
  busy,
  refreshToken,
  retainedApproval,
}: Props) => {
  const { t, locale } = useI18n()
  const { role, permissions, principalKind } = useAuth()
  const canRead = principalKind === 'human' && hasPermission(role, 'themes.read', permissions)
  const canPublish = canRead && hasPermission(role, 'themes.publish', permissions)
  const scope = `${draft.id}:${draft.version}:${canRead}:${canPublish}`
  const [loaded, setLoaded] = useState<{
    scope: string
    context: StorefrontPublicationContext
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [refresh, setRefresh] = useState(0)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const request = useRef(0)
  const mutationBusy = useRef(false)
  const confirmationDialog = useFormDialog({
    open: confirmation !== null,
    onClose: () => {
      setConfirmation(null)
      setReason('')
    },
    getSubmission: () => reason.trim(),
  })

  useEffect(() => {
    const sequence = ++request.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoaded(null)
      setError(null)
      setConfirmation(null)
      setReason('')
      setSubmitting(false)
      setLoading(canRead)
      if (!canRead) return
      void fetchStorefrontPublicationContext(draft.id, controller.signal)
        .then((context) => {
          if (request.current === sequence && !controller.signal.aborted)
            setLoaded({ scope, context })
        })
        .catch((cause: unknown) => {
          if (request.current === sequence && !controller.signal.aborted) setError(cause)
        })
        .finally(() => {
          if (request.current === sequence && !controller.signal.aborted) setLoading(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      request.current += 1
    }
  }, [canRead, draft.id, scope, refresh, refreshToken])

  const context = canRead && loaded?.scope === scope ? loaded.context : null
  const approval = context?.approval
  const validation = draft.validations.find(({ id }) => id === approval?.sourceValidationId)
  const approvalCurrent = Boolean(
    approval &&
    approval.sourceDraftId === draft.id &&
    approval.sourceDraftVersion === draft.version &&
    validation?.status === 'valid' &&
    validation.draftVersion === draft.version &&
    (!selectedReleaseId || selectedReleaseId === approval.identity.catalogReleaseId) &&
    !dirty
  )
  const active = context?.active
  const activeVerified = active?.verification === 'verified' && Boolean(active.publication?.receipt)
  const thisDesignOnline = Boolean(
    activeVerified &&
    approvalCurrent &&
    approval &&
    active?.publication &&
    sameStorefrontPublicationIdentity(approval.identity, active.publication.identity)
  )
  const publications = context?.publications ?? []
  const pending = publications.find(({ status }) =>
    ['queued', 'building', 'unresolved'].includes(status)
  )
  const latest = publications[0]
  const activeReady = active?.verification === 'none' || activeVerified
  const eligible = Boolean(
    canPublish &&
    approvalCurrent &&
    activeReady &&
    !pending &&
    !busy &&
    !loading &&
    !submitting &&
    !thisDesignOnline
  )
  const rollbackTargets =
    activeVerified && !pending && !dirty && !busy && !loading && canPublish
      ? publications.filter(
          (item) =>
            item.status === 'succeeded' &&
            item.receipt &&
            item.environment === context?.environment &&
            item.id !== active?.publication?.id
        )
      : []
  const confirmationCurrent = Boolean(
    confirmation &&
    context &&
    canPublish &&
    !dirty &&
    !busy &&
    !loading &&
    !pending &&
    (confirmation.kind === 'publish'
      ? activeReady &&
        approvalCurrent &&
        approval &&
        !thisDesignOnline &&
        sameStorefrontPublicationIdentity(confirmation.identity, approval.identity) &&
        confirmation.expectedActiveId === (active?.publication?.id ?? null)
      : activeVerified &&
        confirmation.expectedActiveId === active?.publication?.id &&
        rollbackTargets.some(({ id }) => id === confirmation.targetId))
  )
  useEffect(() => {
    if (!confirmation || confirmationCurrent || submitting) return
    const timer = window.setTimeout(() => {
      setConfirmation(null)
      setReason('')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [confirmation, confirmationCurrent, submitting])

  const openPublish = () => {
    if (!eligible || !approval) return
    setError(null)
    setReason('')
    setConfirmation({
      kind: 'publish',
      identity: approval.identity,
      expectedActiveId: active?.publication?.id ?? null,
    })
  }
  const openRollback = (targetId: string) => {
    if (!active?.publication || !rollbackTargets.some(({ id }) => id === targetId)) return
    setError(null)
    setReason('')
    setConfirmation({ kind: 'rollback', targetId, expectedActiveId: active.publication.id })
  }
  const submit = async () => {
    if (
      !confirmation ||
      !confirmationCurrent ||
      mutationBusy.current ||
      !reason.trim() ||
      reason.trim().length > 500
    )
      return
    const sequence = request.current
    mutationBusy.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result =
        confirmation.kind === 'publish'
          ? await publishStorefront({
              draftId: draft.id,
              expectedVersion: draft.version,
              identity: confirmation.identity,
              expectedActivePublicationId: confirmation.expectedActiveId,
              reason: reason.trim(),
            })
          : await rollbackStorefrontPublication({
              targetPublicationId: confirmation.targetId,
              expectedActivePublicationId: confirmation.expectedActiveId,
              reason: reason.trim(),
            })
      if (request.current !== sequence) return
      setLoaded({
        scope,
        context: {
          ...context!,
          publications: [result, ...publications.filter(({ id }) => id !== result.id)],
        },
      })
      setConfirmation(null)
      setReason('')
      setRefresh((value) => value + 1)
    } catch (cause) {
      if (request.current === sequence) setError(cause)
    } finally {
      mutationBusy.current = false
      if (request.current === sequence) setSubmitting(false)
    }
  }
  const failureText = (code?: string | null) =>
    code && Object.hasOwn(failureMessages, code)
      ? t(failureMessages[code])
      : t('Publication did not complete. Refresh its status before retrying.')
  const errorCode = themeErrorCode(error)
  const details = approval ?? retainedApproval
  const retryPublish =
    latest?.status === 'failed' &&
    latest.operation === 'publish' &&
    approval &&
    sameStorefrontPublicationIdentity(latest.identity, approval.identity)
  if (!canRead) return null

  return (
    <Card title={t('Publish storefront')} className="min-w-0">
      <Space orientation="vertical" className="w-full min-w-0">
        {loading ? (
          <Space>
            <Spin size="small" />
            <span>{t('Checking publication status')}</span>
          </Space>
        ) : null}
        {error && !confirmationCurrent ? (
          <Alert
            type="error"
            showIcon
            title={t('Publication status could not be updated')}
            description={
              errorCode && Object.hasOwn(failureMessages, errorCode)
                ? t(failureMessages[errorCode])
                : localizeApiError(error, t)
            }
          />
        ) : null}
        {context ? (
          <>
            {activeVerified ? (
              <Space wrap>
                <Tag color="success">{t('Online')}</Tag>
                <span>
                  {t(
                    thisDesignOnline
                      ? 'This design is online'
                      : 'Current storefront version is verified'
                  )}
                </span>
              </Space>
            ) : active?.verification === 'none' ? (
              <Typography.Text type="secondary">{t('No formal publication yet')}</Typography.Text>
            ) : (
              <Alert
                type="warning"
                showIcon
                title={t('Online version could not be verified')}
                description={t(
                  active?.verification === 'mismatch'
                    ? 'The storefront differs from its activation receipt. Ask an administrator to verify delivery, then refresh.'
                    : 'The storefront could not be reached. Refresh to check the online version again.'
                )}
              />
            )}
            {pending ? (
              <Alert
                type={pending.status === 'unresolved' ? 'warning' : 'info'}
                showIcon
                title={t(statusMessages[pending.status])}
                description={
                  pending.status === 'unresolved'
                    ? t(
                        'Ask an administrator to verify or restore the storefront, then refresh. New publications are paused.'
                      )
                    : undefined
                }
              />
            ) : null}
            {!pending && latest?.status === 'failed' ? (
              <Alert
                type="error"
                showIcon
                title={t('Publication failed')}
                description={failureText(latest.failureCode)}
              />
            ) : null}
            {approvalCurrent && !pending && !thisDesignOnline ? (
              <Tag>{t('Approved, awaiting formal release')}</Tag>
            ) : null}
            {!approvalCurrent && !pending ? (
              <Typography.Text type="secondary">
                {t(
                  dirty
                    ? 'Save or discard edits before publishing.'
                    : 'Approve the current saved design before publishing.'
                )}
              </Typography.Text>
            ) : null}
            <Space wrap>
              {canPublish ? (
                <Button type="primary" disabled={!eligible} onClick={openPublish}>
                  {t(retryPublish ? 'Retry publication' : 'Publish storefront')}
                </Button>
              ) : null}
              {canPublish &&
              latest?.status === 'failed' &&
              latest.operation === 'rollback' &&
              latest.rollbackOf ? (
                <Button
                  disabled={!rollbackTargets.some(({ id }) => id === latest.rollbackOf)}
                  onClick={() => openRollback(latest.rollbackOf!)}
                >
                  {t('Retry rollback')}
                </Button>
              ) : null}
              <Button
                icon={<ReloadOutlined aria-hidden />}
                loading={loading}
                disabled={submitting || busy}
                onClick={() => setRefresh((value) => value + 1)}
              >
                {t('Refresh publication status')}
              </Button>
            </Space>
            {publications.length || active?.publication ? (
              <Collapse
                items={[
                  {
                    key: 'versions',
                    label: t('Publication history'),
                    children: (
                      <Space orientation="vertical" className="w-full min-w-0">
                        {active?.publication ? (
                          <Descriptions
                            size="small"
                            column={1}
                            items={[
                              {
                                key: 'current',
                                label: t('Current version'),
                                children: (
                                  <Typography.Text className="break-all">
                                    {active.publication.id}
                                  </Typography.Text>
                                ),
                              },
                            ]}
                          />
                        ) : null}
                        {publications.map((item) => (
                          <div key={item.id} className="w-full min-w-0">
                            <Space wrap>
                              <Typography.Text>
                                {new Date(item.createdAt).toLocaleString(locale)}
                              </Typography.Text>
                              <Tag>
                                {t(
                                  activeVerified && active?.publication?.id === item.id
                                    ? 'Online'
                                    : statusMessages[item.status]
                                )}
                              </Tag>
                            </Space>
                            <Descriptions
                              size="small"
                              column={1}
                              items={[
                                {
                                  key: 'id',
                                  label: t('Publication ID'),
                                  children: <span className="break-all">{item.id}</span>,
                                },
                                {
                                  key: 'catalog',
                                  label: t('Catalog version'),
                                  children: (
                                    <span className="break-all">
                                      {item.identity.catalogReleaseId}
                                    </span>
                                  ),
                                },
                                {
                                  key: 'snapshot',
                                  label: t('Approved design'),
                                  children: (
                                    <span className="break-all">
                                      {item.identity.experienceSnapshotId}
                                    </span>
                                  ),
                                },
                                {
                                  key: 'digest',
                                  label: t('Content digest'),
                                  children: (
                                    <span className="break-all">
                                      {item.identity.snapshotDigest}
                                    </span>
                                  ),
                                },
                                {
                                  key: 'contact',
                                  label: t('Contact version'),
                                  children: (
                                    <span className="break-all">
                                      {item.identity.contactVersion}
                                    </span>
                                  ),
                                },
                                {
                                  key: 'theme',
                                  label: t('Theme version'),
                                  children: `${item.identity.themeId} ${item.identity.themeVersion}`,
                                },
                                { key: 'reason', label: t('Reason'), children: item.reason },
                              ]}
                            />
                            {canPublish &&
                            item.status === 'succeeded' &&
                            item.receipt &&
                            item.environment === context.environment &&
                            item.id !== active?.publication?.id ? (
                              <Button
                                aria-label={t('Restore version {id}', { id: item.id })}
                                disabled={!rollbackTargets.some(({ id }) => id === item.id)}
                                onClick={() => openRollback(item.id)}
                              >
                                {t('Restore this version')}
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </Space>
                    ),
                  },
                ]}
              />
            ) : null}
          </>
        ) : !loading ? (
          <Button
            icon={<ReloadOutlined aria-hidden />}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {t('Refresh publication status')}
          </Button>
        ) : null}
        {details ? (
          <Collapse
            items={[
              {
                key: 'approval',
                label: t('Approval details'),
                forceRender: true,
                children: (
                  <Space orientation="vertical" className="w-full min-w-0">
                    <Typography.Text className="break-all">
                      {t('{id} · source draft v{version} · audit succeeded', {
                        id: details.id,
                        version: details.sourceDraftVersion,
                      })}
                    </Typography.Text>
                    {approval ? (
                      <Descriptions
                        size="small"
                        column={1}
                        items={[
                          {
                            key: 'catalog',
                            label: t('Catalog version'),
                            children: (
                              <span className="break-all">
                                {approval.identity.catalogReleaseId}
                              </span>
                            ),
                          },
                          {
                            key: 'digest',
                            label: t('Content digest'),
                            children: <span className="break-all">{approval.contentDigest}</span>,
                          },
                          {
                            key: 'contact',
                            label: t('Contact version'),
                            children: (
                              <span className="break-all">{approval.identity.contactVersion}</span>
                            ),
                          },
                          {
                            key: 'theme',
                            label: t('Theme version'),
                            children: `${approval.identity.themeId} ${approval.identity.themeVersion}`,
                          },
                        ]}
                      />
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
        ) : null}
      </Space>
      <Modal
        open={confirmationCurrent}
        title={t(
          confirmation?.kind === 'rollback'
            ? 'Restore previous storefront version?'
            : 'Publish this approved design?'
        )}
        okText={t(confirmation?.kind === 'rollback' ? 'Confirm rollback' : 'Confirm publication')}
        cancelText={t('Cancel')}
        confirmLoading={submitting}
        keyboard={!submitting}
        closable={!submitting}
        mask={{ closable: !submitting }}
        cancelButtonProps={{ disabled: submitting }}
        okButtonProps={{ disabled: !confirmationCurrent || !reason.trim() }}
        onCancel={() => {
          if (!mutationBusy.current) confirmationDialog.requestClose()
        }}
        onOk={() => void submit()}
        destroyOnHidden
      >
        {error ? (
          <Alert
            type="error"
            showIcon
            title={t('Publication could not be submitted')}
            description={
              errorCode && Object.hasOwn(failureMessages, errorCode)
                ? t(failureMessages[errorCode])
                : localizeApiError(error, t)
            }
          />
        ) : null}
        <Typography.Paragraph>
          {t('Publishing environment: {environment}', {
            environment:
              context?.environment === 'production'
                ? t('Production')
                : context?.environment === 'staging'
                  ? t('Staging')
                  : t('Development'),
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {t(
            confirmation?.kind === 'rollback'
              ? 'Delivery will restore the selected version after verification. Current transactions remain in place.'
              : 'Delivery will replace the storefront with this approved design and its frozen content after verification.'
          )}
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label={t('Publication reason')} required>
            <Input.TextArea
              aria-label={t('Publication reason')}
              rows={3}
              maxLength={500}
              value={reason}
              disabled={submitting}
              onChange={(event) => setReason(event.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
