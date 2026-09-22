const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Shanghai',
] as const

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[]
}

export const isValidTimeZone = (value: string | null | undefined): value is string => {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const resolveDefaultTimeZone = () => {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
  return isValidTimeZone(resolved) ? resolved : 'UTC'
}

export const getTimeZoneOptions = (...includedValues: Array<string | null | undefined>) => {
  const supportedValues = (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone') ?? []
  const values = new Set([...FALLBACK_TIME_ZONES, ...supportedValues])
  includedValues.filter(isValidTimeZone).forEach((value) => values.add(value))
  return [...values]
    .sort((left, right) => {
      if (left === 'UTC') return -1
      if (right === 'UTC') return 1
      return left.localeCompare(right)
    })
    .map((value) => ({ label: value, value }))
}
