import { Alert, Button, Input, Select, Space, Spin, Typography } from 'antd'
import type { GetRef } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  fetchStorefrontCatalogResources,
  type StorefrontCatalogResource,
} from '../../services/storefront/api'

void React

const PAGE_SIZE = 12

export const StorefrontResourcePicker = ({
  disabled,
  kind,
  label,
  missing,
  onChange,
  releaseId,
  selected,
  value,
}: {
  disabled: boolean
  kind: StorefrontCatalogResource['kind']
  label: string
  missing: boolean
  onChange: (id?: string) => void
  releaseId?: string
  selected?: StorefrontCatalogResource
  value?: string
}) => {
  const selectRef = React.useRef<GetRef<typeof Select>>(null)
  const [items, setItems] = useState<StorefrontCatalogResource[]>([])
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!releaseId) {
      setItems([])
      setTotal(0)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchStorefrontCatalogResources({
        kind,
        page,
        pageSize: PAGE_SIZE,
        query,
        releaseId,
      })
      setItems(result.data)
      setTotal(result.total)
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [kind, page, query, releaseId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const options = [...items]
  if (selected && !options.some(({ id }) => id === selected.id)) options.unshift(selected)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <fieldset aria-label={label} className="min-w-0 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Space orientation="vertical" className="w-full">
        <Input.Search
          aria-label={`${label} Search`}
          allowClear
          disabled={disabled || !releaseId}
          onSearch={(next) => {
            setPage(1)
            setQuery(next.trim())
          }}
          placeholder={`Search ${kind}`}
        />
        <Select
          ref={selectRef}
          aria-label={label}
          allowClear
          className="w-full"
          disabled={disabled || !releaseId || loading}
          loading={loading}
          status={missing ? 'error' : undefined}
          value={missing ? undefined : value}
          options={options.map((resource) => ({
            label: `${resource.name} · ${resource.path}`,
            value: resource.id,
          }))}
          onChange={(next) => {
            onChange(next)
            window.requestAnimationFrame(() => selectRef.current?.focus())
          }}
        />
        {loading ? (
          <Space><Spin size="small" /><span>Loading references…</span></Space>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            title="References could not be loaded"
            description={error}
            action={<Button size="small" onClick={() => void load()}>Retry references</Button>}
          />
        ) : items.length === 0 ? (
          <Typography.Text type="secondary">No matching {kind} references.</Typography.Text>
        ) : null}
        {missing ? (
          <Typography.Text type="danger">
            The selected reference is missing from the current release. Choose a replacement.
          </Typography.Text>
        ) : null}
        <Space wrap>
          <Button disabled={disabled || loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous references
          </Button>
          <span>Page {page} of {pages}</span>
          <Button disabled={disabled || loading || page >= pages} onClick={() => setPage((value) => value + 1)}>
            Next references
          </Button>
        </Space>
      </Space>
    </fieldset>
  )
}
