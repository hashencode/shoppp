import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
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
import { useI18n } from '../../shared/contexts/i18n-context'

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
  const { permissions, role } = useAuth()
  const canRead = hasPermission(role, 'identity.read', permissions)
  const canWrite = hasPermission(role, 'identity.write', permissions)
  const [form] = Form.useForm<Values>()
  const [identity, setIdentity] = useState<StoreIdentityView | null>(null)
  const [loading, setLoading] = useState(canRead)
  const [saving, setSaving] = useState(false)
  const mutationLock = useRef(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [backlinks, setBacklinks] = useState<Backlink[]>([])

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

  useEffect(() => {
    if (!canRead) return
    let active = true
    void fetchStoreIdentity()
      .then((value) => active && apply(value))
      .catch((cause) => active && setError(normalizeApiError(cause)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [apply, canRead])

  const save = async (values: Values) => {
    if (!canWrite || mutationLock.current) return
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
      apply(saved)
    } catch (cause) {
      const apiError = normalizeApiError(cause)
      setError(apiError)
      const details = apiError.details as { backlinks?: Backlink[] } | undefined
      setBacklinks(details?.backlinks ?? [])
    } finally {
      mutationLock.current = false
      setSaving(false)
    }
  }

  return (
    <CustomPageRecipe title="Store identity">
      {!canRead ? (
        <Alert type="error" message="Access denied" />
      ) : loading ? (
        <Typography.Text>Loading store identity…</Typography.Text>
      ) : (
        <Space direction="vertical" size="middle" className="w-full">
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
          {error ? <Alert type="error" message={error.message} /> : null}
          {backlinks.length ? (
            <Alert
              type="warning"
              message="Repair mutable Theme drafts before changing this Logo source."
              description={
                <Space wrap>
                  {backlinks.map((backlink) => (
                    <Link key={backlink.id} to={backlink.href}>
                      Repair {backlink.id}
                    </Link>
                  ))}
                </Space>
              }
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void save(values)}
            disabled={saving}
          >
            <Card title="Public identity">
              <Form.Item name="storefrontName" label="Storefront name" rules={[{ required: true }]}>
                <Input maxLength={120} readOnly={!canWrite} />
              </Form.Item>
              <Form.Item name="tagline" label="Tagline">
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
              <Form.Item name="seoDescription" label="SEO description">
                <Input.TextArea maxLength={320} readOnly={!canWrite} />
              </Form.Item>
            </Card>
            <Card title="Shared brand assets" className="mt-4">
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
            </Card>
            {canWrite ? (
              <Form.Item
                name="reason"
                label={t('Notes (optional)')}
                rules={[{ max: 500 }]}
                className="mt-4"
              >
                <Input maxLength={500} />
              </Form.Item>
            ) : null}
            {canWrite ? (
              <>
                <Typography.Paragraph type="secondary">
                  {t(
                    'Saving creates a published source version for the next store preview. Existing storefront versions stay unchanged.'
                  )}
                </Typography.Paragraph>
                <Button htmlType="submit" type="primary" loading={saving}>
                  Save identity
                </Button>
              </>
            ) : null}
          </Form>
        </Space>
      )}
    </CustomPageRecipe>
  )
}
