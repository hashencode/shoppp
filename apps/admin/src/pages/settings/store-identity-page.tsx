import { Alert, App, Button, Card, Form, Input, Popconfirm, Space, Typography } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchStoreIdentity,
  updateStoreIdentity,
  type StoreIdentityView,
} from '../../services/platform/api'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import { ContentMediaSelect } from '../../shared/content/content-media-select'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import { FormSubmitToolbar } from '../../shared/components/form-submit-toolbar'
import { QueryStateBlock } from '../../shared/components/query-state-block'
import { FORM_CARD_BODY_WIDTH_CLASS_NAME } from '../../shared/template-kit/form/form-content-width'
import { FORM_ERROR_SCROLL_OPTIONS } from '../../shared/template-kit/form/form-validation-scroll'
import { ForbiddenPage } from '../forbidden-page'

void React

type Values = {
  faviconAssetId: string
  logoCompact: string
  logoDark: string
  logoLight: string
  logoPrimary: string
  reason: string
  seoDescription: string
  seoTitle: string
  socialShareAssetId: string
  storefrontName: string
  tagline: string
}

type Backlink = { href: string; id: string }

const optional = (value?: string) => value?.trim() || null

export const StoreIdentityPage = () => {
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const { message } = App.useApp()
  const { permissions, role } = useAuth()
  const canRead = hasPermission(role, 'identity.read', permissions)
  const canWrite = hasPermission(role, 'identity.write', permissions)
  const [form] = Form.useForm<Values>()
  const [identity, setIdentity] = useState<StoreIdentityView | null>(null)
  const [loading, setLoading] = useState(canRead)
  const [saving, setSaving] = useState(false)
  const mutationLock = useRef(false)
  const alive = useRef(true)
  const loadRequest = useRef(0)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const reloadButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (error) reloadButton.current?.focus()
  }, [error])

  const apply = useCallback(
    (value: StoreIdentityView | null) => {
      setIdentity(value)
      const logos = new Map(value?.logoAssets.map(({ assetId, variant }) => [variant, assetId]))
      form.setFieldsValue({
        faviconAssetId: value?.faviconAssetId ?? '',
        logoCompact: logos?.get('compact') ?? '',
        logoDark: logos?.get('dark') ?? '',
        logoLight: logos?.get('light') ?? '',
        logoPrimary: logos?.get('primary') ?? '',
        reason: '',
        seoDescription: value?.seo.description ?? '',
        seoTitle: value?.seo.title ?? '',
        socialShareAssetId: value?.socialShareAssetId ?? '',
        storefrontName: value?.storefrontName ?? '',
        tagline: value?.tagline ?? '',
      })
    },
    [form]
  )

  const load = useCallback(async () => {
    if (mutationLock.current) return
    const request = ++loadRequest.current
    setLoading(true)
    setLoadError(null)
    try {
      const value = await fetchStoreIdentity()
      if (!alive.current || request !== loadRequest.current) return
      apply(value)
      setError(null)
      setBacklinks([])
    } catch (cause) {
      if (alive.current && request === loadRequest.current) setLoadError(normalizeApiError(cause))
    } finally {
      if (alive.current && request === loadRequest.current) setLoading(false)
    }
  }, [apply])

  useEffect(() => {
    alive.current = true
    const timer = canRead ? window.setTimeout(() => void load(), 0) : undefined
    return () => {
      window.clearTimeout(timer)
      alive.current = false
      loadRequest.current += 1
    }
  }, [canRead, load])

  const reset = () => {
    if (!canWrite || loading || loadError || mutationLock.current) return
    form.resetFields()
    apply(identity)
    setError(null)
    setBacklinks([])
  }

  const save = async (values: Values) => {
    if (!canRead || !canWrite || loading || loadError || !alive.current || mutationLock.current)
      return
    mutationLock.current = true
    setSaving(true)
    setError(null)
    setBacklinks([])
    try {
      const logoAssets = (
        [
          ['primary', values.logoPrimary],
          ['light', values.logoLight],
          ['dark', values.logoDark],
          ['compact', values.logoCompact],
        ] as const
      ).flatMap(([variant, assetId]) =>
        assetId?.trim() ? [{ assetId: assetId.trim(), variant }] : []
      )
      const saved = await updateStoreIdentity({
        expectedVersion: identity?.version ?? null,
        faviconAssetId: optional(values.faviconAssetId),
        logoAssets,
        reason: values.reason,
        seo: { description: values.seoDescription, title: values.seoTitle },
        socialShareAssetId: optional(values.socialShareAssetId),
        storefrontName: values.storefrontName,
        tagline: values.tagline,
      })
      if (!alive.current) return
      apply(saved)
      void message.success(translateNow('Store details saved.'))
    } catch (cause) {
      if (!alive.current) return
      const apiError = normalizeApiError(cause)
      setError(apiError)
      const details = apiError.details as { backlinks?: Backlink[] } | undefined
      setBacklinks(details?.backlinks ?? [])
    } finally {
      mutationLock.current = false
      if (alive.current) setSaving(false)
    }
  }

  return (
    <CustomPageRecipe title={t('Store details')}>
      {!canRead ? (
        <ForbiddenPage />
      ) : loading ? (
        <QueryStateBlock state="loading" title={t('Loading store details…')} />
      ) : loadError ? (
        <QueryStateBlock
          state="error"
          title={t('Store details could not be loaded')}
          description={localizeApiError(loadError, t)}
          primaryActionLabel={t('Retry')}
          primaryActionButtonType="default"
          onPrimaryAction={() => void load()}
        />
      ) : (
        <div className="space-y-4">
          <Typography.Text>
            {identity
              ? t('Published store details · version {version}', { version: identity.version })
              : t('No store details saved')}
          </Typography.Text>
          {identity?.inclusion?.live || identity?.inclusion?.candidate ? (
            <details>
              <summary>{t('Version details')}</summary>
              <Space orientation="vertical">
                {identity.inclusion.live ? (
                  <Typography.Text>
                    {t('Deployment history includes this version.')}
                  </Typography.Text>
                ) : null}
                {identity.inclusion.candidate ? (
                  <Typography.Text>{t('Included in a private preview candidate.')}</Typography.Text>
                ) : null}
              </Space>
            </details>
          ) : null}
          {error ? (
            <Alert
              type="error"
              showIcon
              title={t('Store details could not be saved')}
              description={localizeApiError(error, t)}
              action={
                <Popconfirm
                  title={t('Reload and discard local edits')}
                  okText={t('Confirm')}
                  cancelText={t('Cancel')}
                  onConfirm={() => void load()}
                  disabled={saving}
                >
                  <Button ref={reloadButton} disabled={saving}>
                    {t('Reload')}
                  </Button>
                </Popconfirm>
              }
            />
          ) : null}
          {backlinks.length ? (
            <Alert
              type="warning"
              showIcon
              title={t('Repair mutable Theme drafts before changing this Logo source.')}
              description={
                <Space wrap>
                  {backlinks.map((backlink) => (
                    <Link key={backlink.id} to={backlink.href}>
                      {t('Repair {item}', { item: backlink.id })}
                    </Link>
                  ))}
                </Space>
              }
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            className="space-y-4 pb-20"
            onFinish={(values) => void save(values)}
            disabled={!canWrite || saving}
            scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
          >
            <Card
              title={t('Public identity')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Form.Item
                name="storefrontName"
                label={t('Storefront name')}
                rules={[{ required: true }]}
              >
                <Input maxLength={120} readOnly={!canWrite} />
              </Form.Item>
              <Form.Item name="tagline" label={t('Tagline')}>
                <Input maxLength={240} readOnly={!canWrite} />
              </Form.Item>
              <Form.Item
                name="seoTitle"
                label={t('SEO title')}
                rules={[{ max: 160 }]}
                extra={t('Leave blank to use the storefront name.')}
              >
                <Input maxLength={160} readOnly={!canWrite} />
              </Form.Item>
              <Form.Item name="seoDescription" label={t('SEO description')}>
                <Input.TextArea maxLength={320} readOnly={!canWrite} />
              </Form.Item>
              {canWrite ? (
                <Form.Item
                  name="reason"
                  label={t('Notes (optional)')}
                  rules={[{ max: 500 }]}
                  className="!mb-0"
                >
                  <Input maxLength={500} />
                </Form.Item>
              ) : null}
            </Card>
            <Card
              title={t('Shared brand assets')}
              classNames={{ body: FORM_CARD_BODY_WIDTH_CLASS_NAME.compact }}
            >
              <Form.Item name="logoPrimary" label={t('Primary Logo')} rules={[{ required: true }]}>
                <ContentMediaSelect source="identity" disabled={!canWrite || saving} />
              </Form.Item>
              <Form.Item name="logoLight" label={t('Light Logo')}>
                <ContentMediaSelect source="identity" allowClear disabled={!canWrite || saving} />
              </Form.Item>
              <Form.Item name="logoDark" label={t('Dark Logo')}>
                <ContentMediaSelect source="identity" allowClear disabled={!canWrite || saving} />
              </Form.Item>
              <Form.Item name="logoCompact" label={t('Compact Logo')}>
                <ContentMediaSelect source="identity" allowClear disabled={!canWrite || saving} />
              </Form.Item>
              <Form.Item name="faviconAssetId" label={t('Favicon')}>
                <ContentMediaSelect source="identity" allowClear disabled={!canWrite || saving} />
              </Form.Item>
              <Form.Item name="socialShareAssetId" label={t('Social-share image')}>
                <ContentMediaSelect source="identity" allowClear disabled={!canWrite || saving} />
              </Form.Item>
              {canWrite ? (
                <Typography.Paragraph type="secondary" className="!mb-0">
                  {t(
                    'Saving creates a published source version for the next store preview. Existing storefront versions stay unchanged.'
                  )}
                </Typography.Paragraph>
              ) : null}
            </Card>
            {canWrite ? (
              <FormSubmitToolbar
                submitLabel={t('Save identity')}
                submitHtmlType="submit"
                submitLoading={saving}
                submitDisabled={saving}
                resetLabel={t('Reset changes')}
                resetDisabled={saving}
                onReset={reset}
              />
            ) : null}
          </Form>
        </div>
      )}
    </CustomPageRecipe>
  )
}
