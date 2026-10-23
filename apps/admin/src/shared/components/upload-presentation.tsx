import './upload-presentation.css'

import { CloudUploadOutlined } from '@ant-design/icons'
import { Button, Upload, theme } from 'antd'
import type { UploadProps } from 'antd'
import type { UploadRef } from 'antd/es/upload'
import classNames from 'classnames'
import { FileUp } from 'lucide-react'
import React, { useLayoutEffect, useRef } from 'react'

import { useI18n } from '../contexts/i18n-context'

void React

export type UploadDisplayMode = 'button' | 'card' | 'dragger'

export const UploadTrigger = ({
  displayMode,
  text,
  icon,
  hint,
  disabled,
  describedBy,
}: {
  displayMode: UploadDisplayMode
  text?: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
  disabled?: boolean
  describedBy?: string
}) => {
  const { t } = useI18n()
  if (displayMode === 'dragger') {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
        <span className="mb-2 flex items-center justify-center">
          {icon ?? <FileUp size={30} strokeWidth={1.5} />}
        </span>
        <p className="ant-upload-text">{text ?? t('Click or drag a file to this area')}</p>
        {hint ? <p className="ant-upload-hint">{hint}</p> : null}
      </div>
    )
  }
  if (displayMode === 'card') {
    return (
      <>
        {icon ?? (
          <FileUp
            aria-label={typeof text === 'string' ? text : t('Upload')}
            color="currentColor"
            size={30}
            strokeWidth={1.5}
          />
        )}
        {text}
      </>
    )
  }
  return (
    <Button
      disabled={disabled}
      aria-describedby={describedBy}
      icon={icon ?? <CloudUploadOutlined aria-hidden />}
    >
      {text ?? t('Upload file')}
    </Button>
  )
}

export const UploadPresentation = ({
  displayMode,
  uploadProps,
  error,
  errorId,
  helperText,
  children,
}: {
  displayMode: UploadDisplayMode
  uploadProps: UploadProps & React.AriaAttributes
  error?: React.ReactNode
  errorId?: string
  helperText?: React.ReactNode
  children?: React.ReactNode
}) => {
  const { token } = theme.useToken()
  const uploadRef = useRef<UploadRef>(null)
  const describedBy = uploadProps['aria-describedby']
  const invalid = uploadProps['aria-invalid']
  useLayoutEffect(() => {
    if (displayMode !== 'dragger') return
    const control = uploadRef.current?.nativeElement?.querySelector(
      '.ant-upload-btn[role="button"]'
    )
    if (!control) return
    // rc-upload puts ARIA on its hidden input; retain it on the keyboard control too.
    for (const [name, value] of [
      ['aria-describedby', describedBy],
      ['aria-invalid', invalid],
    ] as const) {
      if (value === undefined) control.removeAttribute(name)
      else control.setAttribute(name, String(value))
    }
  }, [describedBy, displayMode, invalid])
  const Component = displayMode === 'dragger' ? Upload.Dragger : Upload
  return (
    <>
      <Component
        {...uploadProps}
        ref={uploadRef}
        className={classNames(
          'ax-upload-presentation',
          `ax-upload-presentation--${displayMode}`,
          uploadProps.className
        )}
      >
        {children}
      </Component>
      {error ? (
        <div id={errorId} role="alert" className="mt-1" style={{ color: token.colorError }}>
          {error}
        </div>
      ) : null}
      {helperText ? <div className="mt-2 text-description">{helperText}</div> : null}
    </>
  )
}
