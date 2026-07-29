import { Space, theme } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import React from 'react'

void React

type FixedPageToolbarProps = {
  children?: ReactNode
  zIndex?: number
}

type ToolbarToken = ReturnType<typeof theme.useToken>['token']

const FIXED_PAGE_TOOLBAR_BACKDROP = 'blur(1px)'

export const FIXED_PAGE_TOOLBAR_CLASS_NAME =
  'ax-fixed-toolbar fixed right-0 bottom-0 flex justify-center px-6 py-3'

const hasRenderableChildren = (children: ReactNode) => React.Children.toArray(children).length > 0

const withAlpha = (color: string, alpha: number) => {
  const normalized = color.trim()

  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1)
    const expandedHex =
      hex.length === 3
        ? hex
            .split('')
            .map((segment) => `${segment}${segment}`)
            .join('')
        : hex

    if (expandedHex.length === 6) {
      const red = Number.parseInt(expandedHex.slice(0, 2), 16)
      const green = Number.parseInt(expandedHex.slice(2, 4), 16)
      const blue = Number.parseInt(expandedHex.slice(4, 6), 16)

      return `rgba(${red}, ${green}, ${blue}, ${alpha})`
    }
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i)
  if (rgbMatch) {
    const channels = rgbMatch[1]?.split(',').map((segment) => segment.trim()) ?? []
    return `rgba(${channels.slice(0, 3).join(', ')}, ${alpha})`
  }

  return normalized
}

export const buildFixedPageToolbarStyle = (
  token: ToolbarToken,
  zIndex: number
): CSSProperties => ({
  left: 'var(--app-shell-sider-offset, 0px)',
  zIndex,
  borderTop: `1px solid ${withAlpha(token.colorBorderSecondary, 0.82)}`,
  backgroundColor: withAlpha(token.colorBgElevated, 0.6),
  backdropFilter: FIXED_PAGE_TOOLBAR_BACKDROP,
  WebkitBackdropFilter: FIXED_PAGE_TOOLBAR_BACKDROP,
  boxShadow: `0 -8px 24px ${withAlpha(token.colorText, 0.04)}`,
})

export const FixedPageToolbar = ({ children, zIndex = 11 }: FixedPageToolbarProps) => {
  const { token } = theme.useToken()

  if (!hasRenderableChildren(children)) {
    return null
  }

  return (
    <div
      className={FIXED_PAGE_TOOLBAR_CLASS_NAME}
      style={buildFixedPageToolbarStyle(token, zIndex)}
    >
      <Space>{children}</Space>
    </div>
  )
}
