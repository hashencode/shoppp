import { Card, Typography } from 'antd'
import { useI18n } from '../../shared/contexts/i18n-context'

export const WelcomePage = () => {
  const { t } = useI18n()
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Typography.Title className="mb-0 !text-2xl">
          {t('Welcome to Shoppp Admin')}
        </Typography.Title>
      </div>
      <Typography.Paragraph>
        {t(
          'Manage commerce operations, storefront experiences, and administrator access from one permission-aware workspace.'
        )}
      </Typography.Paragraph>
    </Card>
  )
}
