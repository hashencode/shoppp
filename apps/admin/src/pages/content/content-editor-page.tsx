import type { PublishableContentSection } from '@shoppp/contracts'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Alert, App, Button, Card, Divider, Form, Input, Modal, Space, Tag, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createContentRecord,
  fetchContentRecord,
  transitionContentRecord,
  updateContentRecord,
  type ContentArticleRecord,
  type ContentKind,
  type ContentPageRecord,
} from '../../services/content/api'
import { StructuredContentEditor } from '../../shared/content/structured-content-editor'
import { ContentMediaSelect } from '../../shared/content/content-media-select'
import { suggestEnglishSlug } from '../../shared/content/suggest-english-slug'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import { BasicCrudFormRecipe, type BasicCrudFormSpec } from '../../shared/template-kit/form'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { goBackOrCloseWindow, useFormModeAccess } from '../../shared/template-kit/hooks'

void React

type Record = ContentPageRecord | ContentArticleRecord
type TransitionContext = {
  action: 'archive' | 'publish'
  id: string
  kind: ContentKind
  version: number
  title: string
}
type Values = {
  body: PublishableContentSection[]
  coverAssetId?: string
  reason: string
  seoDescription: string
  seoTitle: string
  slug: string
  summary: string
  title: string
}

const defaults: Partial<Values> = {
  body: [],
  reason: '',
  seoDescription: '',
  seoTitle: '',
  summary: '',
}

const statusLabel: { [status in Record['status']]: 'Archived' | 'Draft' | 'Published' } = {
  archived: 'Archived',
  draft: 'Draft',
  published: 'Published',
}

const toValues = (record: Record): Values => ({
  body: record.body,
  coverAssetId: 'coverAssetId' in record ? record.coverAssetId : undefined,
  reason: '',
  seoDescription: record.seo.description,
  seoTitle: record.seo.title,
  slug: record.slug,
  summary: record.summary,
  title: record.title,
})

export const ContentEditorPage = ({ kind }: { kind: ContentKind }) => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const { permissions, role } = useAuth()
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<Values>()
  const statusFieldId = useId()
  const { parsedMode, modeView, isReadonly, permissionDenied } = useFormModeAccess({
    permissions,
    readPermission: 'content.read',
    role,
    searchParams,
    writePermission: 'content.write',
  })
  const id = parsedMode.ok ? parsedMode.resourceKey : undefined
  const [detail, setDetail] = useState<Record | null>(null)
  const [detailLoading, setDetailLoading] = useState(Boolean(modeView?.canFetch))
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<ApiError | null>(null)
  const [transitionLoading, setTransitionLoading] = useState(false)
  const [transitionContext, setTransitionContext] = useState<TransitionContext | null>(null)
  const [transitionError, setTransitionError] = useState<ApiError | null>(null)
  const [transitionForm] = Form.useForm<{ reason: string }>()
  const generationRef = useRef(0)
  const mutationLock = useRef(false)
  const canPublish = hasPermission(role, 'content.publish', permissions)
  const watchedValues = Form.useWatch([], { form, preserve: true })
  const isDirty = Boolean(watchedValues) && form.isFieldsTouched()
  const transitionBlocked =
    isDirty ||
    saveLoading ||
    transitionLoading ||
    detailLoading ||
    saveError?.code === 'content_conflict'
  const listRoute = `/content/${kind === 'page' ? 'pages' : 'articles'}`
  const singular = kind === 'page' ? t('Page') : t('Article')
  const restoreRecord = useCallback(
    (record: Record) => {
      form.resetFields()
      form.setFields(
        Object.entries(toValues(record)).map(([name, value]) => ({
          name: name as keyof Values,
          value,
          touched: false,
        }))
      )
    },
    [form]
  )

  const load = useCallback(
    async (generation = generationRef.current) => {
      if (!modeView?.canFetch || !id) return
      setDetailLoading(true)
      setDetailError(null)
      try {
        const next =
          kind === 'page'
            ? await fetchContentRecord('page', id)
            : await fetchContentRecord('article', id)
        if (generation !== generationRef.current) return
        setDetail(next)
        restoreRecord(next)
        setSaveError(null)
      } catch (error) {
        if (generation === generationRef.current) setDetailError(normalizeApiError(error))
      } finally {
        if (generation === generationRef.current) setDetailLoading(false)
      }
    },
    [id, kind, modeView?.canFetch, restoreRecord]
  )

  useEffect(() => {
    const generation = ++generationRef.current
    queueMicrotask(() => {
      if (generation !== generationRef.current) return
      setDetail(null)
      setDetailError(null)
      setSaveError(null)
      setTransitionContext(null)
      setTransitionError(null)
      setTransitionLoading(false)
      form.resetFields()
      if (!modeView?.canFetch) {
        setDetailLoading(false)
        form.setFieldsValue(defaults)
        return
      }
      setDetailLoading(true)
      void load(generation)
    })
    return () => {
      if (generationRef.current === generation) generationRef.current += 1
    }
  }, [form, load, modeView?.canFetch])

  const save = async (values: Values) => {
    if (isReadonly || saveLoading || transitionLoading || transitionContext || mutationLock.current)
      return
    mutationLock.current = true
    const generation = generationRef.current
    setSaveLoading(true)
    setSaveError(null)
    const common = {
      body: values.body,
      ...(detail ? { expectedVersion: detail.version } : {}),
      reason: values.reason,
      seo: { description: values.seoDescription, title: values.seoTitle },
      slug: values.slug,
      summary: values.summary,
      title: values.title,
    }
    try {
      const saved =
        kind === 'page'
          ? detail
            ? await updateContentRecord('page', detail.id, common)
            : await createContentRecord('page', common)
          : detail
            ? await updateContentRecord('article', detail.id, {
                ...common,
                coverAssetId: values.coverAssetId?.trim() || null,
              })
            : await createContentRecord('article', {
                ...common,
                coverAssetId: values.coverAssetId?.trim() || null,
              })
      if (generation !== generationRef.current) return
      setDetail(saved)
      restoreRecord(saved)
      void message.success(t('Content draft saved'))
    } catch (error) {
      if (generation === generationRef.current) setSaveError(normalizeApiError(error))
    } finally {
      mutationLock.current = false
      if (generation === generationRef.current) setSaveLoading(false)
    }
  }

  const openTransition = (action: TransitionContext['action']) => {
    if (
      !detail ||
      !canPublish ||
      transitionBlocked ||
      mutationLock.current ||
      (action === 'publish' ? detail.status !== 'draft' : detail.status === 'archived')
    )
      return
    transitionForm.resetFields()
    setTransitionError(null)
    setTransitionContext({
      action,
      id: detail.id,
      kind,
      version: detail.version,
      title: detail.title,
    })
  }

  const transition = async ({ reason }: { reason: string }) => {
    const context = transitionContext
    if (
      !context ||
      !detail ||
      !canPublish ||
      context.kind !== kind ||
      context.id !== id ||
      context.id !== detail.id ||
      context.version !== detail.version ||
      (context.action === 'publish' ? detail.status !== 'draft' : detail.status === 'archived') ||
      mutationLock.current ||
      isDirty ||
      saveLoading ||
      transitionLoading ||
      reason.trim().length < 3 ||
      reason.trim().length > 500
    )
      return
    const generation = generationRef.current
    mutationLock.current = true
    setTransitionLoading(true)
    setTransitionError(null)
    try {
      const next = await transitionContentRecord(context.kind, context.id, context.action, {
        confirm: true,
        expectedVersion: context.version,
        reason: reason.trim(),
        redirectFromOldSlug: context.action === 'publish',
      })
      if (generation !== generationRef.current) return
      setDetail(next)
      setTransitionContext(null)
      restoreRecord(next)
      void message.success(
        t(
          context.action === 'publish'
            ? 'Content published for future storefront versions.'
            : 'Content archived'
        )
      )
    } catch (error) {
      if (generation === generationRef.current) {
        const normalized = normalizeApiError(error)
        if (normalized.code === 'content_conflict') {
          setTransitionContext(null)
          setSaveError(normalized)
        } else setTransitionError(normalized)
      }
    } finally {
      mutationLock.current = false
      if (generation === generationRef.current) setTransitionLoading(false)
    }
  }

  const spec: BasicCrudFormSpec<Values> = {
    contentWidthPreset: 'wide',
    detailError,
    detailLoading,
    form,
    initialValues: defaults,
    isReadonly,
    modeView,
    onBackToList: () => goBackOrCloseWindow(listRoute),
    onResetAll: () => {
      if (detail) restoreRecord(detail)
      else form.resetFields()
      setSaveError((current) => (current?.code === 'content_conflict' ? current : null))
    },
    onRetryDetail: () => void load(),
    onSubmit: save,
    parsedMode,
    permissionDenied,
    renderAfterForm: (
      <div className="space-y-4">
        {saveError ? (
          <Alert
            type="error"
            title={localizeApiError(saveError, t)}
            action={
              saveError.code === 'content_conflict' ? (
                <Button
                  disabled={saveLoading || transitionLoading}
                  onClick={() => {
                    void load()
                  }}
                >
                  {t('Reload')}
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {detail ? (
          <Card
            title={t('Status and publication')}
            classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            extra={
              canPublish ? (
                <Space>
                  {detail.status === 'draft' ? (
                    <Button
                      loading={transitionLoading}
                      disabled={transitionBlocked}
                      onClick={() => openTransition('publish')}
                    >
                      {t('Publish')}
                    </Button>
                  ) : null}
                  {detail.status !== 'archived' ? (
                    <Button
                      danger
                      loading={transitionLoading}
                      disabled={transitionBlocked}
                      onClick={() => openTransition('archive')}
                    >
                      {t('Archive')}
                    </Button>
                  ) : null}
                </Space>
              ) : undefined
            }
          >
            <Form.Item label={t('Content status')} htmlFor={`${statusFieldId}-status`}>
              <Input
                id={`${statusFieldId}-status`}
                readOnly
                variant="filled"
                value={t(statusLabel[detail.status])}
              />
            </Form.Item>
            <Form.Item label={t('Saved version')} htmlFor={`${statusFieldId}-version`}>
              <Input
                id={`${statusFieldId}-version`}
                readOnly
                variant="filled"
                value={`v${detail.version}`}
              />
            </Form.Item>
            <Divider className="!my-4" />
            <details>
              <summary>{t('Content version details')}</summary>
              <Space wrap>
                <Tag>
                  {t(
                    detail.inclusion.candidate
                      ? 'Candidate included'
                      : detail.inclusion.candidateStale
                        ? 'Candidate stale: saved version is newer'
                        : 'Not in candidate'
                  )}
                </Tag>
                {detail.inclusion.live ? (
                  <span>{t('This version was included in a deployed storefront version.')}</span>
                ) : detail.inclusion.liveStale ? (
                  <span>{t('A deployed storefront version used an earlier source version.')}</span>
                ) : null}
              </Space>
            </details>
          </Card>
        ) : null}
      </div>
    ),
    saveLoading: saveLoading || transitionLoading,
    sections: [
      {
        key: 'identity',
        renderFields: () => (
          <>
            <Form.Item label={t('Title')} name="title" rules={[{ required: true, max: 160 }]}>
              <Input
                onBlur={(event) => {
                  if (id || detail || form.isFieldTouched('slug') || form.getFieldValue('slug'))
                    return
                  const slug = suggestEnglishSlug(event.target.value)
                  if (slug) form.setFieldValue('slug', slug)
                }}
              />
            </Form.Item>
            <Form.Item
              label={t('Slug')}
              name="slug"
              rules={[
                { required: true },
                {
                  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: t('Use lowercase URL-safe text.'),
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item label={t('Summary')} name="summary" rules={[{ max: 500 }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            {kind === 'article' ? (
              <Form.Item label={t('Cover media asset ID')} name="coverAssetId">
                <ContentMediaSelect allowClear disabled={isReadonly} />
              </Form.Item>
            ) : null}
          </>
        ),
        title: t('{kind} identity', { kind: singular }),
      },
      {
        contentWidthPreset: 'wide',
        key: 'body',
        renderFields: () => (
          <Form.Item
            label={t('Structured content')}
            name="body"
            rules={[{ required: true, type: 'array' }]}
          >
            <StructuredContentEditor contentMode="publishable" disabled={isReadonly} />
          </Form.Item>
        ),
        title: t('Content body'),
      },
      {
        key: 'seo',
        renderFields: () => (
          <>
            <Form.Item
              label={t('SEO title')}
              name="seoTitle"
              rules={[{ max: 160 }]}
              extra={t('Leave blank to use the title.')}
            >
              <Input />
            </Form.Item>
            <Form.Item label={t('SEO description')} name="seoDescription" rules={[{ max: 320 }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            {!isReadonly ? (
              <Form.Item label={t('Notes (optional)')} name="reason" rules={[{ max: 500 }]}>
                <Input maxLength={500} />
              </Form.Item>
            ) : null}
          </>
        ),
        title: t('Search presentation'),
      },
    ],
    stateCopy: {
      submitBlockedMessage: t('Readonly mode does not allow Content changes.'),
      submitSuccessMessage: t('Content draft saved'),
    },
    title:
      parsedMode.ok && parsedMode.mode === 'add' ? t('New {kind}', { kind: singular }) : singular,
  }
  return (
    <>
      <BasicCrudFormRecipe spec={spec} />
      <Modal
        open={Boolean(
          canPublish &&
          transitionContext &&
          transitionContext.kind === kind &&
          transitionContext.id === id &&
          transitionContext.version === detail?.version
        )}
        title={t(
          transitionContext?.action === 'publish'
            ? 'Publish this exact content version?'
            : 'Archive this content version?'
        )}
        okText={t('Confirm')}
        cancelText={t('Cancel')}
        confirmLoading={transitionLoading}
        okButtonProps={{ danger: transitionContext?.action === 'archive' }}
        cancelButtonProps={{ disabled: transitionLoading }}
        closable={!transitionLoading}
        keyboard={!transitionLoading}
        mask={{ closable: !transitionLoading }}
        onCancel={() => {
          if (!mutationLock.current) setTransitionContext(null)
        }}
        onOk={() => transitionForm.submit()}
        forceRender
      >
        <Typography.Paragraph type="secondary">
          {transitionContext?.title} ·{' '}
          {t('Saved v{version}', { version: transitionContext?.version ?? 0 })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {t(
            transitionContext?.action === 'publish'
              ? 'This content becomes available to future storefront versions. The current storefront is unchanged.'
              : 'Current references must be repaired before archive succeeds.'
          )}
        </Typography.Paragraph>
        <Form
          name={`content-${kind}-transition`}
          form={transitionForm}
          layout="vertical"
          disabled={transitionLoading}
          onFinish={(values) => void transition(values)}
        >
          <Form.Item
            name="reason"
            label={t('Transition reason')}
            rules={[
              { required: true, transform: (value: string) => value?.trim(), min: 3, max: 500 },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
        {transitionError ? (
          <Alert type="error" showIcon title={localizeApiError(transitionError, t)} />
        ) : null}
      </Modal>
    </>
  )
}
