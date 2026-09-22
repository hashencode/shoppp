import React from 'react'
import { Alert, Button, List } from 'antd'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

export type CollectionBacklink = {
  fieldPath: string
  href?: string
  id: string
  type: string
  version: number
}

export const CollectionBlockedDependencies = ({
  backlinks,
}: {
  backlinks: CollectionBacklink[]
}) => {
  const { t } = useI18n()
  if (!backlinks.length) return null
  return (
    <Alert
      type="warning"
      showIcon
      title={t('Collection is still referenced')}
      description={
        <List
          size="small"
          dataSource={backlinks}
          renderItem={(item) => (
            <List.Item
              actions={
                item.href
                  ? [
                      <Button
                        key="repair"
                        type="link"
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('Repair reference')}
                      </Button>,
                    ]
                  : undefined
              }
            >
              {item.type} · {item.id} · v{item.version} · {item.fieldPath}
            </List.Item>
          )}
        />
      }
    />
  )
}
