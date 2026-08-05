import { Button, Popconfirm } from 'antd'
import type { ButtonHTMLType } from 'antd/es/button'
import React from 'react'
import type { ReactNode } from 'react'
import { FixedPageToolbar } from './fixed-page-toolbar'
import { useI18n } from '../contexts/i18n-context'

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
  submitLabel,
  submitDescription,
  submitLoading = false,
  submitDisabled = false,
  submitHtmlType = 'button',
  onSubmit,
  resetLabel,
  resetDescription,
  resetDisabled = false,
  resetConfirmTitle,
  onReset,
  leadingSlot,
}: FormSubmitToolbarProps) => {
  const { t } = useI18n()
  const resolvedSubmitLabel = submitLabel ?? t('Save')
  const resolvedResetLabel = resetLabel ?? t('Reset')
  const resolvedResetConfirmTitle = resetConfirmTitle ?? t('Reset the current content?')

  return (
    <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3">
      {leadingSlot}

      <div className="flex flex-col items-center gap-1">
        <Popconfirm
          title={resolvedResetConfirmTitle}
          okText={t('Confirm')}
          cancelText={t('Cancel')}
          disabled={resetDisabled}
          onConfirm={onReset}
        >
          <Button htmlType="button" disabled={resetDisabled}>
            {resolvedResetLabel}
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
          {resolvedSubmitLabel}
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
