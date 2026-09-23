import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../contexts/i18n-context'

void React

export const SetupGuideReturn = () => {
  const { pathname, search } = useLocation()
  const { t } = useI18n()
  const supportedPath = [
    '/settings/identity',
    '/settings/contact',
    '/settings/policies',
    '/settings/launch',
    '/settings/shipping',
    '/catalog/products',
    '/catalog/collections',
    '/content/pages',
    '/content/articles',
    '/storefront/navigation',
    '/storefront/themes',
    '/inventory',
    '/orders',
  ].some(
    (path) =>
      pathname === path ||
      ([
        '/catalog/products',
        '/catalog/collections',
        '/content/pages',
        '/content/articles',
        '/storefront/navigation',
        '/storefront/themes',
        '/orders',
      ].includes(path) &&
        pathname.startsWith(`${path}/`))
  )
  if (
    !supportedPath ||
    new URLSearchParams(search).get('from') !== 'setup-guide'
  )
    return null
  return (
    <Link className="mb-3 inline-block underline underline-offset-4" to="/welcome">
      {t('Back to store setup guide')}
    </Link>
  )
}
