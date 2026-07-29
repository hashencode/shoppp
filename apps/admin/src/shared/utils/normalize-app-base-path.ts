const AMBIGUOUS_ENCODED_PATH_PATTERN = /%(?:2e|2f|3f|23|5c)/i

export const normalizeAppBasePath = (basePath?: string): string => {
  const trimmed = basePath?.trim()
  if (!trimmed || trimmed === '/') return ''

  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    /[?#\\\u0000-\u001f\u007f]/.test(trimmed) ||
    AMBIGUOUS_ENCODED_PATH_PATTERN.test(trimmed)
  ) {
    throw new Error('PUBLIC_APP_BASE 必须是站内绝对路径。')
  }

  const segments = trimmed.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('PUBLIC_APP_BASE 不能包含相对路径段。')
  }

  return `/${segments.join('/')}`
}
