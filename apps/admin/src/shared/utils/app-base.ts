import { normalizeAppBasePath } from './normalize-app-base-path'

export { normalizeAppBasePath } from './normalize-app-base-path'

const URL_WITH_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i

export const APP_BASE_PATH = normalizeAppBasePath(import.meta.env.PUBLIC_APP_BASE)

const isExternalOrSpecialUrl = (url: string) =>
  URL_WITH_SCHEME_PATTERN.test(url) || url.startsWith('//') || url.startsWith('#')

export const withAppBasePath = (url: string, appBasePath = APP_BASE_PATH): string => {
  const normalizedBasePath = appBasePath === APP_BASE_PATH ? APP_BASE_PATH : normalizeAppBasePath(appBasePath)
  if (!normalizedBasePath || !url || isExternalOrSpecialUrl(url) || !url.startsWith('/')) return url

  if (
    url === normalizedBasePath ||
    url.startsWith(`${normalizedBasePath}/`) ||
    url.startsWith(`${normalizedBasePath}?`) ||
    url.startsWith(`${normalizedBasePath}#`)
  ) return url

  return `${normalizedBasePath}${url}`
}

export const stripAppBasePath = (url: string, appBasePath = APP_BASE_PATH): string => {
  const normalizedBasePath = appBasePath === APP_BASE_PATH ? APP_BASE_PATH : normalizeAppBasePath(appBasePath)
  if (!normalizedBasePath || !url || isExternalOrSpecialUrl(url) || !url.startsWith('/')) return url
  if (url === normalizedBasePath) return '/'

  if (
    url.startsWith(`${normalizedBasePath}/`) ||
    url.startsWith(`${normalizedBasePath}?`) ||
    url.startsWith(`${normalizedBasePath}#`)
  ) {
    const stripped = url.slice(normalizedBasePath.length)
    return stripped.startsWith('/') ? stripped : `/${stripped}`
  }

  return url
}

export const openAppPathInNewWindow = (
  url: string,
  target = '_blank',
  features = 'noopener,noreferrer'
) => window.open(withAppBasePath(url), target, features)
