import { ArrowLeft } from 'lucide-react'
import { Space, Typography } from 'antd'
import React, { type ReactNode } from 'react'

void React

type FormPageHeaderProps = {
  title: ReactNode
  onBack: () => void
}

export const FormPageHeader = ({ title, onBack }: FormPageHeaderProps) => {
  return (
    <div className="flex items-center gap-2">
      <ArrowLeft
        className="ax-breadcrumb__back-icon cursor-pointer"
        size={24}
        strokeWidth={2}
        onClick={onBack}
        aria-label="返回"
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
