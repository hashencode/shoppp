import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Checkbox, Form, Input, Select, Space, Tag } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createCatalogCollection,
  fetchCatalogCollection,
  fetchCatalogProducts,
  updateCatalogCollection,
  type CatalogCollection,
} from '../../services/catalog/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import {
  BasicCrudFormRecipe,
  type BasicCrudFormSpec,
} from '../../shared/template-kit/form'
import { goBackOrCloseWindow, useFormModeAccess } from '../../shared/template-kit/hooks'
import {
  CollectionBlockedDependencies,
  type CollectionBacklink,
} from './collection-blocked-dependencies'

void React

type Values = {
  coverAssetId?: string
  description: string
  name: string
  reason: string
  redirectFromOldSlug?: boolean
  seoDescription: string
  seoTitle: string
  slug: string
  status: CatalogCollection['status']
}

const defaults: Partial<Values> = {
  description: '',
  reason: '',
  redirectFromOldSlug: false,
  seoDescription: '',
  status: 'draft',
}

const toValues = (collection: CatalogCollection): Values => ({
  coverAssetId: collection.coverAssetId ?? undefined,
  description: collection.description,
  name: collection.name,
  reason: '',
  redirectFromOldSlug: collection.redirectFromOldSlug,
  seoDescription: collection.seo.description,
  seoTitle: collection.seo.title,
  slug: collection.slug,
  status: collection.status,
})

export const CollectionFormPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const [form] = Form.useForm<Values>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { role, permissions } = useAuth()
  const canPublish = hasPermission(role, 'catalog.publish', permissions)
  const { parsedMode, modeView, isReadonly, permissionDenied } = useFormModeAccess({
    searchParams,
    role,
    permissions,
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
  })
  const id = parsedMode.ok ? parsedMode.resourceKey : undefined
  const returnTo = searchParams.get('returnTo')
  const handoffProductId = searchParams.get('handoffProductId')
  const [detail, setDetail] = useState<CatalogCollection | null>(null)
  const [detailLoading, setDetailLoading] = useState(Boolean(modeView?.canFetch))
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [backlinks, setBacklinks] = useState<CollectionBacklink[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [productQuery, setProductQuery] = useState('')
  const [productIds, setProductIds] = useState<string[]>(
    handoffProductId ? [handoffProductId] : []
  )

  const loadDetail = useCallback(async () => {
    if (!modeView?.canFetch || !id) return
    setDetailLoading(true)
    setDetailError(null)
    try {
      const next = await fetchCatalogCollection(id)
      setDetail(next)
      setProducts((current) => {
        const byId = new Map(current.map((product) => [product.id, product]))
        next.products.forEach((product) => byId.set(product.id, product))
        return [...byId.values()]
      })
      setProductIds(
        handoffProductId && !next.productIds.includes(handoffProductId)
          ? [...next.productIds, handoffProductId]
          : next.productIds
      )
      form.setFieldsValue(toValues(next))
    } catch (error) {
      setDetailError(normalizeApiError(error))
    } finally {
      setDetailLoading(false)
    }
  }, [form, handoffProductId, id, modeView?.canFetch])

  useEffect(() => {
    if (!modeView?.canFetch) form.setFieldsValue(defaults)
    queueMicrotask(() => void loadDetail())
  }, [form, loadDetail, modeView?.canFetch])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCatalogProducts({
        page: 1,
        pageSize: 100,
        query: productQuery.trim() || undefined,
      }).then(({ data }) =>
        setProducts((current) => {
          const selected = new Set(productIds)
          const byId = new Map(
            current.filter(({ id: productId }) => selected.has(productId)).map((product) => [product.id, product])
          )
          data.forEach((product) => byId.set(product.id, product))
          return [...byId.values()]
        })
      )
    }, 200)
    return () => window.clearTimeout(timer)
  }, [productIds, productQuery])

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  )
  const moveProduct = (index: number, offset: -1 | 1) => {
    setProductIds((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
  }
  const onBackToList = () => {
    if (returnTo) {
      navigate(returnTo)
      return
    }
    goBackOrCloseWindow('/catalog/collections')
  }
  const onSubmit = async (values: Values) => {
    if (isReadonly) return
    setSaveLoading(true)
    setSaveError(null)
    setBacklinks([])
    const payload = {
      coverAssetId: values.coverAssetId?.trim() || null,
      description: values.description,
      ...(detail ? { expectedVersion: detail.version } : {}),
      name: values.name,
      productIds,
      reason: values.reason,
      redirectFromOldSlug: values.redirectFromOldSlug ?? false,
      seoDescription: values.seoDescription,
      seoTitle: values.seoTitle,
      slug: values.slug,
      status: values.status,
    }
    try {
      const saved = detail
        ? await updateCatalogCollection(detail.id, payload)
        : await createCatalogCollection(payload)
      setDetail(saved)
      setProductIds(saved.productIds)
      form.setFieldsValue({ ...toValues(saved), reason: '' })
      void message.success(t(detail ? 'Collection saved' : 'Collection created'))
    } catch (error) {
      const normalized = normalizeApiError(error)
      setSaveError(normalized.message)
      const details = normalized.details as { backlinks?: CollectionBacklink[] } | undefined
      setBacklinks(details?.backlinks ?? [])
    } finally {
      setSaveLoading(false)
    }
  }
  const spec: BasicCrudFormSpec<Values> = {
    parsedMode,
    modeView,
    permissionDenied,
    detailLoading,
    detailError,
    saveLoading,
    isReadonly,
    form,
    initialValues: defaults,
    title: t(parsedMode.ok && parsedMode.mode === 'add' ? 'New collection' : 'Collection'),
    contentWidthPreset: 'wide',
    stateCopy: {
      submitBlockedMessage: t('Readonly mode does not allow Collection changes.'),
      submitSuccessMessage: t('Collection saved'),
    },
    onBackToList,
    onRetryDetail: () => void loadDetail(),
    onResetAll: () => {
      form.setFieldsValue(detail ? toValues(detail) : defaults)
      setProductIds(
        detail
          ? handoffProductId && !detail.productIds.includes(handoffProductId)
            ? [...detail.productIds, handoffProductId]
            : detail.productIds
          : handoffProductId
            ? [handoffProductId]
            : []
      )
      setSaveError(null)
      setBacklinks([])
    },
    onSubmit,
    sections: [
      {
        key: 'identity',
        title: t('Collection identity'),
        renderFields: () => (
          <>
            <Form.Item label={t('Name')} name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label={t('Slug')}
              name="slug"
              rules={[
                { required: true },
                { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: t('Use lowercase URL-safe text.') },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item label={t('Description')} name="description">
              <Input.TextArea rows={5} />
            </Form.Item>
            <Form.Item label={t('Cover media asset ID')} name="coverAssetId">
              <Input allowClear />
            </Form.Item>
            <Form.Item label={t('Status')} name="status" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: t('Draft'), value: 'draft' },
                  { disabled: !canPublish, label: t('Published'), value: 'published' },
                  { disabled: !canPublish, label: t('Archived'), value: 'archived' },
                ]}
              />
            </Form.Item>
            <Form.Item name="redirectFromOldSlug" valuePropName="checked">
              <Checkbox>{t('Create a redirect when the slug changes')}</Checkbox>
            </Form.Item>
          </>
        ),
      },
      {
        key: 'membership',
        title: t('Ordered Product membership'),
        contentWidthPreset: 'wide',
        renderFields: () => (
          <Space orientation="vertical" className="w-full" size="middle">
            <Select
              aria-label={t('Add Product')}
              className="w-full"
              disabled={isReadonly}
              placeholder={t('Add Product')}
              showSearch
              filterOption={false}
              onSearch={setProductQuery}
              value={undefined}
              options={products
                .filter(({ id: productId }) => !productIds.includes(productId))
                .map((product) => ({ label: `${product.name} — ${product.slug}`, value: product.id }))}
              onChange={(productId: string) => setProductIds((current) => [...current, productId])}
            />
            {productIds.length ? (
              productIds.map((productId, index) => {
                const product = productById.get(productId)
                const label = product?.name ?? productId
                return (
                  <div key={productId} className="flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <Space>
                      <Button
                        disabled={isReadonly || index === 0}
                        aria-label={t('Move {name} up', { name: label })}
                        onClick={() => moveProduct(index, -1)}
                      >
                        {t('Up')}
                      </Button>
                      <Button
                        disabled={isReadonly || index === productIds.length - 1}
                        aria-label={t('Move {name} down', { name: label })}
                        onClick={() => moveProduct(index, 1)}
                      >
                        {t('Down')}
                      </Button>
                      <Button
                        danger
                        disabled={isReadonly}
                        onClick={() => setProductIds((current) => current.filter((id) => id !== productId))}
                      >
                        {t('Remove')}
                      </Button>
                    </Space>
                  </div>
                )
              })
            ) : (
              <Alert type="info" title={t('This optional Collection has no Products.')} />
            )}
          </Space>
        ),
      },
      {
        key: 'seo',
        title: t('SEO'),
        renderFields: () => (
          <>
            <Form.Item label={t('SEO title')} name="seoTitle" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label={t('SEO description')} name="seoDescription">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              label={t('Change reason')}
              name="reason"
              rules={[{ required: true, min: 3 }]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          </>
        ),
      },
    ],
    renderAfterForm: (
      <Space orientation="vertical" className="w-full">
        {detail ? (
          <Alert
            type={detail.candidate.liveReleaseId ? 'success' : 'info'}
            title={t('Saved Collection version {version}', { version: detail.version })}
            description={
              <Space wrap>
                <Tag>
                  {t(
                    detail.status === 'draft'
                      ? 'Draft'
                      : detail.status === 'published'
                        ? 'Published'
                        : 'Archived'
                  )}
                </Tag>
                {detail.candidate.candidateReleaseId ? (
                  <Tag color="blue">{t('Candidate')}</Tag>
                ) : null}
                {detail.candidate.liveReleaseId ? <Tag color="green">{t('Live')}</Tag> : null}
              </Space>
            }
          />
        ) : null}
        {saveError ? <Alert type="error" title={saveError} /> : null}
        <CollectionBlockedDependencies backlinks={backlinks} />
      </Space>
    ),
  }
  return <BasicCrudFormRecipe spec={spec} />
}
