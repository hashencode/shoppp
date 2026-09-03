import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useI18n } from '../contexts/i18n-context'

void React

export const SetupGuideReturn = () => {
  const { pathname, search } = useLocation()
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const supportedPath = [
    '/settings/launch',
    '/settings/shipping',
    '/catalog/products',
    '/storefront/themes',
  ].some(
    (path) =>
      pathname === path ||
      (['/catalog/products', '/storefront/themes'].includes(path) &&
        pathname.startsWith(`${path}/`))
  )
  if (
    !supportedPath ||
    new URLSearchParams(search).get('from') !== 'setup-guide' ||
    !hasPermission(role, 'settings.read', permissions)
  )
    return null
  return (
    <Link className="mb-3 inline-block underline underline-offset-4" to="/welcome">
      {t('Back to store setup guide')}
    </Link>
  )
}
