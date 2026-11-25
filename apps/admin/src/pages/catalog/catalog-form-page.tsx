import { FilePicker } from '../../shared/components/file-picker'
import {
  Alert,
  Button,
  ColorPicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  App,
  Typography,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'
import { SortActionGroup } from '../../shared/components/sort-action-group'
import { PublishedProductRevisionEditor } from './published-product-revision-editor'

void React

type PresentationSaveResult =
  { success: true } | { success: false; error: ApiError } | { cancelled: true }

type OptionFieldError = { kind: 'invalid-swatch' } | { kind: 'request'; message: string }

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

const normalizeProductPresentation = (presentation: ProductPresentation): ProductPresentation => {
  const text = (value?: string) => value?.trim() || undefined
  const detail = presentation.detail
  return {
    ...(text(presentation.brand) ? { brand: text(presentation.brand) } : {}),
    ...(presentation.defaultVariantId ? { defaultVariantId: presentation.defaultVariantId } : {}),
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
    ...(presentation.detailMediaId ? { detailMediaId: presentation.detailMediaId } : {}),
    specifications: presentation.specifications.map(({ label, value }) => ({
      label: label.trim(),
      value: value.trim(),
    })),
  }
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
  const [optionErrors, setOptionErrors] = useState<Record<string, OptionFieldError>>({})
  const [optionSaving, setOptionSaving] = useState(false)
  const [presentationEditor, setPresentationEditor] = useState<'options' | 'presentation' | null>(
    null
  )
  const [swatchConfirmOpen, setSwatchConfirmOpen] = useState(false)
  const [presentationForm] = Form.useForm()
  const [savedOptions, setSavedOptions] = useState<ProductOptionDefinition[]>([])
  const [savedPresentation, setSavedPresentation] = useState<ProductPresentation>({
    specifications: [],
  })
  const mutationLock = useRef(false)
  const [optionHydrationKey, setOptionHydrationKey] = useState<string | null>(null)
  const [productPresentation, setProductPresentation] = useState<ProductPresentation>({
    specifications: [],
  })
  const [presentationExpectedVersion, setPresentationExpectedVersion] = useState(0)
  const [presentationSaving, setPresentationSaving] = useState(false)
  const [presentationError, setPresentationError] = useState<'invalid-specifications' | null>(null)
  const specificationFields = useRef<HTMLDivElement>(null)
  const [presentationRequestError, setPresentationRequestError] = useState<string | null>(null)
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
        collections: detailData?.collections?.map(({ name, slug }) => ({ name, slug })) ?? [],
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
    const nextOptions = detailData ? deriveOptionDefinitions(detailData) : []
    const nextPresentation = detailData
      ? deriveProductPresentation(detailData)
      : { specifications: [] }
    setSavedOptions(structuredClone(nextOptions))
    setSavedPresentation(structuredClone(nextPresentation))
    setOptionDefinitions(nextOptions)
    setOptionExpectedVersion(detailData?.product.version ?? 0)
    setOptionErrors({})
    setPresentationRequestError(null)
    setProductPresentation(nextPresentation)
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
      content: t(
        'Collection membership is edited separately. Continuing discards unsaved Product changes.'
      ),
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
        setSwatchConfirmOpen(true)
        modal.confirm({
          afterClose: () => setSwatchConfirmOpen(false),
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

  const saveOptionDefinitions = useCallback(async (): Promise<PresentationSaveResult> => {
    if (
      !detailData ||
      optionPresentationReadonly ||
      mutationLock.current ||
      saveLoading ||
      optionDefinitions.length === 0
    )
      return { cancelled: true }
    const errors: Record<string, OptionFieldError> = {}
    optionDefinitions.forEach((definition, definitionIndex) => {
      if (definition.presentation !== 'color') return
      definition.values.forEach((value, valueIndex) => {
        if (!value.swatch || !/^#[0-9a-f]{6}$/.test(value.swatch)) {
          errors[`${definitionIndex}:${valueIndex}`] = { kind: 'invalid-swatch' }
        }
      })
    })
    setOptionErrors(errors)
    setPresentationRequestError(null)
    if (Object.keys(errors).length) return { cancelled: true }
    mutationLock.current = true
    setOptionSaving(true)
    try {
      const result = await updateCatalogProductOptionDefinitions(
        detailData.product.id,
        optionDefinitions,
        optionExpectedVersion
      )
      setSavedOptions(structuredClone(result.optionDefinitions))
      setOptionDefinitions(result.optionDefinitions)
      setOptionExpectedVersion(result.version)
      setPresentationExpectedVersion(result.version)
      return { success: true }
    } catch (error) {
      const normalized = normalizeApiError(error)
      const details = Array.isArray(normalized.details) ? normalized.details : []
      const fieldErrors: Record<string, OptionFieldError> = {}
      details.forEach((detail) => {
        if (!detail || typeof detail !== 'object' || !('path' in detail)) return
        const path = (detail as { message?: string; path?: unknown[] }).path
        const definitionIndex = path?.[1]
        const valueIndex = path?.[3]
        if (typeof definitionIndex === 'number' && typeof valueIndex === 'number') {
          fieldErrors[`${definitionIndex}:${valueIndex}`] = {
            kind: 'request',
            message: (detail as { message?: string }).message ?? normalized.message,
          }
        }
      })
      setOptionErrors(fieldErrors)
      if (!Object.keys(fieldErrors).length) setPresentationRequestError(normalized.message)
      return { success: false, error: normalized }
    } finally {
      mutationLock.current = false
      setOptionSaving(false)
    }
  }, [
    detailData,
    optionDefinitions,
    optionExpectedVersion,
    optionPresentationReadonly,
    saveLoading,
  ])

  const saveProductPresentation = useCallback(async (): Promise<PresentationSaveResult> => {
    if (!detailData || optionPresentationReadonly || mutationLock.current || saveLoading)
      return { cancelled: true }
    setPresentationRequestError(null)
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
    const firstInvalidIndex = specifications.findIndex(
      ({ label, value }) => !label || !value || duplicateLabels.has(label.toLocaleLowerCase())
    )
    if (firstInvalidIndex >= 0) {
      setPresentationError('invalid-specifications')
      const { label } = specifications[firstInvalidIndex]!
      const field = !label || duplicateLabels.has(label.toLocaleLowerCase()) ? 'label' : 'value'
      const input = specificationFields.current?.querySelector<HTMLInputElement>(
        `#specification-${field}-${firstInvalidIndex}`
      )
      input?.scrollIntoView?.({ block: 'center' })
      input?.focus({ preventScroll: true })
      return { cancelled: true }
    }
    const normalized = normalizeProductPresentation(productPresentation)
    mutationLock.current = true
    setPresentationSaving(true)
    setPresentationError(null)
    try {
      const result = await updateCatalogProductPresentation(
        detailData.product.id,
        normalized,
        presentationExpectedVersion
      )
      setSavedPresentation(structuredClone(result.presentation))
      setProductPresentation(result.presentation)
      setPresentationExpectedVersion(result.version)
      setOptionExpectedVersion(result.version)
      return { success: true }
    } catch (error) {
      const normalized = normalizeApiError(error)
      setPresentationRequestError(normalized.message)
      return { success: false, error: normalized }
    } finally {
      mutationLock.current = false
      setPresentationSaving(false)
    }
  }, [
    detailData,
    optionPresentationReadonly,
    saveLoading,
    presentationExpectedVersion,
    productPresentation,
  ])
  const presentationControlsDisabled =
    optionPresentationReadonly || saveLoading || optionSaving || presentationSaving
  const moveSpecification = (index: number, offset: -1 | 1) => {
    setProductPresentation((current) => {
      const specifications = [...current.specifications]
      const target = index + offset
      if (target < 0 || target >= specifications.length) return current
      ;[specifications[index], specifications[target]] = [
        specifications[target]!,
        specifications[index]!,
      ]
      return { ...current, specifications }
    })
  }
  const spec = useMemo<BasicCrudFormSpec<CatalogFormValues>>(
    () => ({
      parsedMode,
      modeView,
      permissionDenied,
      detailLoading,
      detailError,
      saveLoading: saveLoading || optionSaving || presentationSaving,
      isReadonly: effectiveReadonly,
      form,
      initialValues: defaults,
      title: t(isAddMode ? 'New product' : 'Product details'),
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
        if (effectiveReadonly || mutationLock.current || presentationEditor !== null) return
        mutationLock.current = true
        try {
          const result = await submitFormValues(values)
          if (result.success) {
            void message.success(translateNow(isAddMode ? 'Product created' : 'Product saved'))
            publishRefresh({ source: 'catalog-form' })
            return
          }
          void message.error(result.error.message)
        } finally {
          mutationLock.current = false
        }
      },
      sections: [
        {
          key: 'product',
          title: t('Product'),
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
          renderFields: () => (
            <>
              {!effectiveReadonly ? (
                <Form.Item label={t('Catalog image')} required>
                  <FilePicker
                    displayMode="button"
                    nativeUploadProps={{
                      accept: 'image/jpeg,image/png,image/webp,image/gif',
                      maxCount: 1,
                      beforeUpload: (file) => {
                        if (
                          !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
                            file.type
                          )
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
                      },
                    }}
                  >
                    <Button icon={<UploadOutlined />}>{t('Choose image')}</Button>
                  </FilePicker>
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
          <section aria-label={t('Option presentation')} className="space-y-3">
            <h2>{t('Option presentation')}</h2>
            <p>
              {optionDefinitions
                .map(
                  (definition) =>
                    `${definition.name}: ${definition.values.map(({ label }) => label).join(', ')}`
                )
                .join(' · ') || '—'}
            </p>
            <Button
              disabled={
                saveLoading ||
                optionSaving ||
                presentationSaving ||
                presentationEditor !== null ||
                optionDefinitions.length === 0
              }
              onClick={() => setPresentationEditor('options')}
            >
              {t(
                isReadonly || optionPresentationReadonly
                  ? 'View option presentation'
                  : 'Edit option presentation'
              )}
            </Button>
          </section>
          <section aria-label={t('Product presentation')} className="space-y-3">
            <h2>{t('Product presentation')}</h2>
            <p>
              {productPresentation.brand || '—'} · {t('Specifications')}:{' '}
              {productPresentation.specifications.length}
            </p>
            <Button
              disabled={
                saveLoading || optionSaving || presentationSaving || presentationEditor !== null
              }
              onClick={() => setPresentationEditor('presentation')}
            >
              {t(
                isReadonly || optionPresentationReadonly
                  ? 'View product presentation'
                  : 'Edit product presentation'
              )}
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
      presentationEditor,
      detailError,
      detailData,
      detailLoading,
      catalogShapeLocked,
      optionDefinitions,
      openCollectionManagement,
      optionPresentationReadonly,
      optionSaving,
      productPresentation,
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
      saveLoading,
      submitFormValues,
      t,
      translateNow,
    ]
  )

  return (
    <>
      <BasicCrudFormRecipe spec={spec} />
      {presentationEditor && detailData ? (
        <CrudFormDrawerRecipe
          key={presentationEditor}
          spec={{
            title: t(
              presentationEditor === 'options' ? 'Option presentation' : 'Product presentation'
            ),
            successTitle: t(
              presentationEditor === 'options'
                ? 'Option presentation saved'
                : 'Product presentation saved'
            ),
            parsedMode: {
              ok: true,
              mode: optionPresentationReadonly ? 'readonly' : 'modify',
              resourceKey: detailData.product.id,
            },
            permissionDenied,
            detailLoading: false,
            detailError: null,
            saveLoading: optionSaving || presentationSaving,
            actionBusy: saveLoading,
            nestedModalOpen: swatchConfirmOpen,
            isReadonly: optionPresentationReadonly,
            form: presentationForm,
            initialValues: {},
            onRetryDetail: () => undefined,
            hasUnsavedChanges: () =>
              presentationEditor === 'options'
                ? JSON.stringify(optionDefinitions) !== JSON.stringify(savedOptions)
                : JSON.stringify(normalizeProductPresentation(productPresentation)) !==
                  JSON.stringify(normalizeProductPresentation(savedPresentation)),
            onResetAll: () => {
              setOptionDefinitions(structuredClone(savedOptions))
              setProductPresentation(structuredClone(savedPresentation))
              setOptionErrors({})
              setPresentationRequestError(null)
              setPresentationError(null)
            },
            onClose: () => {
              setOptionDefinitions(structuredClone(savedOptions))
              setProductPresentation(structuredClone(savedPresentation))
              setOptionErrors({})
              setPresentationRequestError(null)
              setPresentationError(null)
              setPresentationEditor(null)
            },
            onSaved: async () => {
              publishRefresh({
                source:
                  presentationEditor === 'options'
                    ? 'catalog-option-presentation'
                    : 'catalog-product-presentation',
              })
            },
            onSubmit:
              presentationEditor === 'options' ? saveOptionDefinitions : saveProductPresentation,
            renderAfterForm: presentationRequestError ? (
              <Typography.Text type="danger">{presentationRequestError}</Typography.Text>
            ) : null,
            sections:
              presentationEditor === 'options'
                ? [
                    {
                      key: 'option-guidance',
                      title: null,
                      renderFields: () => (
                        <Typography.Paragraph type="secondary" className="!mb-0">
                          {t(
                            'Option names and values come from variants and cannot be changed here.'
                          )}
                        </Typography.Paragraph>
                      ),
                    },
                    ...optionDefinitions.map((definition, definitionIndex) => ({
                      key: definition.name,
                      title: definition.name,
                      renderFields: () => (
                        <>
                          <Form.Item
                            label={t('Presentation kind')}
                            htmlFor={`option-presentation-${definitionIndex}`}
                          >
                            <Select
                              id={`option-presentation-${definitionIndex}`}
                              aria-label={`${definition.name} ${t('Presentation kind')}`}
                              className="w-full"
                              disabled={presentationControlsDisabled}
                              value={definition.presentation}
                              options={[
                                { label: t('Text'), value: 'text' },
                                { label: t('Color'), value: 'color' },
                              ]}
                              onChange={(value) => changePresentation(definitionIndex, value)}
                            />
                          </Form.Item>
                          <ul>
                            {definition.values.map((value, valueIndex) => {
                              const error = optionErrors[`${definitionIndex}:${valueIndex}`]
                              const errorId = `option-swatch-error-${definitionIndex}-${valueIndex}`
                              const fieldId = `option-swatch-${definitionIndex}-${valueIndex}`
                              return (
                                <li key={value.label}>
                                  {definition.presentation === 'color' ? (
                                    <Form.Item
                                      label={value.label}
                                      htmlFor={fieldId}
                                      validateStatus={error ? 'error' : undefined}
                                      help={
                                        error ? (
                                          <span id={errorId}>
                                            {error.kind === 'invalid-swatch'
                                              ? t('Use an opaque color in #rrggbb format.')
                                              : error.message}
                                          </span>
                                        ) : undefined
                                      }
                                    >
                                      <div className="flex flex-wrap items-start gap-2">
                                        <ColorPicker
                                          aria-label={`${definition.name} ${value.label} ${t('Color picker')}`}
                                          disabled={presentationControlsDisabled}
                                          disabledAlpha
                                          value={value.swatch || '#000000'}
                                          onChangeComplete={(color) =>
                                            changeSwatch(
                                              definitionIndex,
                                              valueIndex,
                                              color.toHexString()
                                            )
                                          }
                                        />
                                        <Input
                                          id={fieldId}
                                          className="max-w-40"
                                          aria-label={`${definition.name} ${value.label} ${t('Swatch')}`}
                                          disabled={presentationControlsDisabled}
                                          aria-describedby={error ? errorId : undefined}
                                          aria-invalid={Boolean(error)}
                                          status={error ? 'error' : undefined}
                                          value={value.swatch ?? ''}
                                          onBlur={(event) =>
                                            changeSwatch(
                                              definitionIndex,
                                              valueIndex,
                                              event.target.value
                                            )
                                          }
                                          onChange={(event) =>
                                            changeSwatch(
                                              definitionIndex,
                                              valueIndex,
                                              event.target.value
                                            )
                                          }
                                        />
                                      </div>
                                    </Form.Item>
                                  ) : (
                                    <Typography.Paragraph>{value.label}</Typography.Paragraph>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                          {definitionIndex < optionDefinitions.length - 1 ? (
                            <Divider className="!my-0" />
                          ) : null}
                        </>
                      ),
                    })),
                  ]
                : [
                    {
                      key: 'display',
                      title: t('Display settings'),
                      renderFields: () => (
                        <>
                          <Typography.Paragraph type="secondary">
                            {t(
                              'These released fields supply the existing Product page; related products continue to follow collection order.'
                            )}
                          </Typography.Paragraph>
                          <Form.Item label={t('Brand')} htmlFor="presentation-brand">
                            <Input
                              id="presentation-brand"
                              disabled={presentationControlsDisabled}
                              value={productPresentation.brand ?? ''}
                              onChange={(event) =>
                                setProductPresentation((current) => ({
                                  ...current,
                                  brand: event.target.value,
                                }))
                              }
                            />
                          </Form.Item>
                          <Form.Item label={t('Default variant')} htmlFor="presentation-variant">
                            <Select
                              id="presentation-variant"
                              allowClear
                              className="w-full"
                              disabled={presentationControlsDisabled}
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
                          </Form.Item>
                          <Form.Item label={t('Detail media')} htmlFor="presentation-media">
                            <Select
                              id="presentation-media"
                              allowClear
                              className="w-full"
                              disabled={presentationControlsDisabled}
                              options={detailData.media.map((media) => ({
                                label: `${media.alt_text} — ${media.r2_key}`,
                                value: media.id,
                              }))}
                              value={productPresentation.detailMediaId}
                              onChange={(value) =>
                                setProductPresentation((current) => ({
                                  ...current,
                                  detailMediaId: value,
                                }))
                              }
                            />
                          </Form.Item>
                        </>
                      ),
                    },
                    {
                      key: 'detail',
                      title: t('Detail content'),
                      renderFields: () => (
                        <>
                          {(
                            [
                              { field: 'eyebrow', label: t('Detail eyebrow'), rows: 2 },
                              { field: 'heading', label: t('Detail heading'), rows: 2 },
                              { field: 'body', label: t('Detail body'), rows: 4 },
                            ] as const
                          ).map(({ field, label, rows }) => (
                            <Form.Item key={field} label={label} htmlFor={`presentation-${field}`}>
                              <Input.TextArea
                                id={`presentation-${field}`}
                                disabled={presentationControlsDisabled}
                                rows={rows}
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
                            </Form.Item>
                          ))}
                          <Form.Item label={t('Detail bullets')} htmlFor="presentation-bullets">
                            <Input.TextArea
                              id="presentation-bullets"
                              disabled={presentationControlsDisabled}
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
                          </Form.Item>
                        </>
                      ),
                    },
                    {
                      key: 'specifications',
                      title: t('Specifications'),
                      renderFields: () => (
                        <div ref={specificationFields}>
                          {productPresentation.specifications.map((specification, index) => {
                            const labelInvalid = Boolean(
                              presentationError &&
                              (!specification.label.trim() ||
                                productPresentation.specifications.some(
                                  (other, otherIndex) =>
                                    otherIndex !== index &&
                                    other.label.trim().toLocaleLowerCase() ===
                                      specification.label.trim().toLocaleLowerCase()
                                ))
                            )
                            const valueInvalid = Boolean(
                              presentationError && !specification.value.trim()
                            )
                            return (
                              <div key={index} className="mb-6">
                                <Form.Item
                                  label={t('Specification label')}
                                  htmlFor={`specification-label-${index}`}
                                  required
                                  validateStatus={labelInvalid ? 'error' : undefined}
                                  help={
                                    labelInvalid ? (
                                      <span id={`specification-label-error-${index}`}>
                                        {t('Use a unique, non-empty specification label.')}
                                      </span>
                                    ) : undefined
                                  }
                                >
                                  <Input
                                    id={`specification-label-${index}`}
                                    aria-label={`${t('Specification label')} ${index + 1}`}
                                    aria-invalid={labelInvalid}
                                    aria-describedby={
                                      labelInvalid
                                        ? `specification-label-error-${index}`
                                        : undefined
                                    }
                                    disabled={presentationControlsDisabled}
                                    placeholder={t('Label')}
                                    value={specification.label}
                                    onChange={(event) =>
                                      setProductPresentation((current) => ({
                                        ...current,
                                        specifications: current.specifications.map(
                                          (item, itemIndex) =>
                                            itemIndex === index
                                              ? { ...item, label: event.target.value }
                                              : item
                                        ),
                                      }))
                                    }
                                  />
                                </Form.Item>
                                <Form.Item
                                  label={t('Specification value')}
                                  htmlFor={`specification-value-${index}`}
                                  required
                                  validateStatus={valueInvalid ? 'error' : undefined}
                                  help={
                                    valueInvalid ? (
                                      <span id={`specification-value-error-${index}`}>
                                        {t('Enter a specification value.')}
                                      </span>
                                    ) : undefined
                                  }
                                >
                                  <Input
                                    id={`specification-value-${index}`}
                                    aria-label={`${t('Specification value')} ${index + 1}`}
                                    aria-invalid={valueInvalid}
                                    aria-describedby={
                                      valueInvalid
                                        ? `specification-value-error-${index}`
                                        : undefined
                                    }
                                    disabled={presentationControlsDisabled}
                                    placeholder={t('Value')}
                                    value={specification.value}
                                    onChange={(event) =>
                                      setProductPresentation((current) => ({
                                        ...current,
                                        specifications: current.specifications.map(
                                          (item, itemIndex) =>
                                            itemIndex === index
                                              ? { ...item, value: event.target.value }
                                              : item
                                        ),
                                      }))
                                    }
                                  />
                                </Form.Item>
                                <SortActionGroup
                                  index={index}
                                  count={productPresentation.specifications.length}
                                  disabled={presentationControlsDisabled}
                                  moveUpLabel={`${t('Move specification up')} ${index + 1}`}
                                  moveDownLabel={`${t('Move specification down')} ${index + 1}`}
                                  removeLabel={`${t('Remove specification')} ${index + 1}`}
                                  onMoveUp={() => moveSpecification(index, -1)}
                                  onMoveDown={() => moveSpecification(index, 1)}
                                  onRemove={() =>
                                    setProductPresentation((current) => ({
                                      ...current,
                                      specifications: current.specifications.filter(
                                        (_, itemIndex) => itemIndex !== index
                                      ),
                                    }))
                                  }
                                />
                              </div>
                            )
                          })}
                          <Button
                            disabled={presentationControlsDisabled}
                            onClick={() =>
                              setProductPresentation((current) => ({
                                ...current,
                                specifications: [
                                  ...current.specifications,
                                  { label: '', value: '' },
                                ],
                              }))
                            }
                          >
                            {t('Add specification')}
                          </Button>
                        </div>
                      ),
                    },
                  ],
          }}
        />
      ) : null}
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
