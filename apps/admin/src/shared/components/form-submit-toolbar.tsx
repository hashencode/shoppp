import { Button, Popconfirm } from 'antd'
import type { ButtonHTMLType } from 'antd/es/button'
import React from 'react'
import type { ReactNode } from 'react'
import { FixedPageToolbar } from './fixed-page-toolbar'

void React

type FormSubmitToolbarProps = {
  submitLabel?: string
  submitDescription?: string
  submitLoading?: boolean
  submitDisabled?: boolean
  submitHtmlType?: ButtonHTMLType
  onSubmit?: () => void
  resetLabel?: string
  resetDescription?: string
  resetDisabled?: boolean
  resetConfirmTitle?: string
  onReset?: () => void
  leadingSlot?: ReactNode
}

const ActionDescription = ({ children }: { children?: string }) => {
  if (!children) {
    return null
  }

  return <div className="text-center text-xs text-[var(--text-secondary)]">{children}</div>
}

export const FormSubmitActions = ({
  submitLabel = '保存',
  submitDescription,
  submitLoading = false,
  submitDisabled = false,
  submitHtmlType = 'button',
  onSubmit,
  resetLabel = '重置',
  resetDescription,
  resetDisabled = false,
  resetConfirmTitle = '确认重置当前内容？',
  onReset,
  leadingSlot,
}: FormSubmitToolbarProps) => {
  return (
    <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3">
      {leadingSlot}

      <div className="flex flex-col items-center gap-1">
        <Popconfirm
          title={resetConfirmTitle}
          okText="确认"
          cancelText="取消"
          disabled={resetDisabled}
          onConfirm={onReset}
        >
          <Button htmlType="button" disabled={resetDisabled}>
            {resetLabel}
          </Button>
        </Popconfirm>
        <ActionDescription>{resetDescription}</ActionDescription>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Button
          type="primary"
          htmlType={submitHtmlType}
          loading={submitLoading}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
        <ActionDescription>{submitDescription}</ActionDescription>
      </div>
    </div>
  )
}

export const FormSubmitToolbar = (props: FormSubmitToolbarProps) => {
  return (
    <FixedPageToolbar>
      <FormSubmitActions {...props} />
    </FixedPageToolbar>
  )
}
