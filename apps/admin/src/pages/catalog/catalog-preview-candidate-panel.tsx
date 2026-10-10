import { Alert, Button, Card, Input, Space, Tag, Typography } from 'antd'
import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  buildCatalogPreviewCandidate,
  type CatalogPreviewCandidate,
} from '../../services/catalog/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'

void React

export const CatalogPreviewCandidatePanel = () => {
  const { t } = useI18n()
  const localizeError = useLocalizedApiError()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [candidate, setCandidate] = useState<CatalogPreviewCandidate | null>(null)
  const [error, setError] = useState<ReturnType<typeof normalizeApiError> | null>(null)
  const [loading, setLoading] = useState(false)

  const build = async () => {
    setLoading(true)
    setError(null)
    try {
      setCandidate(await buildCatalogPreviewCandidate(reason.trim()))
    } catch (cause) {
      setError(normalizeApiError(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title={t('Private preview candidate')} className="mb-4">
      <Space orientation="vertical" size="middle" className="w-full">
        <Typography.Text>
          {t(
            'Freeze the server-selected published sources for Theme Preview. This does not publish or deploy the storefront.'
          )}
        </Typography.Text>
        <Input.TextArea
          aria-label={t('Notes (optional)')}
          value={reason}
          rows={2}
          maxLength={500}
          placeholder={t('Notes (optional)')}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button type="primary" loading={loading} onClick={() => void build()}>
          {candidate ? t('Retry candidate build') : t('Build preview candidate')}
        </Button>
        {loading ? <Tag color="processing">{t('Candidate build pending')}</Tag> : null}
        {error ? (
          <Alert
            type="error"
            showIcon
            message={t('Candidate build failed')}
            description={localizeError(error)}
            action={<Button onClick={() => void build()}>{t('Retry')}</Button>}
          />
        ) : null}
        {candidate?.status === 'succeeded' ? (
          <Alert
            type="success"
            showIcon
            message={t('Private candidate ready')}
            description={
              <Space orientation="vertical" size="small">
                <Typography.Text code>{candidate.id}</Typography.Text>
                <Typography.Text>
                  {t('{count} published sources frozen for {environment}.', {
                    count: candidate.sources.length,
                    environment: candidate.environment,
                  })}
                </Typography.Text>
                <Space wrap>
                  <Tag color="purple">{t('Private Preview only')}</Tag>
                  {candidate.sources.map((source) => (
                    <Tag key={`${source.kind}:${source.id}`}>
                      {source.kind}: {source.id}@{source.version}
                    </Tag>
                  ))}
                </Space>
                <Button
                  onClick={() => {
                    window.sessionStorage.setItem('storefront-editor-catalog-release', candidate.id)
                    window.sessionStorage.setItem(
                      'storefront-editor-private-candidate',
                      candidate.id
                    )
                    navigate('/storefront/themes')
                  }}
                >
                  {t('Continue in Theme Editor')}
                </Button>
              </Space>
            }
          />
        ) : null}
      </Space>
    </Card>
  )
}
