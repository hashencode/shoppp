import { localizeThemeError } from '../theme-feedback'
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Collapse, Descriptions, Space, Tag, Typography } from 'antd'
import { fetchStorefrontLibraryHistory } from '../../../services/storefront/api'
import { useI18n } from '../../../shared/contexts/i18n-context'

void React
export const StorefrontLibraryHistory = () => {
  const { locale, t } = useI18n()
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchStorefrontLibraryHistory>
  > | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      setData(await fetchStorefrontLibraryHistory())
      setError(null)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])
  const active = data?.active.verification === 'verified' ? data.active.publication : null
  return (
    <Card
      title={t('Online store version')}
      extra={
        <Button loading={busy} onClick={() => void refresh()}>
          {t('Refresh status')}
        </Button>
      }
    >
      <Space orientation="vertical" className="w-full">
        {error ? (
          <Alert
            type="warning"
            title={t('Online version could not be verified.')}
            description={localizeThemeError(error, t)}
          />
        ) : null}
        {active && !error ? (
          <Descriptions
            size="small"
            column={1}
            styles={{ content: { overflowWrap: 'anywhere' } }}
            items={[
              {
                key: 'status',
                label: t('Status'),
                children: <Tag color="success">{t('Currently online')}</Tag>,
              },
              {
                key: 'theme',
                label: t('Theme package'),
                children: `${active.identity.themeId} ${active.identity.themeVersion}`,
              },
              {
                key: 'updated',
                label: t('Updated'),
                children: new Date(active.updatedAt).toLocaleString(locale),
              },
            ]}
          />
        ) : data && !error ? (
          <Typography.Text type="secondary">
            {t(
              data.active.verification === 'none'
                ? 'No verified online version'
                : 'Online version could not be verified.'
            )}
          </Typography.Text>
        ) : null}
        {data?.publications.length ? (
          <Collapse
            items={[
              {
                key: 'history',
                label: t('Version history'),
                children: (
                  <Space orientation="vertical" className="w-full">
                    {data.publications.map((publication) => (
                      <div
                        key={publication.id}
                        className="w-full rounded border border-solid p-3"
                        style={{ borderColor: 'var(--ant-color-border-secondary)' }}
                      >
                        <Space wrap>
                          <Tag
                            color={active?.id === publication.id && !error ? 'success' : 'default'}
                          >
                            {t(
                              active?.id === publication.id && !error
                                ? 'Currently online'
                                : publication.status === 'succeeded'
                                  ? 'Previously published'
                                  : publication.status === 'failed'
                                    ? 'Publication failed'
                                    : publication.status === 'unresolved'
                                      ? 'Publication needs verification'
                                      : 'Publication queued'
                            )}
                          </Tag>
                          <span>{publication.updatedAt}</span>
                          <span>{publication.identity.themeVersion}</span>
                        </Space>
                        <Collapse
                          className="mt-2"
                          items={[
                            {
                              key: 'details',
                              label: t('Version details'),
                              children: (
                                <pre className="overflow-auto text-xs">
                                  {JSON.stringify(
                                    {
                                      identity: publication.identity,
                                      receipt: publication.receipt,
                                      status: publication.status,
                                      failureCode: publication.failureCode,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
        ) : null}
      </Space>
    </Card>
  )
}
