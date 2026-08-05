import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import type { AppLocale } from '../shared/contexts/i18n-context'

export const getAntdLocale = (locale: AppLocale) => (locale === 'zh-CN' ? zhCN : enUS)
