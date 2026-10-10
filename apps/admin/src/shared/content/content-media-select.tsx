import { Alert, Space } from 'antd'
import React, { useCallback, useState } from 'react'

import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchContentMedia,
  type ContentMediaAsset,
  type ContentMediaSource,
} from '../../services/content/api'
import { RemoteSearchSelect } from '../components/remote-search-select'
import { useI18n } from '../contexts/i18n-context'
import { localizeApiError } from '../i18n/api-error'

void React

export const ContentMediaSelect = ({
  allowClear = false,
  disabled = false,
  id,
  onChange,
  source = 'content',
  value,
  ...fieldAria
}: {
  allowClear?: boolean
  disabled?: boolean
  id?: string
  onChange?: (value: string | undefined) => void
  source?: ContentMediaSource
  value?: string
} & Pick<React.AriaAttributes, 'aria-describedby' | 'aria-invalid' | 'aria-required'>) => {
  const { t } = useI18n()
  const [error, setError] = useState<ApiError | null>(null)

  const fetchOptions = useCallback(
    async (query: string, page = 1) => {
      setError(null)
      const items = await fetchContentMedia(query, source, page)
      return items.map((item) => ({
        label: `${item.productName} · ${item.alt}`,
        value: item.id,
        raw: item,
      }))
    },
    [source]
  )

  return (
    <Space orientation="vertical" className="w-full">
      {error ? (
        <Alert
          type="error"
          title={t('Media could not be loaded')}
          description={localizeApiError(error, t)}
        />
      ) : null}
      <RemoteSearchSelect<ContentMediaAsset, string>
        key={source}
        {...fieldAria}
        allowClear={allowClear}
        id={id}
        className="w-full"
        disabled={disabled}
        fetchOptions={fetchOptions}
        loadOnOpen={Boolean(error)}
        onFetchError={(reason) => setError(normalizeApiError(reason))}
        placeholder={t('Select approved Catalog media')}
        showSearch
        value={value || undefined}
        onChange={onChange}
      />
    </Space>
  )
}
