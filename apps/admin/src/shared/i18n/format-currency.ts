type CurrencyFormatter = {
  divisor: number
  formatter: Intl.NumberFormat
}

const currencyFormatters = new Map<string, CurrencyFormatter>()

const getCurrencyFormatter = (locale: string, currency: string) => {
  const cacheKey = `${locale}:${currency}`
  const cached = currencyFormatters.get(cacheKey)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, { currency, style: 'currency' })
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  const entry = { divisor: 10 ** fractionDigits, formatter }
  currencyFormatters.set(cacheKey, entry)
  return entry
}

export const formatMinorCurrency = (amount: number, currency: string, locale: string) => {
  const { divisor, formatter } = getCurrencyFormatter(locale, currency)
  return formatter.format(amount / divisor)
}
