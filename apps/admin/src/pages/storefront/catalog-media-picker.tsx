import type { AssetReference } from '@shoppp/contracts'
import { CloseCircleFilled } from '@ant-design/icons'
import { Alert, Button, Input, Space, Spin, Typography } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import {
  fetchStorefrontCatalogMedia,
  type StorefrontCatalogMedia,
} from '../../services/storefront/api'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'

void React

const PAGE_SIZE = 12

export const CatalogMediaPicker = ({
  defaultValue,
  disabled,
  label,
  onChange,
  value,
}: {
  defaultValue: AssetReference
  disabled: boolean
  label: string
  onChange: (value: AssetReference) => void
  value: AssetReference
}) => {
  const { t } = useI18n()
  const [items, setItems] = useState<StorefrontCatalogMedia[]>([])
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchStorefrontCatalogMedia({ page, pageSize: PAGE_SIZE, query })
      setItems(result.data)
      setTotal(result.total)
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentDescription =
    value.kind === 'catalog'
      ? `${value.alt} · ${value.width} × ${value.height}`
      : t('Theme asset · {width} × {height}', { width: value.width, height: value.height })

  return (
    <fieldset aria-label={label} className="min-w-0 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Space orientation="vertical" className="w-full">
        <Typography.Text type="secondary">{currentDescription}</Typography.Text>
        <Input.Search
          aria-label={t('{label} Search approved Catalog media', { label })}
          allowClear={{ clearIcon: <CloseCircleFilled aria-label={t('Clear search')} /> }}
          disabled={disabled}
          placeholder={t('Search approved Catalog media')}
          enterButton={t('Search')}
          onSearch={(next) => {
            setPage(1)
            setQuery(next.trim())
          }}
        />
        {loading ? (
          <Space>
            <Spin size="small" />
            <span>{t('Loading approved Catalog media…')}</span>
          </Space>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            title={t('Catalog media could not be loaded')}
            description={localizeApiError(error, t)}
            action={
              <Button size="small" onClick={() => void load()}>
                {t('Retry media')}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <Alert type="info" showIcon title={t('No approved Catalog media matches this search.')} />
        ) : (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-label={t('Select {name}', { name: item.alt })}
                  className="w-full rounded border border-slate-200 p-2 text-left disabled:opacity-50"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      alt: item.alt,
                      height: item.height,
                      key: item.key,
                      kind: 'catalog',
                      width: item.width,
                    })
                  }
                >
                  <img
                    alt={item.alt}
                    className="mb-2 aspect-square w-full object-cover"
                    height={item.height}
                    src={item.src}
                    width={item.width}
                  />
                  <span className="block text-sm">{item.productName}</span>
                  <span className="block text-xs text-slate-500">
                    {item.width} × {item.height}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Space wrap>
          <Button
            aria-label={t('Previous media page')}
            disabled={disabled || loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('Previous')}
          </Button>
          <Typography.Text>
            {t('Page {page} of {pages}', { page, pages: pageCount })}
          </Typography.Text>
          <Button
            aria-label={t('Next media page')}
            disabled={disabled || loading || page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('Next')}
          </Button>
          <Button
            aria-label={t('Reset {label}', { label })}
            disabled={disabled}
            onClick={() => onChange(structuredClone(defaultValue))}
          >
            {t('Reset asset')}
          </Button>
        </Space>
        <Typography.Text type="secondary">
          {t('Uploads remain in the Catalog media workflow.')}
        </Typography.Text>
      </Space>
    </fieldset>
  )
}
