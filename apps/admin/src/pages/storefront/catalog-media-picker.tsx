import type { AssetReference } from '@shoppp/contracts'
import { Alert, Button, Input, Space, Spin, Typography } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import {
  fetchStorefrontCatalogMedia,
  type StorefrontCatalogMedia,
} from '../../services/storefront/api'
import { normalizeApiError } from '../../infrastructure/http/api-client'

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
  const [items, setItems] = useState<StorefrontCatalogMedia[]>([])
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchStorefrontCatalogMedia({ page, pageSize: PAGE_SIZE, query })
      setItems(result.data)
      setTotal(result.total)
    } catch (cause) {
      setError(normalizeApiError(cause).message)
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
      : `Theme asset · ${value.width} × ${value.height}`

  return (
    <fieldset aria-label={label} className="min-w-0 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Space orientation="vertical" className="w-full">
        <Typography.Text type="secondary">{currentDescription}</Typography.Text>
        <Input.Search
          aria-label={`${label} Search approved Catalog media`}
          allowClear
          disabled={disabled}
          placeholder="Search approved Catalog media"
          onSearch={(next) => {
            setPage(1)
            setQuery(next.trim())
          }}
        />
        {loading ? (
          <Space>
            <Spin size="small" />
            <span>Loading approved Catalog media…</span>
          </Space>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            title="Catalog media could not be loaded"
            description={error}
            action={
              <Button size="small" onClick={() => void load()}>
                Retry media
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <Alert type="info" showIcon title="No approved Catalog media matches this search." />
        ) : (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-label={`Select ${item.alt}`}
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
            aria-label="Previous media page"
            disabled={disabled || loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Typography.Text>
            Page {page} of {pageCount}
          </Typography.Text>
          <Button
            aria-label="Next media page"
            disabled={disabled || loading || page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
          <Button
            aria-label={`Reset ${label}`}
            disabled={disabled}
            onClick={() => onChange(structuredClone(defaultValue))}
          >
            Reset asset
          </Button>
        </Space>
        <Typography.Text type="secondary">
          Uploads remain in the Catalog media workflow.
        </Typography.Text>
      </Space>
    </fieldset>
  )
}
