import { Card, Typography } from 'antd'
import { useI18n } from '../../shared/contexts/i18n-context'

export const WelcomePage = () => {
  const { t } = useI18n()
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Typography.Title className="mb-0 !text-2xl">
          {t('Welcome to Admin Quick Start')}
        </Typography.Title>
      </div>
      <Typography.Paragraph>
        {t(
          'An Ant Design Pro-aligned information architecture and layout without a ProComponents dependency, for quickly building consistent admin pages, permission-aware layouts, and business templates.'
        )}
      </Typography.Paragraph>
    </Card>
  )
}
