import { ArrowLeft } from 'lucide-react'
import { Space, Typography } from 'antd'
import React, { type ReactNode } from 'react'
import { useI18n } from '../contexts/i18n-context'

void React

type FormPageHeaderProps = {
  title: ReactNode
  onBack: () => void
}

export const FormPageHeader = ({ title, onBack }: FormPageHeaderProps) => {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <ArrowLeft
        className="ax-breadcrumb__back-icon cursor-pointer"
        size={24}
        strokeWidth={2}
        onClick={onBack}
        aria-label={t('Back')}
      />
      <Space size={0}>
        <Typography.Title level={4} className="!mb-0">
          {title}
        </Typography.Title>
      </Space>
    </div>
  )
}

export type PageHeaderWithBackProps = FormPageHeaderProps
export const PageHeaderWithBack = FormPageHeader
