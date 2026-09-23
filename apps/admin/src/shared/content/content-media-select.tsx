import { Alert, Button, Select, Space } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'

import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { fetchContentMedia, type ContentMediaAsset } from '../../services/content/api'
import { useI18n } from '../contexts/i18n-context'
import { localizeApiError } from '../i18n/api-error'

void React

export const ContentMediaSelect = ({
  allowClear = false,
  disabled = false,
  onChange,
  value,
}: {
  allowClear?: boolean
  disabled?: boolean
  onChange?: (value: string | undefined) => void
  value?: string
}) => {
  const { t } = useI18n()
  const [items, setItems] = useState<ContentMediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const load = useCallback((isActive: () => boolean = () => true) => {
    setLoading(true)
    setError(null)
    return fetchContentMedia()
      .then((result) => {
        if (isActive()) setItems(result)
      })
      .catch((reason) => {
        if (isActive()) setError(normalizeApiError(reason))
      })
      .finally(() => {
        if (isActive()) setLoading(false)
      })
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => void load(() => active))
    return () => {
      active = false
    }
  }, [load])

  return (
    <Space orientation="vertical" className="w-full">
      {error ? (
        <Alert
          type="error"
          title={t('Media could not be loaded')}
          description={localizeApiError(error, t)}
          action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
        />
      ) : null}
      <Select
        allowClear={allowClear}
        className="w-full"
        disabled={disabled || Boolean(error)}
        loading={loading}
        optionFilterProp="label"
        options={items.map((item) => ({
          label: `${item.productName} · ${item.alt}`,
          value: item.id,
        }))}
        placeholder={t('Select approved Catalog media')}
        showSearch
        value={value || undefined}
        onChange={onChange}
      />
    </Space>
  )
}
