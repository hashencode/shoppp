import React, { type ReactNode } from 'react'

void React

export const StorefrontFieldGroup = ({
  children,
  label,
  showLabel = true,
}: {
  children: ReactNode
  label: string
  showLabel?: boolean
}) => (
  <fieldset aria-label={label} className="min-w-0 border-0 p-0">
    {showLabel ? (
      <legend
        className="mb-4 w-full border-0 border-b border-solid pb-2 text-sm font-medium"
        style={{ borderColor: 'var(--ant-color-border-secondary)' }}
      >
        {label}
      </legend>
    ) : null}
    {children}
  </fieldset>
)
