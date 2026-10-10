import type { PublishableContentSection } from '@shoppp/contracts'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Form, Input, Popconfirm, Space, Tag } from 'antd'
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
import { goBackOrCloseWindow, useFormModeAccess } from '../../shared/template-kit/hooks'

void React

type Record = ContentPageRecord | ContentArticleRecord
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
  const [transitionReason, setTransitionReason] = useState('')
  const generationRef = useRef(0)
  const canPublish = hasPermission(role, 'content.publish', permissions)
  const watchedValues = Form.useWatch([], { form, preserve: true })
  const isDirty = Boolean(watchedValues) && form.isFieldsTouched()
  const listRoute = `/content/${kind === 'page' ? 'pages' : 'articles'}`
  const singular = kind === 'page' ? t('Page') : t('Article')

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
        form.setFieldsValue(toValues(next))
      } catch (error) {
        if (generation === generationRef.current) setDetailError(normalizeApiError(error))
      } finally {
        if (generation === generationRef.current) setDetailLoading(false)
      }
    },
    [form, id, kind, modeView?.canFetch]
  )

  useEffect(() => {
    const generation = ++generationRef.current
    queueMicrotask(() => {
      if (generation !== generationRef.current) return
      setDetail(null)
      setDetailError(null)
      setSaveError(null)
      setTransitionReason('')
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
    if (isReadonly || saveLoading || transitionLoading) return
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
      form.resetFields()
      form.setFieldsValue(toValues(saved))
      void message.success(t('Content draft saved'))
    } catch (error) {
      if (generation === generationRef.current) setSaveError(normalizeApiError(error))
    } finally {
      if (generation === generationRef.current) setSaveLoading(false)
    }
  }

  const transition = async (action: 'archive' | 'publish') => {
    if (
      !detail ||
      isDirty ||
      saveLoading ||
      transitionLoading ||
      transitionReason.trim().length < 3
    )
      return
    const generation = generationRef.current
    setTransitionLoading(true)
    setSaveError(null)
    try {
      const next = await transitionContentRecord(kind, detail.id, action, {
        confirm: true,
        expectedVersion: detail.version,
        reason: transitionReason,
        redirectFromOldSlug: action === 'publish',
      })
      if (generation !== generationRef.current) return
      setDetail(next)
      setTransitionReason('')
      form.resetFields()
      form.setFieldsValue(toValues(next))
      void message.success(
        t(
          action === 'publish'
            ? 'Content published for future storefront versions.'
            : 'Content archived'
        )
      )
    } catch (error) {
      if (generation === generationRef.current) setSaveError(normalizeApiError(error))
    } finally {
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
      form.setFieldsValue(detail ? toValues(detail) : defaults)
      setSaveError(null)
    },
    onRetryDetail: () => void load(),
    onSubmit: save,
    parsedMode,
    permissionDenied,
    renderAfterForm: (
      <Space orientation="vertical" className="w-full">
        {saveError ? <Alert type="error" title={localizeApiError(saveError, t)} /> : null}
        {detail ? (
          <Space orientation="vertical" className="w-full">
            <Tag>{t(statusLabel[detail.status])}</Tag>
            <details>
              <summary>{t('Content version details')}</summary>
              <Space wrap>
                <Tag>{t('Saved v{version}', { version: detail.version })}</Tag>
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
          </Space>
        ) : null}
        {detail && canPublish ? (
          <Space orientation="vertical" className="w-full">
            <Input
              aria-label={t('Transition reason')}
              placeholder={t('Reason for publish or archive')}
              value={transitionReason}
              onChange={(event) => setTransitionReason(event.target.value)}
              disabled={transitionLoading || saveLoading}
            />
            <Space>
              {detail.status === 'draft' ? (
                <Popconfirm
                  title={t('Publish this exact content version?')}
                  description={t(
                    'This content becomes available to future storefront versions. The current storefront is unchanged.'
                  )}
                  okButtonProps={{
                    disabled:
                      isDirty ||
                      transitionLoading ||
                      saveLoading ||
                      transitionReason.trim().length < 3,
                  }}
                  cancelButtonProps={{ disabled: false }}
                  onConfirm={() => void transition('publish')}
                  disabled={
                    isDirty ||
                    transitionLoading ||
                    saveLoading ||
                    transitionReason.trim().length < 3
                  }
                >
                  <Button
                    loading={transitionLoading}
                    disabled={isDirty || saveLoading || transitionReason.trim().length < 3}
                  >
                    {t('Publish')}
                  </Button>
                </Popconfirm>
              ) : null}
              {detail.status !== 'archived' ? (
                <Popconfirm
                  title={t('Archive this content version?')}
                  description={t('Current references must be repaired before archive succeeds.')}
                  okButtonProps={{
                    disabled:
                      isDirty ||
                      transitionLoading ||
                      saveLoading ||
                      transitionReason.trim().length < 3,
                  }}
                  cancelButtonProps={{ disabled: false }}
                  onConfirm={() => void transition('archive')}
                  disabled={
                    isDirty ||
                    transitionLoading ||
                    saveLoading ||
                    transitionReason.trim().length < 3
                  }
                >
                  <Button
                    danger
                    loading={transitionLoading}
                    disabled={isDirty || saveLoading || transitionReason.trim().length < 3}
                  >
                    {t('Archive')}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          </Space>
        ) : null}
      </Space>
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
  return <BasicCrudFormRecipe spec={spec} />
}
