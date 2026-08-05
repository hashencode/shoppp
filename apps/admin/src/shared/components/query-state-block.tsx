import React from 'react'
import { Alert, Button, Empty, Result, Spin } from 'antd'
import type { ButtonProps } from 'antd'
import type { ReactNode } from 'react'

void React

export type QueryState = 'loading' | 'empty' | 'error' | 'partial'

type QueryStateBlockProps = {
  state: QueryState
  title: string
  description?: string
  primaryActionLabel?: string
  primaryActionButtonType?: ButtonProps['type']
  onPrimaryAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  children?: ReactNode
}

export const QueryStateBlock = ({
  state,
  title,
  description,
  primaryActionLabel,
  primaryActionButtonType,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: QueryStateBlockProps) => {
  const resolvedPrimaryActionButtonType = primaryActionButtonType ?? 'primary'

  if (state === 'loading') {
    return (
      <div
        className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed"
        style={{
          borderColor: 'var(--border-muted)',
          background: 'var(--surface-base)',
        }}
      >
        <Spin size="large" description={title} />
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="rounded-lg py-10" style={{ background: 'var(--surface-base)' }}>
        <Empty description={description ?? title} />
        {primaryActionLabel && onPrimaryAction ? (
          <div className="mt-3 flex justify-center">
            <Button type={resolvedPrimaryActionButtonType} onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <Result
        status="error"
        title={title}
        subTitle={description}
        extra={
          <div className="flex justify-center gap-2">
            {primaryActionLabel && onPrimaryAction ? (
              <Button type={resolvedPrimaryActionButtonType} onClick={onPrimaryAction}>
                {primaryActionLabel}
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button onClick={onSecondaryAction}>{secondaryActionLabel}</Button>
            ) : null}
          </div>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <Alert
        type="warning"
        showIcon
        title={title}
        description={description}
        action={
          primaryActionLabel && onPrimaryAction ? (
            <Button size="small" type="link" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          ) : undefined
        }
      />
      <div
        className="rounded-lg border px-3 py-3"
        style={{
          borderColor: 'var(--status-info-border)',
          background: 'var(--status-info-bg)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
