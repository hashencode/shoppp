import { Button, Result } from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../shared/contexts/i18n-context'

void React

export const ForbiddenPage = () => {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <Result
      status="403"
      title={t('Access denied')}
      subTitle={t('Your administrator account does not have permission for this operation.')}
      extra={
        <Button type="primary" onClick={() => navigate('/catalog/products', { replace: true })}>
          {t('Return to catalog')}
        </Button>
      }
    />
  )
}
