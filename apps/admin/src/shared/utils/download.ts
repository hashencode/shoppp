type BlobDownloadHeaders =
  | Headers
  | {
      get?: (name: string) => unknown
      [key: string]: unknown
    }
  | undefined

type BlobDownloadResponse = {
  data: Blob
  headers?: BlobDownloadHeaders
}

const decodeDispositionValue = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

export type DownloadBlobResult =
  | {
      method: 'blob'
      fileName: string
    }
  | {
      method: 'fallback'
      fallbackUrl: string
      error: unknown
    }

export type DownloadUrlParamValue = string | number | boolean | null | undefined

export type DownloadBlobOptions<TResponse extends BlobDownloadResponse = BlobDownloadResponse> = {
  request: () => Promise<TResponse>
  fallbackFileName: string
  fallbackUrl?: string
  fallbackWindowTarget?: string
  fallbackWindowFeatures?: string
}

export const toBlobFileName = (disposition: string | undefined, fallback: string): string => {
  if (!disposition) {
    return fallback
  }

  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    return decodeDispositionValue(utf8[1]) ?? fallback
  }

  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  if (!plain) {
    return fallback
  }

  return decodeDispositionValue(plain) ?? plain
}

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

const readHeader = (headers: BlobDownloadHeaders, name: string): string | undefined => {
  if (!headers) {
    return undefined
  }

  const getter = headers.get
  if (typeof getter === 'function') {
    const value = getter.call(headers, name) ?? getter.call(headers, name.toLowerCase())
    return typeof value === 'string' ? value : undefined
  }

  const lowerName = name.toLowerCase()
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName)
  const value = entry?.[1]
  return typeof value === 'string' ? value : undefined
}

const isJsonContentType = (contentType: string | undefined) => /\bjson\b/i.test(contentType || '')

const isJsonBlob = (blob: Blob, contentType?: string) =>
  isJsonContentType(blob.type) || isJsonContentType(contentType)

const toBlobErrorMessage = async (blob: Blob): Promise<string> => {
  const fallback = '下载失败，请稍后重试。'

  try {
    const text = await blob.text()
    const payload = JSON.parse(text) as { message?: unknown; msg?: unknown }
    const message = payload.message ?? payload.msg
    return typeof message === 'string' && message.trim() ? message : fallback
  } catch {
    return fallback
  }
}

const FALLBACK_ELIGIBLE_AXIOS_CODES = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const hasResponseMetadata = (error: unknown) =>
  isRecord(error) && (error.response !== undefined || error.status !== undefined)

const isAxiosTransportFailure = (error: unknown) =>
  isRecord(error) &&
  error.isAxiosError === true &&
  error.request !== undefined &&
  !hasResponseMetadata(error) &&
  typeof error.code === 'string' &&
  FALLBACK_ELIGIBLE_AXIOS_CODES.has(error.code)

const isNormalizedTransportFailure = (error: unknown) =>
  isRecord(error) &&
  !hasResponseMetadata(error) &&
  (error.code === 'UNKNOWN_ERROR' || error.code === 'QUERY_TIMEOUT') &&
  isAxiosTransportFailure(error.cause)

const hasApiErrorMetadata = (error: unknown) => {
  if (!isRecord(error)) return false
  if (hasResponseMetadata(error)) return true
  if (isNormalizedTransportFailure(error)) return false
  return error.isAxiosError !== true && typeof error.code === 'string'
}

const isFallbackEligibleError = (error: unknown) => {
  if (hasApiErrorMetadata(error)) return false
  if (isAxiosTransportFailure(error) || isNormalizedTransportFailure(error)) return true
  return error instanceof TypeError &&
    /failed to fetch|load failed|networkerror|network request failed/i.test(error.message)
}

const normalizeFallbackWindowFeatures = (target: string, features: string) => {
  if (target !== '_blank') return features

  const featureTokens = features
    .split(',')
    .map((feature) => feature.trim())
    .filter((feature) => {
      const key = feature.split('=')[0]?.trim().toLowerCase()
      return key !== 'noopener' && key !== 'noreferrer'
    })
  return [...featureTokens, 'noopener', 'noreferrer'].join(',')
}

const assertSafeFallbackUrl = (url: string) => {
  let parsed: URL
  try {
    parsed = new URL(url, window.location.origin)
  } catch {
    throw new Error('兜底下载地址无效。')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('兜底下载地址不安全。')
  }
}

const openFallbackWindow = (url: string, target: string, features: string) => {
  assertSafeFallbackUrl(url)
  try {
    window.open(url, target, normalizeFallbackWindowFeatures(target, features))
  } catch {
    throw new Error('兜底下载窗口打开失败，请稍后重试。')
  }
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i

const splitDownloadUrl = (url: string) => {
  const hashIndex = url.indexOf('#')
  const urlBeforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const queryIndex = urlBeforeHash.indexOf('?')

  return {
    path: queryIndex >= 0 ? urlBeforeHash.slice(0, queryIndex) : urlBeforeHash,
    search: queryIndex >= 0 ? urlBeforeHash.slice(queryIndex + 1) : '',
    hash,
  }
}

const appendDownloadParams = (
  searchParams: URLSearchParams,
  params?: Record<string, DownloadUrlParamValue>
) => {
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, String(value))
  })
}

export const buildDownloadUrl = (
  url: string,
  params?: Record<string, DownloadUrlParamValue>
) => {
  if (ABSOLUTE_URL_PATTERN.test(url)) {
    const parsed = new URL(url)
    appendDownloadParams(parsed.searchParams, params)
    return parsed.toString()
  }

  const { path, search, hash } = splitDownloadUrl(url)
  const searchParams = new URLSearchParams(search)
  appendDownloadParams(searchParams, params)
  const query = searchParams.toString()
  return `${path}${query ? `?${query}` : ''}${hash}`
}

export const downloadBlob = async <TResponse extends BlobDownloadResponse>({
  request,
  fallbackFileName,
  fallbackUrl,
  fallbackWindowTarget = '_blank',
  fallbackWindowFeatures = 'noopener,noreferrer',
}: DownloadBlobOptions<TResponse>): Promise<DownloadBlobResult> => {
  let response: TResponse

  try {
    response = await request()
  } catch (error) {
    if (!fallbackUrl || !isFallbackEligibleError(error)) throw error

    openFallbackWindow(fallbackUrl, fallbackWindowTarget, fallbackWindowFeatures)
    return {
      method: 'fallback',
      fallbackUrl,
      error,
    }
  }

  const contentType = readHeader(response.headers, 'content-type')
  if (isJsonBlob(response.data, contentType)) {
    throw new Error(await toBlobErrorMessage(response.data))
  }

  const fileName = toBlobFileName(readHeader(response.headers, 'content-disposition'), fallbackFileName)
  saveBlob(response.data, fileName)
  return { method: 'blob', fileName }
}
