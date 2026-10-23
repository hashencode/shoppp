import { FilePicker } from '../../shared/components/file-picker'
import { Alert, Button, Checkbox, Input, InputNumber, Upload } from 'antd'
import React, { useEffect, useRef, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { useI18n } from '../../shared/contexts/i18n-context'
import {
  fetchPublishedProductRevisions,
  previewPublishedProductRevision,
  publishPublishedProductRevision,
  stagePublishedProductRevision,
  uploadCatalogMedia,
  type ProductDetail,
  type PublishedProductRevisionContent,
  type PublishedProductRevisionState,
} from '../../services/catalog/api'

type Props = {
  canEdit: boolean
  detail: ProductDetail
  onChanged: () => void
}

void React

const revisionStatusLabels = {
  draft: 'Draft',
  building: 'Building',
  published: 'Published',
  failed: 'Failed',
}

function initialContent(detail: ProductDetail): PublishedProductRevisionContent {
  const optionDefinitions = JSON.parse(detail.product.option_definitions_json) as NonNullable<PublishedProductRevisionContent['optionDefinitions']>
  return {
    description: detail.product.description,
    media: detail.media.map((item) => ({
      altText: item.alt_text,
      height: item.height,
      id: item.id,
      r2Key: item.r2_key,
      width: item.width,
    })),
    name: detail.product.name,
    ...(optionDefinitions.length > 0 ? {
      optionDefinitions,
      variantOptions: detail.variants.map((variant) => ({
        id: variant.id,
        optionValues: JSON.parse(variant.option_values_json) as Record<string, string>,
        title: variant.title,
      })),
    } : {}),
    presentation: detail.product.presentation_json
      ? (JSON.parse(
          detail.product.presentation_json
        ) as PublishedProductRevisionContent['presentation'])
      : null,
    seoDescription: detail.product.seo_description,
    seoTitle: detail.product.seo_title,
  }
}

export function PublishedProductRevisionEditor({ canEdit, detail, onChanged }: Props) {
  const { t } = useI18n()
  const { role, permissions } = useAuth()
  const canPublish = canEdit && hasPermission(role, 'catalog.publish', permissions)
  const productId = detail.product.id
  const [state, setState] = useState<PublishedProductRevisionState | null>(null)
  const [content, setContent] = useState<PublishedProductRevisionContent>(() =>
    initialContent(detail)
  )
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})
  const [newMediaIds, setNewMediaIds] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const mutationLock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ message: string; releaseId?: string } | null>(null)
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewPublishedProductRevision>
  > | null>(null)

  useEffect(() => {
    let active = true
    void fetchPublishedProductRevisions(productId)
      .then((next) => {
        if (!active) return
        setState(next)
        setContent({
          ...initialContent(detail),
          ...next.published?.content,
          ...next.draft?.content,
        })
        setPendingFiles({})
        setNewMediaIds([])
        setError(null)
        setPreview(null)
      })
      .catch((cause) => {
        if (active) setError(normalizeApiError(cause).message)
      })
    return () => {
      active = false
    }
  }, [detail, productId])

  const updateMedia = (
    id: string,
    update: (
      item: PublishedProductRevisionContent['media'][number]
    ) => PublishedProductRevisionContent['media'][number]
  ) => {
    setContent((current) => ({
      ...current,
      media: current.media.map((item) => (item.id === id ? update(item) : item)),
    }))
  }

  const updatePresentation = (
    update: (presentation: NonNullable<PublishedProductRevisionContent['presentation']>) =>
      NonNullable<PublishedProductRevisionContent['presentation']>
  ) => {
    setContent((current) => ({
      ...current,
      presentation: update(current.presentation ?? { specifications: [] }),
    }))
  }

  const moveMedia = (id: string, offset: number) => {
    setContent((current) => {
      const index = current.media.findIndex((item) => item.id === id)
      const target = index + offset
      if (index < 0 || target < 0 || target >= current.media.length) return current
      const media = [...current.media]
      ;[media[index], media[target]] = [media[target]!, media[index]!]
      return { ...current, media }
    })
  }

  const addMedia = () => {
    const id = crypto.randomUUID()
    setNewMediaIds((current) => [...current, id])
    setContent((current) => ({
      ...current,
      media: [
        ...current.media,
        {
          altText: '',
          height: 0,
          id,
          r2Key: `catalog/products/${productId}/${id}.webp`,
          width: 0,
        },
      ],
    }))
  }

  const save = async () => {
    if (!state || !canEdit || mutationLock.current) return
    mutationLock.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      for (const item of content.media) {
        const file = pendingFiles[item.id]
        if (file) await uploadCatalogMedia(item.r2Key, file)
      }
      const draft = await stagePublishedProductRevision(productId, {
        content,
        expectedDraftVersion: state.draft?.version ?? null,
        expectedProductVersion: state.productVersion,
        expectedPublishedRevisionId: state.published?.id ?? null,
      })
      setState((current) => (current ? { ...current, draft } : current))
      setPendingFiles({})
      setNewMediaIds([])
      setPreview(null)
      setNotice({ message: t('Product revision saved as draft. The published page has not changed.') })
      onChanged()
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const publish = async (revisionId: string | null) => {
    if (!state || !canPublish || mutationLock.current) return
    mutationLock.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const build = await publishPublishedProductRevision(productId, {
        expectedDraftVersion: revisionId ? (state.draft?.version ?? null) : null,
        expectedProductVersion: state.productVersion,
        expectedPublishedRevisionId: state.published?.id ?? null,
        reason: reason.trim(),
        revisionId,
      })
      const next = await fetchPublishedProductRevisions(productId)
      setState(next)
      setPreview(null)
      setNotice({
        message: t('Revision publication started. The storefront changes after deployment.'),
        releaseId: build.releaseId,
      })
      onChanged()
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const inspectDraft = async () => {
    if (!state?.draft || mutationLock.current) return
    mutationLock.current = true
    setBusy(true)
    setError(null)
    try {
      setPreview(await previewPublishedProductRevision(productId, state.draft.id))
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  return (
    <section aria-label={t('Published Product revision')} className="space-y-4">
      <h2 className="text-lg font-semibold">{t('Published Product revision')}</h2>
      <p>
        {t(
          'This editor changes product content and presentation. Price, SKU, weight and dimensions remain read-only.'
        )}
      </p>
      {error ? <Alert showIcon type="error" title={error} /> : null}
      {notice ? (
        <div className="space-y-2">
          <p>{notice.message}</p>
          {notice.releaseId ? (
            <details>
              <summary>{t('Product publication details')}</summary>
              {notice.releaseId}
            </details>
          ) : null}
        </div>
      ) : null}
      {preview ? (
        <section
          aria-label={t('Saved revision data')}
          className="rounded border border-solid border-gray-200 p-3"
        >
          <h3 className="font-medium">{t('Saved revision data')}</h3>
          <p>
            {preview.product.name} · /products/{preview.product.slug}
          </p>
          <p>{preview.product.description}</p>
          <ol>
            {preview.product.media.map((item) => (
              <li key={item.id}>
                {item.alt} — {item.src}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p>
        {t('Product version')}: {state?.productVersion ?? detail.product.version} ·{' '}
        {t('Revision status')}:{' '}
        {state?.draft
          ? t(revisionStatusLabels[state.draft.status] ?? state.draft.status)
          : t('No draft')}
      </p>
      <label className="block space-y-1">
        <span>{t('Name')}</span>
        <Input
          disabled={!canEdit || busy}
          maxLength={200}
          value={content.name}
          onChange={(event) => setContent((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label className="block space-y-1">
        <span>{t('Description')}</span>
        <Input.TextArea
          disabled={!canEdit || busy}
          maxLength={20_000}
          rows={5}
          value={content.description}
          onChange={(event) =>
            setContent((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
      <label className="block space-y-1">
        <span>{t('SEO title')}</span>
        <Input
          disabled={!canEdit || busy}
          maxLength={70}
          value={content.seoTitle}
          onChange={(event) =>
            setContent((current) => ({ ...current, seoTitle: event.target.value }))
          }
        />
      </label>
      <label className="block space-y-1">
        <span>{t('SEO description')}</span>
        <Input.TextArea
          disabled={!canEdit || busy}
          maxLength={320}
          value={content.seoDescription}
          onChange={(event) =>
            setContent((current) => ({ ...current, seoDescription: event.target.value }))
          }
        />
      </label>
      <section aria-label={t('Product details')} className="space-y-3">
        <h3 className="font-medium">{t('Product details')}</h3>
        <label className="block space-y-1">
          <span>{t('Brand')}</span>
          <Input
            disabled={!canEdit || busy}
            maxLength={160}
            value={content.presentation?.brand ?? ''}
            onChange={(event) => updatePresentation((presentation) => ({
              ...presentation,
              brand: event.target.value.trim() || undefined,
            }))}
          />
        </label>
        <Checkbox
          disabled={!canEdit || busy}
          checked={content.presentation?.purchaseStatus === 'unverified'}
          onChange={(event) => updatePresentation((presentation) => ({
            ...presentation,
            purchaseStatus: event.target.checked ? 'unverified' : undefined,
          }))}
        >
          {t('Options are unverified; hide purchasing until a verified assortment is published')}
        </Checkbox>
        <label className="block space-y-1">
          <span>{t('Detail heading')}</span>
          <Input
            disabled={!canEdit || busy}
            maxLength={300}
            value={content.presentation?.detail?.heading ?? ''}
            onChange={(event) => updatePresentation((presentation) => ({
              ...presentation,
              detail: {
                ...presentation.detail,
                bullets: presentation.detail?.bullets ?? [],
                heading: event.target.value || undefined,
              },
            }))}
          />
        </label>
        <label className="block space-y-1">
          <span>{t('Detail text')}</span>
          <Input.TextArea
            disabled={!canEdit || busy}
            maxLength={20_000}
            rows={4}
            value={content.presentation?.detail?.body ?? ''}
            onChange={(event) => updatePresentation((presentation) => ({
              ...presentation,
              detail: {
                ...presentation.detail,
                bullets: presentation.detail?.bullets ?? [],
                body: event.target.value || undefined,
              },
            }))}
          />
        </label>
        <label className="block space-y-1">
          <span>{t('Detail bullets, one per line')}</span>
          <Input.TextArea
            disabled={!canEdit || busy}
            rows={4}
            value={content.presentation?.detail?.bullets.join('\n') ?? ''}
            onChange={(event) => updatePresentation((presentation) => ({
              ...presentation,
              detail: {
                ...presentation.detail,
                bullets: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
              },
            }))}
          />
        </label>
        {content.presentation?.specifications.map((specification, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="block space-y-1">
              <span>{t('Specification label')}</span>
              <Input
                disabled={!canEdit || busy}
                maxLength={160}
                value={specification.label}
                onChange={(event) => updatePresentation((presentation) => ({
                  ...presentation,
                  specifications: presentation.specifications.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item
                  ),
                }))}
              />
            </label>
            <label className="block space-y-1">
              <span>{t('Specification value')}</span>
              <Input
                disabled={!canEdit || busy}
                maxLength={1000}
                value={specification.value}
                onChange={(event) => updatePresentation((presentation) => ({
                  ...presentation,
                  specifications: presentation.specifications.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: event.target.value } : item
                  ),
                }))}
              />
            </label>
            <Button
              disabled={!canEdit || busy}
              onClick={() => updatePresentation((presentation) => ({
                ...presentation,
                specifications: presentation.specifications.filter((_, itemIndex) => itemIndex !== index),
              }))}
            >
              {t('Remove specification')}
            </Button>
          </div>
        ))}
        <Button
          disabled={!canEdit || busy || (content.presentation?.specifications.length ?? 0) >= 30}
          onClick={() => updatePresentation((presentation) => ({
            ...presentation,
            specifications: [...presentation.specifications, { label: '', value: '' }],
          }))}
        >
          {t('Add specification')}
        </Button>
      </section>
      {content.variantOptions?.map((variant) => (
        <fieldset key={variant.id} className="space-y-2 rounded border border-solid border-gray-200 p-3">
          <legend>{t('Variant')} · {detail.variants.find(({ id }) => id === variant.id)?.sku}</legend>
          {Object.entries(variant.optionValues).map(([optionName, optionValue]) => (
            <label key={optionName} className="block space-y-1">
              <span>{optionName}</span>
              <Input
                disabled={!canEdit || busy}
                maxLength={160}
                value={optionValue}
                onChange={(event) => setContent((current) => {
                  const variantOptions = current.variantOptions?.map((item) => item.id === variant.id
                    ? { ...item, optionValues: { ...item.optionValues, [optionName]: event.target.value }, title: Object.values({ ...item.optionValues, [optionName]: event.target.value }).join(' / ') }
                    : item)
                  const optionDefinitions = current.optionDefinitions?.map((definition) => {
                    const labels = [...new Set(variantOptions?.map((item) => item.optionValues[definition.name]).filter((value): value is string => !!value) ?? [])]
                    return { ...definition, presentation: 'text' as const, values: labels.map((label) => ({ label })) }
                  })
                  return { ...current, optionDefinitions, variantOptions }
                })}
              />
            </label>
          ))}
        </fieldset>
      ))}
      <div className="space-y-3">
        <h3 className="font-medium">{t('Ordered Product media')}</h3>
        {content.media.map((item, index) => (
          <fieldset
            key={item.id}
            className="space-y-2 rounded border border-solid border-gray-200 p-3"
          >
            <legend>
              {t('Image')} {index + 1}
            </legend>
            <label className="block space-y-1">
              <span>{t('Media key')}</span>
              <Input
                disabled={!canEdit || busy || !newMediaIds.includes(item.id)}
                value={item.r2Key}
                onChange={(event) =>
                  updateMedia(item.id, (previous) => ({ ...previous, r2Key: event.target.value }))
                }
              />
            </label>
            <label className="block space-y-1">
              <span>{t('Image description')}</span>
              <Input
                disabled={!canEdit || busy}
                maxLength={300}
                value={item.altText}
                onChange={(event) =>
                  updateMedia(item.id, (previous) => ({ ...previous, altText: event.target.value }))
                }
              />
            </label>
            <div className="flex gap-3">
              <label>
                <span>{t('Width')}</span>
                <InputNumber
                  disabled={!canEdit || busy}
                  min={1}
                  value={item.width}
                  onChange={(value) =>
                    updateMedia(item.id, (previous) => ({ ...previous, width: value ?? 0 }))
                  }
                />
              </label>
              <label>
                <span>{t('Height')}</span>
                <InputNumber
                  disabled={!canEdit || busy}
                  min={1}
                  value={item.height}
                  onChange={(value) =>
                    updateMedia(item.id, (previous) => ({ ...previous, height: value ?? 0 }))
                  }
                />
              </label>
            </div>
            {newMediaIds.includes(item.id) ? (
              <FilePicker
                displayMode="button"
                nativeUploadProps={{
                  accept: 'image/jpeg,image/png,image/webp,image/gif',
                  maxCount: 1,
                  beforeUpload: (file) => {
                    const extension = {
                      'image/gif': 'gif',
                      'image/jpeg': 'jpg',
                      'image/png': 'png',
                      'image/webp': 'webp',
                    }[file.type]
                    if (!extension || file.size > 10 * 1024 * 1024) {
                      setError(t('Only JPEG, PNG, WebP, and GIF up to 10 MiB are allowed.'))
                      return Upload.LIST_IGNORE
                    }
                    updateMedia(item.id, (previous) => ({
                      ...previous,
                      r2Key: `catalog/products/${productId}/${item.id}.${extension}`,
                    }))
                    setPendingFiles((current) => ({ ...current, [item.id]: file }))
                    return false
                  },
                }}
              >
                <Button disabled={!canEdit || busy}>{t('Choose image to upload')}</Button>
              </FilePicker>
            ) : null}
            <div className="flex gap-2">
              <Button
                disabled={!canEdit || busy || index === 0}
                onClick={() => moveMedia(item.id, -1)}
              >
                {t('Move up')}
              </Button>
              <Button
                disabled={!canEdit || busy || index === content.media.length - 1}
                onClick={() => moveMedia(item.id, 1)}
              >
                {t('Move down')}
              </Button>
              <Button
                disabled={!canEdit || busy || content.media.length === 1}
                onClick={() => {
                  setContent((current) => ({
                    ...current,
                    media: current.media.filter((media) => media.id !== item.id),
                    presentation: current.presentation?.detailMediaId === item.id
                      ? { ...current.presentation, detailMediaId: undefined }
                      : current.presentation,
                  }))
                  setPendingFiles((current) => {
                    const next = { ...current }
                    delete next[item.id]
                    return next
                  })
                }}
              >
                {t('Remove')}
              </Button>
            </div>
          </fieldset>
        ))}
        <Button disabled={!canEdit || busy || content.media.length >= 20} onClick={addMedia}>
          {t('Add image')}
        </Button>
      </div>
      <Button
        type="primary"
        disabled={!canEdit || state?.draft?.status === 'building'}
        loading={busy}
        onClick={() => void save()}
      >
        {t('Save staged revision')}
      </Button>
      <Button disabled={!state?.draft || busy} onClick={() => void inspectDraft()}>
        {t('Inspect saved revision')}
      </Button>
      <p>{t('Publishing starts a public storefront build. Changes appear only after deployment.')}</p>
      <label className="block space-y-1">
        <span>{t('Publication reason')}</span>
        <Input.TextArea
          disabled={!canEdit || busy}
          maxLength={500}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !canPublish ||
            !state?.draft ||
            state.draft.status !== 'draft' ||
            reason.trim().length < 3
          }
          loading={busy}
          onClick={() => void publish(state?.draft?.id ?? null)}
        >
          {t('Publish staged revision')}
        </Button>
        <Button
          disabled={!canPublish || !state || reason.trim().length < 3}
          loading={busy}
          onClick={() => void publish(null)}
        >
          {t('Publish review updates')}
        </Button>
      </div>
    </section>
  )
}
