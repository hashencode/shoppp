import { SettingOutlined } from '@ant-design/icons'
import { Button, Dropdown, App, theme } from 'antd'
import type { MenuProps } from 'antd'
import { FoldHorizontal, RefreshCcw } from 'lucide-react'
import React, { useMemo } from 'react'
import { useTheme } from '../contexts/theme-context'
import { useI18n } from '../contexts/i18n-context'

void React

type SearchSettingsDropdownProps = {
  compactLayout?: {
    enabled: boolean
    onChange: (enabled: boolean) => void
  }
}

const SEARCH_SETTINGS_LABEL_MIN_WIDTH = 120

const buildIndicatorLabel = (
  label: string,
  active: boolean,
  activeColor: string,
  inactiveColor: string
) => (
  <span
    className="inline-flex items-center justify-between gap-3"
    style={{ minWidth: SEARCH_SETTINGS_LABEL_MIN_WIDTH }}
  >
    <span>{label}</span>
    <span
      className="h-2 w-2 rounded-full"
      style={{ background: active ? activeColor : inactiveColor }}
    />
  </span>
)

export const ListSearchSettingsDropdown = ({ compactLayout }: SearchSettingsDropdownProps) => {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { t } = useI18n()
  const { listAutoRefreshEnabled, setListAutoRefreshEnabled } = useTheme()

  const menuItems = useMemo<MenuProps['items']>(() => {
    const items: NonNullable<MenuProps['items']> = []

    if (compactLayout) {
      items.push({
        key: 'search-compact-layout',
        icon: <FoldHorizontal size={16} />,
        label: buildIndicatorLabel(
          t('Compact search layout'),
          compactLayout.enabled,
          token.colorPrimary,
          token.colorFillSecondary
        ),
      })
    }

    items.push({
      key: 'list-auto-refresh',
      icon: <RefreshCcw size={16} />,
      label: buildIndicatorLabel(
        t('Auto-refresh list'),
        listAutoRefreshEnabled,
        token.colorPrimary,
        token.colorFillSecondary
      ),
    })

    return items
  }, [compactLayout, listAutoRefreshEnabled, t, token.colorFillSecondary, token.colorPrimary])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'search-compact-layout' && compactLayout) {
      const nextValue = !compactLayout.enabled
      compactLayout.onChange(nextValue)
      void message.success(
        t(nextValue ? 'Compact search layout enabled.' : 'Compact search layout disabled.')
      )
      return
    }

    if (key === 'list-auto-refresh') {
      const nextValue = !listAutoRefreshEnabled
      setListAutoRefreshEnabled(nextValue)
      void message.success(
        t(nextValue ? 'List auto-refresh enabled.' : 'List auto-refresh disabled.')
      )
    }
  }

  return (
    <Dropdown
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button icon={<SettingOutlined />} aria-label={t('Search settings')} />
    </Dropdown>
  )
}
