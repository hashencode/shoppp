import { Button, Card, Result, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/i18n-context'

type RouteErrorBoundaryProps = {
  errorCode: string
  detail: string
}

export const RouteErrorBoundary = ({ errorCode, detail }: RouteErrorBoundaryProps) => {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <Card>
      <Result
        status="error"
        title={t('Template route contract error')}
        subTitle={`${t('Code')}: ${errorCode}`}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            {t('Back to home')}
          </Button>
        }
      />
      <Typography.Paragraph
        className="mx-auto max-w-2xl"
        style={{ color: 'var(--text-secondary)' }}
      >
        {detail}
      </Typography.Paragraph>
    </Card>
  )
}
