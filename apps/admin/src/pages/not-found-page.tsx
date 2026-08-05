import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../shared/contexts/i18n-context'

export const NotFoundPage = () => {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <Result
      status="404"
      title={t('Page not found')}
      subTitle={t('This operations route does not exist or is no longer available.')}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          {t('Return to dashboard')}
        </Button>
      }
    />
  )
}
