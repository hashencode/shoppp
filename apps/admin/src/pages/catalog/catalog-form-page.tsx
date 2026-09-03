import { Button, Form, Input, InputNumber, Select, Upload, App } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createCatalogProduct,
  fetchCatalogProduct,
  updateCatalogProduct,
  uploadCatalogMedia,
  type ProductDetail,
  type ProductDraftPayload,
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
  collectionSlugs?: string
  amount: number
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
    collectionSlugs: detail.collections?.map((item) => item.slug).join(', '),
    amount: price?.amount ?? 0,
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
  collections: taxonomyItems(values.collectionSlugs),
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

export const CatalogFormPage = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm<CatalogFormValues>()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fromSetupGuide = searchParams.get('from') === 'setup-guide'
  const [pendingFile, setPendingFile] = useState<File | null>(null)
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
      await updateCatalogProduct(id, await preparePayload(payload))
      return fetchCatalogProduct(id)
    },
    toValues,
    toPayload,
    mapError: normalizeApiError,
  })

  useEffect(() => {
    void initializeForm()
  }, [initializeForm])

  const isAddMode = parsedMode.ok && parsedMode.mode === 'add'
  const spec = useMemo<BasicCrudFormSpec<CatalogFormValues>>(
    () => ({
      parsedMode,
      modeView,
      permissionDenied,
      detailLoading,
      detailError,
      saveLoading,
      isReadonly,
      form,
      initialValues: defaults,
      title: t(isAddMode ? 'New product' : 'Product details'),
      contentWidthPreset: 'wide',
      stateCopy: {
        submitBlockedMessage: t('Readonly mode does not allow catalog changes.'),
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
        if (isReadonly) return
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
              <Form.Item
                label={t('Collection slugs')}
                name="collectionSlugs"
                extra={t('Comma-separated URL-safe slugs')}
              >
                <Input placeholder="new-arrivals, summer-2026" />
              </Form.Item>
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
              <Form.Item label={t('Color option')} name="optionColor">
                <Input />
              </Form.Item>
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
              {!isReadonly ? (
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
    }),
    [
      message,
      detailError,
      detailLoading,
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
      saveLoading,
      submitFormValues,
      t,
      translateNow,
    ]
  )

  return <BasicCrudFormRecipe spec={spec} />
}
