import { Alert, Button, ColorPicker, Form, Input, InputNumber, Select, Upload, App } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createCatalogProduct,
  fetchCatalogProduct,
  updateCatalogProduct,
  updateCatalogProductOptionDefinitions,
  updateCatalogProductPresentation,
  uploadCatalogMedia,
  type ProductDetail,
  type ProductDraftPayload,
  type ProductOptionDefinition,
  type ProductPresentation,
} from '../../services/catalog/api'
import {
  LIST_REFRESH_CHANNEL,
  LIST_REFRESH_EVENT,
} from '../../shared/constants/list-refresh-channel'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import {
  BasicCrudFormRecipe,
  useTemplateFormController,
  type BasicCrudFormSpec,
} from '../../shared/template-kit/form'
import {
  goBackOrCloseWindow,
  useFormModeAccess,
  useListRefreshChannel,
} from '../../shared/template-kit/hooks'
import { PublishedProductRevisionEditor } from './published-product-revision-editor'

void React

type CatalogFormValues = {
  name: string
  slug: string
  description: string
  seoTitle: string
  seoDescription: string
  sku: string
  variantTitle: string
  optionColor?: string
  weightGrams: number
  lengthMm: number
  widthMm: number
  heightMm: number
  publicationStatus: 'draft' | 'scheduled'
  scheduledAt?: string
  categorySlugs?: string
  amount: number
  compareAtAmount?: number
  currency: string
  priceListCode: string
  mediaKey: string
  altText: string
  mediaWidth: number
  mediaHeight: number
}

const defaults: Partial<CatalogFormValues> = {
  amount: 0,
  currency: 'USD',
  priceListCode: 'GLOBAL-USD',
  mediaWidth: 1200,
  mediaHeight: 1200,
  weightGrams: 0,
  lengthMm: 0,
  widthMm: 0,
  heightMm: 0,
  publicationStatus: 'draft',
}

const toValues = (detail: ProductDetail): CatalogFormValues => {
  const variant = detail.variants[0]
  const price = detail.prices[0]
  const media = detail.media[0]
  const optionValues = variant
    ? (JSON.parse(variant.option_values_json) as Record<string, string>)
    : {}
  return {
    name: detail.product.name,
    slug: detail.product.slug,
    description: detail.product.description,
    seoTitle: detail.product.seo_title,
    seoDescription: detail.product.seo_description,
    sku: variant?.sku ?? '',
    variantTitle: variant?.title ?? '',
    optionColor: optionValues.color,
    weightGrams: variant?.weight_grams ?? 0,
    lengthMm: variant?.length_mm ?? 0,
    widthMm: variant?.width_mm ?? 0,
    heightMm: variant?.height_mm ?? 0,
    publicationStatus: detail.product.status === 'scheduled' ? 'scheduled' : 'draft',
    scheduledAt: detail.product.scheduled_at ?? undefined,
    categorySlugs: detail.categories?.map((item) => item.slug).join(', '),
    amount: price?.amount ?? 0,
    compareAtAmount: price?.compare_at_amount ?? undefined,
    currency: price?.currency ?? 'USD',
    priceListCode: price?.price_list_code ?? 'GLOBAL-USD',
    mediaKey: media?.r2_key ?? '',
    altText: media?.alt_text ?? '',
    mediaWidth: media?.width ?? 1200,
    mediaHeight: media?.height ?? 1200,
  }
}

const taxonomyItems = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean)
    .map((slug) => ({
      slug,
      name: slug
        .split('-')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' '),
    }))

const toPayload = (values: CatalogFormValues): ProductDraftPayload => ({
  categories: taxonomyItems(values.categorySlugs),
  collections: [],
  description: values.description,
  media: [
    {
      altText: values.altText,
      height: values.mediaHeight,
      r2Key: values.mediaKey,
      width: values.mediaWidth,
    },
  ],
  name: values.name,
  optionDefinitions: values.optionColor
    ? [
        {
          name: 'color',
          presentation: 'text',
          values: [{ label: values.optionColor }],
        },
      ]
    : [],
  seoDescription: values.seoDescription,
  seoTitle: values.seoTitle,
  slug: values.slug,
  publicationStatus: values.publicationStatus,
  scheduledAt:
    values.publicationStatus === 'scheduled' && values.scheduledAt
      ? new Date(values.scheduledAt).toISOString()
      : null,
  variants: [
    {
      optionValues: values.optionColor ? { color: values.optionColor } : {},
      dimensionsMm: {
        height: values.heightMm,
        length: values.lengthMm,
        width: values.widthMm,
      },
      prices: [
        {
          amount: values.amount,
          ...(values.compareAtAmount === undefined
            ? {}
            : { compareAtAmount: values.compareAtAmount }),
          currency: values.currency.toUpperCase(),
          priceListCode: values.priceListCode,
        },
      ],
      sku: values.sku,
      title: values.variantTitle,
      weightGrams: values.weightGrams,
    },
  ],
})

const safeMediaKey = (file: File) => {
  const normalized = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return `catalog/products/${crypto.randomUUID()}-${normalized}`
}

const deriveOptionDefinitions = (detail: ProductDetail): ProductOptionDefinition[] => {
  try {
    const stored = JSON.parse(detail.product.option_definitions_json) as ProductOptionDefinition[]
    if (stored.length > 0) return stored
  } catch {
    // The API rejects invalid persisted JSON; old rows still receive a safe derived text view.
  }
  const valuesByName = new Map<string, string[]>()
  detail.variants.forEach((variant) => {
    const optionValues = JSON.parse(variant.option_values_json) as Record<string, string>
    Object.entries(optionValues).forEach(([name, value]) => {
      const values = valuesByName.get(name) ?? []
      if (!values.includes(value)) values.push(value)
      valuesByName.set(name, values)
    })
  })
  return [...valuesByName].map(([name, values]) => ({
    name,
    presentation: 'text',
    values: values.map((label) => ({ label })),
  }))
}

const deriveProductPresentation = (detail: ProductDetail): ProductPresentation => {
  if (detail.product.presentation_json) {
    try {
      return JSON.parse(detail.product.presentation_json) as ProductPresentation
    } catch {
      // The API and database reject invalid JSON; retain a safe empty editor for legacy rows.
    }
  }
  return { specifications: [] }
}

export const CatalogFormPage = () => {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<CatalogFormValues>()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fromSetupGuide = searchParams.get('from') === 'setup-guide'
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [optionDefinitions, setOptionDefinitions] = useState<ProductOptionDefinition[]>([])
  const [optionExpectedVersion, setOptionExpectedVersion] = useState(0)
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({})
  const [optionSaving, setOptionSaving] = useState(false)
  const [optionHydrationKey, setOptionHydrationKey] = useState<string | null>(null)
  const [productPresentation, setProductPresentation] = useState<ProductPresentation>({
    specifications: [],
  })
  const [presentationExpectedVersion, setPresentationExpectedVersion] = useState(0)
  const [presentationSaving, setPresentationSaving] = useState(false)
  const [presentationError, setPresentationError] = useState<string | null>(null)
  const { role, permissions } = useAuth()
  const { publishRefresh } = useListRefreshChannel({
    channelName: LIST_REFRESH_CHANNEL,
    eventType: LIST_REFRESH_EVENT.REFRESH_LIST,
  })
  const { parsedMode, modeView, isReadonly, permissionDenied } = useFormModeAccess({
    searchParams,
    role,
    permissions,
    readPermission: 'catalog.read',
    writePermission: 'catalog.write',
  })

  const preparePayload = async (payload: ProductDraftPayload) => {
    if (pendingFile) {
      await uploadCatalogMedia(payload.media[0]!.r2Key, pendingFile)
    }
    return payload
  }

  const {
    detailData,
    detailLoading,
    detailError,
    saveLoading,
    initializeForm,
    loadDetail,
    resetFormValues,
    submitFormValues,
  } = useTemplateFormController<CatalogFormValues, ProductDetail, ProductDraftPayload, ApiError>({
    form,
    parsedMode,
    modeView,
    defaultValues: defaults,
    fetchDetail: fetchCatalogProduct,
    createEntity: async (payload) => {
      const created = await createCatalogProduct(await preparePayload(payload))
      return fetchCatalogProduct(created.id)
    },
    updateEntity: async (id, payload) => {
      const prepared = await preparePayload(payload)
      const { optionDefinitions: _createOnlyOptionDefinitions, ...ordinaryUpdate } = prepared
      await updateCatalogProduct(id, {
        ...ordinaryUpdate,
        collections:
          detailData?.collections?.map(({ name, slug }) => ({ name, slug })) ?? [],
        expectedVersion: optionExpectedVersion,
      })
      return fetchCatalogProduct(id)
    },
    toValues,
    toPayload,
    mapError: normalizeApiError,
  })

  useEffect(() => {
    void initializeForm()
  }, [initializeForm])

  const detailOptionHydrationKey = detailData
    ? `${detailData.product.id}:${detailData.product.version}`
    : null
  if (detailOptionHydrationKey !== optionHydrationKey) {
    setOptionHydrationKey(detailOptionHydrationKey)
    setOptionDefinitions(detailData ? deriveOptionDefinitions(detailData) : [])
    setOptionExpectedVersion(detailData?.product.version ?? 0)
    setOptionErrors({})
    setProductPresentation(
      detailData ? deriveProductPresentation(detailData) : { specifications: [] }
    )
    setPresentationExpectedVersion(detailData?.product.version ?? 0)
    setPresentationError(null)
  }

  const isAddMode = parsedMode.ok && parsedMode.mode === 'add'
  const catalogShapeLocked = Boolean(
    detailData &&
    (detailData.product.status === 'published' ||
      detailData.product.status === 'archived' ||
      detailData.variants.length !== 1 ||
      detailData.prices.length !== 1 ||
      detailData.media.length !== 1)
  )
  const effectiveReadonly = isReadonly || catalogShapeLocked
  const optionPresentationReadonly = Boolean(
    !detailData ||
    isReadonly ||
    detailData.product.status === 'published' ||
    detailData.product.status === 'archived'
  )

  const openCollectionManagement = useCallback(() => {
    if (!detailData) return
    const proceed = () => {
      const returnParams = new URLSearchParams(searchParams)
      const returnTo = `/catalog/products/form?${returnParams.toString()}`
      const params = new URLSearchParams({
        handoffProductId: detailData.product.id,
        returnTo,
      })
      navigate(`/catalog/collections?${params.toString()}`)
    }
    if (!form.isFieldsTouched() && !pendingFile) {
      proceed()
      return
    }
    modal.confirm({
      title: t('Leave with unsaved Product changes?'),
      content: t('Collection membership is edited separately. Continuing discards unsaved Product changes.'),
      okText: t('Open Collection management'),
      onOk: proceed,
    })
  }, [detailData, form, modal, navigate, pendingFile, searchParams, t])

  const replaceOptionDefinition = useCallback(
    (
      definitionIndex: number,
      update: (definition: ProductOptionDefinition) => ProductOptionDefinition
    ) => {
      setOptionDefinitions((current) =>
        current.map((definition, index) =>
          index === definitionIndex ? update(definition) : definition
        )
      )
    },
    []
  )

  const changePresentation = useCallback(
    (definitionIndex: number, presentation: ProductOptionDefinition['presentation']) => {
      const definition = optionDefinitions[definitionIndex]
      if (!definition || definition.presentation === presentation) return
      const apply = () =>
        replaceOptionDefinition(definitionIndex, (current) => ({
          ...current,
          presentation,
          values: current.values.map(({ label, swatch }) =>
            presentation === 'text' ? { label } : { label, ...(swatch ? { swatch } : {}) }
          ),
        }))
      if (presentation === 'text' && definition.values.some(({ swatch }) => swatch)) {
        modal.confirm({
          title: t('Remove color swatches?'),
          content: t('Changing this option to text presentation removes every saved swatch.'),
          okText: t('Confirm and save'),
          onOk: apply,
        })
        return
      }
      apply()
    },
    [modal, optionDefinitions, replaceOptionDefinition, t]
  )

  const changeSwatch = useCallback(
    (definitionIndex: number, valueIndex: number, swatch: string) => {
      replaceOptionDefinition(definitionIndex, (definition) => ({
        ...definition,
        values: definition.values.map((value, index) =>
          index === valueIndex ? { ...value, swatch: swatch.toLowerCase() } : value
        ),
      }))
      setOptionErrors((current) => {
        const next = { ...current }
        delete next[`${definitionIndex}:${valueIndex}`]
        return next
      })
    },
    [replaceOptionDefinition]
  )

  const saveOptionDefinitions = useCallback(async () => {
    if (!detailData || optionPresentationReadonly) return
    const errors: Record<string, string> = {}
    optionDefinitions.forEach((definition, definitionIndex) => {
      if (definition.presentation !== 'color') return
      definition.values.forEach((value, valueIndex) => {
        if (!value.swatch || !/^#[0-9a-f]{6}$/.test(value.swatch)) {
          errors[`${definitionIndex}:${valueIndex}`] = t('Use an opaque color in #rrggbb format.')
        }
      })
    })
    setOptionErrors(errors)
    if (Object.keys(errors).length) return
    setOptionSaving(true)
    try {
      const result = await updateCatalogProductOptionDefinitions(
        detailData.product.id,
        optionDefinitions,
        optionExpectedVersion
      )
      setOptionDefinitions(result.optionDefinitions)
      setOptionExpectedVersion(result.version)
      setPresentationExpectedVersion(result.version)
      void message.success(t('Option presentation saved'))
      publishRefresh({ source: 'catalog-option-presentation' })
    } catch (error) {
      const normalized = normalizeApiError(error)
      const details = Array.isArray(normalized.details) ? normalized.details : []
      const fieldErrors: Record<string, string> = {}
      details.forEach((detail) => {
        if (!detail || typeof detail !== 'object' || !('path' in detail)) return
        const path = (detail as { message?: string; path?: unknown[] }).path
        const definitionIndex = path?.[1]
        const valueIndex = path?.[3]
        if (typeof definitionIndex === 'number' && typeof valueIndex === 'number') {
          fieldErrors[`${definitionIndex}:${valueIndex}`] =
            (detail as { message?: string }).message ?? normalized.message
        }
      })
      setOptionErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) void message.error(normalized.message)
    } finally {
      setOptionSaving(false)
    }
  }, [
    detailData,
    message,
    optionDefinitions,
    optionExpectedVersion,
    optionPresentationReadonly,
    publishRefresh,
    t,
  ])

  const saveProductPresentation = useCallback(async () => {
    if (!detailData || optionPresentationReadonly) return
    const specifications = productPresentation.specifications.map(({ label, value }) => ({
      label: label.trim(),
      value: value.trim(),
    }))
    const duplicateLabels = new Set<string>()
    const labels = new Set<string>()
    specifications.forEach(({ label }) => {
      const normalized = label.toLocaleLowerCase()
      if (labels.has(normalized)) duplicateLabels.add(normalized)
      labels.add(normalized)
    })
    if (specifications.some(({ label, value }) => !label || !value) || duplicateLabels.size) {
      setPresentationError(t('Every specification needs a unique label and a non-empty value.'))
      return
    }
    const text = (value?: string) => value?.trim() || undefined
    const detail = productPresentation.detail
    const normalized: ProductPresentation = {
      ...(text(productPresentation.brand) ? { brand: text(productPresentation.brand) } : {}),
      ...(productPresentation.defaultVariantId
        ? { defaultVariantId: productPresentation.defaultVariantId }
        : {}),
      ...(detail &&
      (text(detail.body) || text(detail.eyebrow) || text(detail.heading) || detail.bullets.length)
        ? {
            detail: {
              ...(text(detail.body) ? { body: text(detail.body) } : {}),
              bullets: detail.bullets.map((bullet) => bullet.trim()).filter(Boolean),
              ...(text(detail.eyebrow) ? { eyebrow: text(detail.eyebrow) } : {}),
              ...(text(detail.heading) ? { heading: text(detail.heading) } : {}),
            },
          }
        : {}),
      ...(productPresentation.detailMediaId
        ? { detailMediaId: productPresentation.detailMediaId }
        : {}),
      specifications,
    }
    setPresentationSaving(true)
    setPresentationError(null)
    try {
      const result = await updateCatalogProductPresentation(
        detailData.product.id,
        normalized,
        presentationExpectedVersion
      )
      setProductPresentation(result.presentation)
      setPresentationExpectedVersion(result.version)
      setOptionExpectedVersion(result.version)
      void message.success(t('Product presentation saved'))
      publishRefresh({ source: 'catalog-product-presentation' })
    } catch (error) {
      setPresentationError(normalizeApiError(error).message)
    } finally {
      setPresentationSaving(false)
    }
  }, [
    detailData,
    message,
    optionPresentationReadonly,
    presentationExpectedVersion,
    productPresentation,
    publishRefresh,
    t,
  ])
  const spec = useMemo<BasicCrudFormSpec<CatalogFormValues>>(
    () => ({
      parsedMode,
      modeView,
      permissionDenied,
      detailLoading,
      detailError,
      saveLoading,
      isReadonly: effectiveReadonly,
      form,
      initialValues: defaults,
      title: t(isAddMode ? 'New product' : 'Product details'),
      contentWidthPreset: 'wide',
      stateCopy: {
        submitBlockedMessage: t(
          catalogShapeLocked
            ? 'This catalog shape cannot be edited without losing stored data.'
            : 'Readonly mode does not allow catalog changes.'
        ),
        submitSuccessMessage: t(isAddMode ? 'Product created' : 'Product saved'),
      },
      onBackToList: () =>
        fromSetupGuide
          ? navigate('/catalog/products?from=setup-guide')
          : goBackOrCloseWindow('/catalog/products'),
      onRetryDetail: () => void loadDetail(),
      onResetAll: () => {
        setPendingFile(null)
        resetFormValues()
      },
      onSubmit: async (values) => {
        if (effectiveReadonly) return
        const result = await submitFormValues(values)
        if (result.success) {
          void message.success(translateNow(isAddMode ? 'Product created' : 'Product saved'))
          publishRefresh({ source: 'catalog-form' })
          return
        }
        void message.error(result.error.message)
      },
      sections: [
        {
          key: 'product',
          title: t('Product'),
          contentWidthPreset: 'wide',
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
                  {
                    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                    message: t('Use lowercase URL-safe text.'),
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t('Description')} name="description" rules={[{ required: true }]}>
                <Input.TextArea rows={5} />
              </Form.Item>
              <Form.Item
                label={t('Category slugs')}
                name="categorySlugs"
                extra={t('Comma-separated URL-safe slugs')}
              >
                <Input placeholder="travel, luggage" />
              </Form.Item>
              {detailData ? (
                <Form.Item label={t('Collections')}>
                  <div className="space-y-2">
                    <div>
                      {detailData.collections?.length
                        ? detailData.collections.map(({ name }) => name).join(', ')
                        : t('This Product is not in any Collection.')}
                    </div>
                    {!isReadonly ? (
                      <Button onClick={openCollectionManagement}>
                        {t('Manage Collection membership')}
                      </Button>
                    ) : null}
                  </div>
                </Form.Item>
              ) : null}
              <Form.Item
                label={t('Publication status')}
                name="publicationStatus"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: t('Draft'), value: 'draft' },
                    { label: t('Scheduled'), value: 'scheduled' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(previous, current) =>
                  previous.publicationStatus !== current.publicationStatus
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('publicationStatus') === 'scheduled' ? (
                    <Form.Item
                      label={t('Publish at')}
                      name="scheduledAt"
                      rules={[{ required: true, message: t('Choose an ISO publication time.') }]}
                    >
                      <Input type="datetime-local" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </>
          ),
        },
        {
          key: 'variant',
          title: t('Variant and price'),
          contentWidthPreset: 'wide',
          renderFields: () => (
            <>
              <Form.Item label="SKU" name="sku" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item
                label={t('Variant title')}
                name="variantTitle"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              {isAddMode ? (
                <Form.Item label={t('Initial color option value')} name="optionColor">
                  <Input />
                </Form.Item>
              ) : null}
              <Form.Item
                label={t('Weight (grams)')}
                name="weightGrams"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item label={t('Length (mm)')} name="lengthMm" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item label={t('Width (mm)')} name="widthMm" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item label={t('Height (mm)')} name="heightMm" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item
                label={t('Price (minor currency units)')}
                name="amount"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item
                label={t('Compare-at price (minor currency units)')}
                name="compareAtAmount"
                dependencies={['amount']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value?: number) => {
                      if (value === undefined || value === null) return
                      if (value > Number(getFieldValue('amount'))) return
                      throw new Error(t('Compare-at price must be greater than the current price.'))
                    },
                  }),
                ]}
              >
                <InputNumber min={0} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item label={t('Currency')} name="currency" rules={[{ required: true, len: 3 }]}>
                <Input maxLength={3} />
              </Form.Item>
              <Form.Item
                label={t('Price list code')}
                name="priceListCode"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </>
          ),
        },
        {
          key: 'media-seo',
          title: t('Media and SEO'),
          contentWidthPreset: 'wide',
          renderFields: () => (
            <>
              {!effectiveReadonly ? (
                <Form.Item label={t('Catalog image')} required>
                  <Upload
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    maxCount={1}
                    beforeUpload={(file) => {
                      if (
                        !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
                      ) {
                        void message.error(t('Only JPEG, PNG, WebP, and GIF are allowed.'))
                        return Upload.LIST_IGNORE
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        void message.error(t('Catalog media must not exceed 10 MiB.'))
                        return Upload.LIST_IGNORE
                      }
                      setPendingFile(file)
                      form.setFieldValue('mediaKey', safeMediaKey(file))
                      return false
                    }}
                  >
                    <Button icon={<UploadOutlined />}>{t('Choose image')}</Button>
                  </Upload>
                </Form.Item>
              ) : null}
              <Form.Item label={t('Media key')} name="mediaKey" rules={[{ required: true }]}>
                <Input readOnly />
              </Form.Item>
              <Form.Item label={t('Alt text')} name="altText" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label={t('Image width')} name="mediaWidth" rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item label={t('Image height')} name="mediaHeight" rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item
                label={t('SEO title')}
                name="seoTitle"
                rules={[{ required: true, max: 70 }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label={t('SEO description')}
                name="seoDescription"
                rules={[{ required: true, max: 320 }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ),
        },
      ],
      renderAfterForm: detailData ? (
        <div className="space-y-6">
          <section aria-label={t('Option presentation')} className="space-y-4">
            <div>
              <h2>{t('Option presentation')}</h2>
              <p>{t('Option names and values come from variants and cannot be changed here.')}</p>
            </div>
            {optionDefinitions.map((definition, definitionIndex) => (
              <fieldset
                key={definition.name}
                className="rounded border border-solid border-gray-200 p-4"
              >
                <legend className="px-2 font-medium">{definition.name}</legend>
                <label className="mb-4 block">
                  <span className="mb-1 block">{t('Presentation kind')}</span>
                  <Select
                    aria-label={`${definition.name} ${t('Presentation kind')}`}
                    disabled={optionPresentationReadonly}
                    value={definition.presentation}
                    options={[
                      { label: t('Text'), value: 'text' },
                      { label: t('Color'), value: 'color' },
                    ]}
                    onChange={(value) => changePresentation(definitionIndex, value)}
                  />
                </label>
                <ul className="space-y-3">
                  {definition.values.map((value, valueIndex) => {
                    const error = optionErrors[`${definitionIndex}:${valueIndex}`]
                    const errorId = `option-swatch-error-${definitionIndex}-${valueIndex}`
                    return (
                      <li key={value.label} className="flex flex-wrap items-start gap-3">
                        <span className="min-w-28 pt-1 font-medium">{value.label}</span>
                        {definition.presentation === 'color' ? (
                          <>
                            <ColorPicker
                              aria-label={`${definition.name} ${value.label} ${t('Color picker')}`}
                              disabled={optionPresentationReadonly}
                              disabledAlpha
                              value={value.swatch || '#000000'}
                              onChangeComplete={(color) =>
                                changeSwatch(definitionIndex, valueIndex, color.toHexString())
                              }
                            />
                            <div>
                              <Input
                                aria-label={`${definition.name} ${value.label} ${t('Swatch')}`}
                                disabled={optionPresentationReadonly}
                                aria-describedby={error ? errorId : undefined}
                                aria-invalid={Boolean(error)}
                                status={error ? 'error' : undefined}
                                value={value.swatch ?? ''}
                                onBlur={(event) =>
                                  changeSwatch(definitionIndex, valueIndex, event.target.value)
                                }
                                onChange={(event) =>
                                  changeSwatch(definitionIndex, valueIndex, event.target.value)
                                }
                              />
                              {error ? (
                                <p id={errorId} className="mt-1 text-red-600">
                                  {error}
                                </p>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            ))}
            <Button
              type="primary"
              disabled={optionPresentationReadonly || optionDefinitions.length === 0}
              loading={optionSaving}
              onClick={() => void saveOptionDefinitions()}
            >
              {t('Save option presentation')}
            </Button>
          </section>
          <section aria-label={t('Product presentation')} className="space-y-4">
            <div>
              <h2>{t('Product presentation')}</h2>
              <p>
                {t(
                  'These released fields supply the existing Product page; related products continue to follow collection order.'
                )}
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block">{t('Brand')}</span>
              <Input
                disabled={optionPresentationReadonly}
                value={productPresentation.brand ?? ''}
                onChange={(event) =>
                  setProductPresentation((current) => ({
                    ...current,
                    brand: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block">{t('Default variant')}</span>
              <Select
                allowClear
                className="w-full"
                disabled={optionPresentationReadonly}
                options={detailData.variants.map((variant) => ({
                  label: `${variant.sku} — ${variant.title}`,
                  value: variant.id,
                }))}
                value={productPresentation.defaultVariantId}
                onChange={(value) =>
                  setProductPresentation((current) => ({
                    ...current,
                    defaultVariantId: value,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block">{t('Detail media')}</span>
              <Select
                allowClear
                className="w-full"
                disabled={optionPresentationReadonly}
                options={detailData.media.map((media) => ({
                  label: `${media.alt_text} — ${media.r2_key}`,
                  value: media.id,
                }))}
                value={productPresentation.detailMediaId}
                onChange={(value) =>
                  setProductPresentation((current) => ({ ...current, detailMediaId: value }))
                }
              />
            </label>
            {(['eyebrow', 'heading', 'body'] as const).map((field) => (
              <label key={field} className="block">
                <span className="mb-1 block">
                  {t(
                    field === 'eyebrow'
                      ? 'Detail eyebrow'
                      : field === 'heading'
                        ? 'Detail heading'
                        : 'Detail body'
                  )}
                </span>
                <Input.TextArea
                  disabled={optionPresentationReadonly}
                  rows={field === 'body' ? 4 : 2}
                  value={productPresentation.detail?.[field] ?? ''}
                  onChange={(event) =>
                    setProductPresentation((current) => ({
                      ...current,
                      detail: {
                        bullets: current.detail?.bullets ?? [],
                        ...current.detail,
                        [field]: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block">{t('Detail bullets')}</span>
              <Input.TextArea
                disabled={optionPresentationReadonly}
                rows={5}
                value={(productPresentation.detail?.bullets ?? []).join('\n')}
                onChange={(event) =>
                  setProductPresentation((current) => ({
                    ...current,
                    detail: {
                      ...current.detail,
                      bullets: event.target.value.split('\n'),
                    },
                  }))
                }
              />
            </label>
            <fieldset className="space-y-3 rounded border border-solid border-gray-200 p-4">
              <legend className="px-2 font-medium">{t('Specifications')}</legend>
              {productPresentation.specifications.map((specification, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input
                    aria-label={`${t('Specification label')} ${index + 1}`}
                    disabled={optionPresentationReadonly}
                    placeholder={t('Label')}
                    value={specification.label}
                    onChange={(event) =>
                      setProductPresentation((current) => ({
                        ...current,
                        specifications: current.specifications.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Input
                    aria-label={`${t('Specification value')} ${index + 1}`}
                    disabled={optionPresentationReadonly}
                    placeholder={t('Value')}
                    value={specification.value}
                    onChange={(event) =>
                      setProductPresentation((current) => ({
                        ...current,
                        specifications: current.specifications.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item
                        ),
                      }))
                    }
                  />
                  <div className="flex gap-1">
                    <Button
                      aria-label={`${t('Move specification up')} ${index + 1}`}
                      disabled={optionPresentationReadonly || index === 0}
                      onClick={() =>
                        setProductPresentation((current) => {
                          const specifications = [...current.specifications]
                          ;[specifications[index - 1], specifications[index]] = [
                            specifications[index]!,
                            specifications[index - 1]!,
                          ]
                          return { ...current, specifications }
                        })
                      }
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label={`${t('Move specification down')} ${index + 1}`}
                      disabled={
                        optionPresentationReadonly ||
                        index === productPresentation.specifications.length - 1
                      }
                      onClick={() =>
                        setProductPresentation((current) => {
                          const specifications = [...current.specifications]
                          ;[specifications[index], specifications[index + 1]] = [
                            specifications[index + 1]!,
                            specifications[index]!,
                          ]
                          return { ...current, specifications }
                        })
                      }
                    >
                      ↓
                    </Button>
                    <Button
                      danger
                      aria-label={`${t('Remove specification')} ${index + 1}`}
                      disabled={optionPresentationReadonly}
                      onClick={() =>
                        setProductPresentation((current) => ({
                          ...current,
                          specifications: current.specifications.filter(
                            (_, itemIndex) => itemIndex !== index
                          ),
                        }))
                      }
                    >
                      {t('Remove')}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                disabled={optionPresentationReadonly}
                onClick={() =>
                  setProductPresentation((current) => ({
                    ...current,
                    specifications: [...current.specifications, { label: '', value: '' }],
                  }))
                }
              >
                {t('Add specification')}
              </Button>
            </fieldset>
            {presentationError ? <Alert showIcon type="error" title={presentationError} /> : null}
            <Button
              type="primary"
              disabled={optionPresentationReadonly}
              loading={presentationSaving}
              onClick={() => void saveProductPresentation()}
            >
              {t('Save product presentation')}
            </Button>
          </section>
          <section aria-label={t('Stored catalog shape')} className="space-y-3">
            {catalogShapeLocked ? (
              <Alert
                showIcon
                type="warning"
                title={t('This catalog shape is read-only in the scalar editor.')}
                description={t(
                  'Editing is disabled because this product is published or contains multiple variants, prices, or media items.'
                )}
              />
            ) : null}
            <p>
              {detailData.variants.length} {t('variants')} · {detailData.prices.length}{' '}
              {t('prices')} · {detailData.media.length} {t('media items')}
            </p>
            <div>
              <h3>{t('Stored variants and prices')}</h3>
              <ul>
                {detailData.variants.map((variant) => (
                  <li key={variant.id}>
                    <strong>{variant.sku}</strong> — {variant.title}
                    <ul>
                      {detailData.prices
                        .filter((price) => price.variant_id === variant.id)
                        .map((price) => (
                          <li key={`${variant.id}:${price.price_list_code}`}>
                            {price.amount} {price.currency}
                            {price.compare_at_amount == null
                              ? null
                              : ` (${t('compare at')} ${price.compare_at_amount})`}{' '}
                            · {price.price_list_code}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{t('Stored media')}</h3>
              <ul>
                {detailData.media.map((media) => (
                  <li key={media.r2_key}>
                    <strong>{media.r2_key}</strong> — {media.alt_text} ({media.width}×{media.height}
                    )
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null,
    }),
    [
      message,
      detailError,
      detailData,
      detailLoading,
      catalogShapeLocked,
      changePresentation,
      changeSwatch,
      optionDefinitions,
      optionErrors,
      openCollectionManagement,
      optionPresentationReadonly,
      optionSaving,
      productPresentation,
      presentationError,
      presentationSaving,
      effectiveReadonly,
      form,
      fromSetupGuide,
      navigate,
      isAddMode,
      isReadonly,
      loadDetail,
      modeView,
      parsedMode,
      permissionDenied,
      publishRefresh,
      resetFormValues,
      saveOptionDefinitions,
      saveProductPresentation,
      saveLoading,
      submitFormValues,
      t,
      translateNow,
    ]
  )

  return (
    <>
      <BasicCrudFormRecipe spec={spec} />
      {detailData?.product.status === 'published' ? (
        <PublishedProductRevisionEditor
          canEdit={!isReadonly}
          detail={detailData}
          onChanged={() => publishRefresh({ source: 'catalog-product-revision' })}
        />
      ) : null}
    </>
  )
}
