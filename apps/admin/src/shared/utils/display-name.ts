const WHITESPACE_REGEX = /\s+/g
const CJK_CHAR_REGEX = /[\u3400-\u9fff\uf900-\ufaff]/

const MAX_DISPLAY_NAME_LENGTH = 32
const FALLBACK_DISPLAY_NAME = '访客用户'

export const normalizeDisplayName = (value?: string | null): string => {
  const withoutControlChars = [...(value ?? '')]
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0
      return codePoint >= 0x20 && !(codePoint >= 0x7f && codePoint <= 0x9f)
    })
    .join('')

  const normalized = withoutControlChars.replace(WHITESPACE_REGEX, ' ').trim()

  if (!normalized) {
    return FALLBACK_DISPLAY_NAME
  }

  return [...normalized].slice(0, MAX_DISPLAY_NAME_LENGTH).join('')
}

export const getDisplayNameAvatarText = (value?: string | null): string => {
  const normalized = normalizeDisplayName(value)
  const firstChar = [...normalized][0]

  if (!firstChar) {
    return '?'
  }

  return CJK_CHAR_REGEX.test(firstChar) ? firstChar : firstChar.toUpperCase()
}
