import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Checkbox, Form, Input, Select, Space, Tag, Typography } from 'antd'
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
import { ContentMediaSelect } from '../../shared/content/content-media-select'
import { suggestEnglishSlug } from '../../shared/content/suggest-english-slug'
import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'
import { SortActionGroup } from '../../shared/components/sort-action-group'
import { BasicCrudFormRecipe, type BasicCrudFormSpec } from '../../shared/template-kit/form'
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
  seoTitle: '',
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

type DrawerContext = { search: string; onClose: () => void; onSaved: () => Promise<void> }
export const CollectionFormPage = ({ drawer }: { drawer?: DrawerContext } = {}) => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const [form] = Form.useForm<Values>()
  const [routeSearchParams] = useSearchParams()
  const drawerSearch = drawer?.search
  const searchParams = useMemo(
    () => (drawerSearch !== undefined ? new URLSearchParams(drawerSearch) : routeSearchParams),
    [drawerSearch, routeSearchParams]
  )
  const alive = useRef(true)
  const detailGeneration = useRef(0)
  const searchGeneration = useRef(0)
  const saveLock = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      detailGeneration.current += 1
    }
  }, [])
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
  const targetStatus = Form.useWatch('status', form) ?? 'draft'
  const requiresReason = (detail !== null && detail.status !== 'draft') || targetStatus !== 'draft'
  const [detailLoading, setDetailLoading] = useState(Boolean(modeView?.canFetch))
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [backlinks, setBacklinks] = useState<CollectionBacklink[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [productQuery, setProductQuery] = useState('')
  const [productIds, setProductIds] = useState<string[]>(handoffProductId ? [handoffProductId] : [])

  const loadDetail = useCallback(async () => {
    if (!modeView?.canFetch || !id) return
    const generation = ++detailGeneration.current
    setDetailLoading(true)
    setDetailError(null)
    try {
      const next = await fetchCatalogCollection(id)
      if (!alive.current || generation !== detailGeneration.current) return
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
      if (alive.current && generation === detailGeneration.current)
        setDetailError(normalizeApiError(error))
    } finally {
      if (alive.current && generation === detailGeneration.current) setDetailLoading(false)
    }
  }, [form, handoffProductId, id, modeView?.canFetch])

  useEffect(() => {
    if (!modeView?.canFetch) form.setFieldsValue(defaults)
    queueMicrotask(() => {
      if (alive.current) void loadDetail()
    })
  }, [form, loadDetail, modeView?.canFetch])

  useEffect(() => {
    let active = true
    const generation = ++searchGeneration.current
    const timer = window.setTimeout(() => {
      void fetchCatalogProducts({
        page: 1,
        pageSize: 100,
        query: productQuery.trim() || undefined,
      })
        .then(({ data }) => {
          if (!active || generation !== searchGeneration.current) return
          setProducts((current) => {
            const selected = new Set(productIds)
            const byId = new Map(
              current
                .filter(({ id: productId }) => selected.has(productId))
                .map((product) => [product.id, product])
            )
            data.forEach((product) => byId.set(product.id, product))
            return [...byId.values()]
          })
        })
        .catch(() => undefined)
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
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
  const saveCollection = async (
    values: Values
  ): Promise<{ success: true } | { success: false; error: ApiError } | { cancelled: true }> => {
    if (isReadonly || permissionDenied || !alive.current || saveLock.current)
      return { cancelled: true }
    saveLock.current = true
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
      if (!alive.current) return { cancelled: true }
      setDetail(saved)
      setProductIds(saved.productIds)
      form.setFieldsValue({ ...toValues(saved), reason: '' })
      if (!drawer)
        void message.success(
          t(
            saved.status === 'published'
              ? 'Collection published for future storefront versions.'
              : detail
                ? 'Collection saved'
                : 'Collection created'
          )
        )
      return { success: true }
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (!alive.current) return { cancelled: true }
      setSaveError(normalized.message)
      const details = normalized.details as { backlinks?: CollectionBacklink[] } | undefined
      setBacklinks(details?.backlinks ?? [])
      return { success: false, error: normalized }
    } finally {
      saveLock.current = false
      if (alive.current) setSaveLoading(false)
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
      searchGeneration.current += 1
      form.resetFields()
      form.setFieldsValue(detail ? toValues(detail) : defaults)
      setProductQuery('')
      setProducts(detail?.products ?? [])
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
    onSubmit: async (values) => {
      await saveCollection(values)
    },
    sections: [
      {
        key: 'identity',
        title: t('Collection identity'),
        renderFields: () => (
          <>
            <Form.Item label={t('Name')} name="name" rules={[{ required: true }]}>
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
            <Form.Item label={t('Description')} name="description">
              <Input.TextArea rows={5} />
            </Form.Item>
            <Form.Item label={t('Cover media')} name="coverAssetId">
              <ContentMediaSelect allowClear disabled={isReadonly} source="collection" />
            </Form.Item>
            <Form.Item
              label={t('Status')}
              name="status"
              rules={[{ required: true }]}
              extra={
                targetStatus === 'published'
                  ? t(
                      'This collection becomes available to future storefront versions. The current storefront is unchanged.'
                    )
                  : undefined
              }
            >
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
              searchValue={productQuery}
              onSearch={setProductQuery}
              value={undefined}
              options={products
                .filter(({ id: productId }) => !productIds.includes(productId))
                .map((product) => ({
                  label: `${product.name} — ${product.slug}`,
                  value: product.id,
                }))}
              onChange={(productId: string) => {
                setProductIds((current) => [...current, productId])
                setProductQuery('')
              }}
            />
            {productIds.length ? (
              productIds.map((productId, index) => {
                const product = productById.get(productId)
                const label = product?.name ?? productId
                return (
                  <div
                    key={productId}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <span>{label}</span>
                    <SortActionGroup
                      index={index}
                      count={productIds.length}
                      disabled={isReadonly}
                      moveUpLabel={t('Move {name} up', { name: label })}
                      moveDownLabel={t('Move {name} down', { name: label })}
                      removeLabel={t('Remove {name}', { name: label })}
                      onMoveUp={() => moveProduct(index, -1)}
                      onMoveDown={() => moveProduct(index, 1)}
                      onRemove={() =>
                        setProductIds((current) => current.filter((id) => id !== productId))
                      }
                    />
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
            <Form.Item
              label={t('SEO title')}
              name="seoTitle"
              rules={[{ max: 300 }]}
              extra={t('Leave blank to use the name.')}
            >
              <Input maxLength={300} />
            </Form.Item>
            <Form.Item label={t('SEO description')} name="seoDescription">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              label={t(requiresReason ? 'Change reason' : 'Notes (optional)')}
              name="reason"
              rules={[requiresReason ? { required: true, min: 3, max: 500 } : { max: 500 }]}
            >
              <Input.TextArea rows={3} maxLength={500} />
            </Form.Item>
          </>
        ),
      },
    ],
    renderAfterForm: (
      <Space orientation="vertical" className="w-full">
        {detail ? (
          <Space orientation="vertical" className="w-full">
            <Tag>
              {t(
                detail.status === 'draft'
                  ? 'Draft'
                  : detail.status === 'published'
                    ? 'Published'
                    : 'Archived'
              )}
            </Tag>
            <details>
              <summary>{t('Collection version details')}</summary>
              <Space wrap>
                <Tag>{t('Saved Collection version {version}', { version: detail.version })}</Tag>
                {detail.candidate.candidateReleaseId ? (
                  <Tag color="blue">{t('Candidate')}</Tag>
                ) : null}
                {detail.candidate.liveReleaseId ? (
                  <span>{t('This version was included in a deployed storefront version.')}</span>
                ) : detail.candidate.liveStaleCause ? (
                  <span>{t('A deployed storefront version used an earlier source version.')}</span>
                ) : null}
              </Space>
            </details>
          </Space>
        ) : null}
        {saveError ? (
          drawer ? (
            <Typography.Text type="danger">{saveError}</Typography.Text>
          ) : (
            <Alert type="error" title={saveError} />
          )
        ) : null}
        <CollectionBlockedDependencies backlinks={backlinks} />
      </Space>
    ),
  }
  if (drawer) {
    const baselineIds = detail
      ? handoffProductId && !detail.productIds.includes(handoffProductId)
        ? [...detail.productIds, handoffProductId]
        : detail.productIds
      : handoffProductId
        ? [handoffProductId]
        : []
    const snapshot = (values: Partial<Values>, ids: string[]) =>
      JSON.stringify({
        name: values.name ?? '',
        slug: values.slug ?? '',
        description: values.description ?? '',
        coverAssetId: values.coverAssetId?.trim() || null,
        status: values.status ?? 'draft',
        redirectFromOldSlug: values.redirectFromOldSlug ?? false,
        seoTitle: values.seoTitle ?? '',
        seoDescription: values.seoDescription ?? '',
        reason: values.reason ?? '',
        productIds: ids,
      })
    return (
      <CrudFormDrawerRecipe<Values>
        spec={{
          ...spec,
          successTitle: t(
            targetStatus === 'published'
              ? 'Collection published for future storefront versions.'
              : parsedMode.ok && parsedMode.mode === 'add'
                ? 'Collection created'
                : 'Collection saved'
          ),
          hasUnsavedChanges: () =>
            snapshot(form.getFieldsValue(true), productIds) !==
            snapshot(detail ? toValues(detail) : defaults, baselineIds),
          onClose: drawer.onClose,
          onSaved: drawer.onSaved,
          onSubmit: saveCollection,
        }}
      />
    )
  }
  return <BasicCrudFormRecipe spec={spec} />
}
