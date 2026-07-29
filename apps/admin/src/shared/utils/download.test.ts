import { afterEach, beforeEach, describe, expect, it } from '@rstest/core'
import { buildDownloadUrl, downloadBlob, toBlobFileName } from './download'

let createObjectUrlCalled = 0
let revokeObjectUrlCalled = 0
let anchorClickCalled = 0
let openedUrl = ''
let openedTarget = ''
let openedFeatures = ''
let windowOpenError: Error | null = null

const originalCreateObjectURL = window.URL.createObjectURL
const originalRevokeObjectURL = window.URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click
const originalWindowOpen = window.open

const makeAxiosNetworkError = (code = 'ERR_NETWORK') =>
  Object.assign(new Error('Network Error'), { isAxiosError: true, code, request: {} })

const makeNormalizedTransportError = () =>
  Object.assign(new Error('请求失败，请稍后重试。'), {
    code: 'UNKNOWN_ERROR',
    cause: makeAxiosNetworkError(),
  })

beforeEach(() => {
  createObjectUrlCalled = 0
  revokeObjectUrlCalled = 0
  anchorClickCalled = 0
  openedUrl = ''
  openedTarget = ''
  openedFeatures = ''
  windowOpenError = null

  window.URL.createObjectURL = () => {
    createObjectUrlCalled += 1
    return 'blob:download-test'
  }
  window.URL.revokeObjectURL = () => {
    revokeObjectUrlCalled += 1
  }
  HTMLAnchorElement.prototype.click = () => {
    anchorClickCalled += 1
  }
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (windowOpenError) throw windowOpenError
    openedUrl = String(url)
    openedTarget = target || ''
    openedFeatures = features || ''
    return null
  }) as typeof window.open
})

afterEach(() => {
  window.URL.createObjectURL = originalCreateObjectURL
  window.URL.revokeObjectURL = originalRevokeObjectURL
  HTMLAnchorElement.prototype.click = originalAnchorClick
  window.open = originalWindowOpen
})

describe('download utils', () => {
  it('parses UTF-8, plain, missing, and malformed content-disposition filenames', () => {
    expect(toBlobFileName("attachment; filename*=UTF-8''%E5%AD%A6%E5%91%98.xlsx", 'fallback.xlsx')).toBe('学员.xlsx')
    expect(toBlobFileName('attachment; filename="student.xlsx"', 'fallback.xlsx')).toBe('student.xlsx')
    expect(toBlobFileName("attachment; filename*=UTF-8''%E0%A4%A", 'fallback.xlsx')).toBe('fallback.xlsx')
  })

  it('downloads blob response and reads content-disposition file name', async () => {
    const result = await downloadBlob({
      request: async () => ({
        data: new Blob(['content']),
        headers: {
          'content-disposition': "attachment; filename*=UTF-8''report.xlsx",
        },
      }),
      fallbackFileName: 'fallback.xlsx',
      fallbackUrl: '/download/fallback',
    })

    expect(result.method).toBe('blob')
    if (result.method === 'blob') {
      expect(result.fileName).toBe('report.xlsx')
    }
    expect(createObjectUrlCalled).toBe(1)
    expect(anchorClickCalled).toBe(1)
    expect(revokeObjectUrlCalled).toBe(1)
    expect(openedUrl).toBe('')
  })

  it('decodes percent-encoded file names from content-disposition', async () => {
    const result = await downloadBlob({
      request: async () => ({
        data: new Blob(['content']),
        headers: {
          'content-disposition': 'attachment; filename="%E8%A5%BF%E5%AD%A6%E4%B8%AD.xlsx"',
        },
      }),
      fallbackFileName: 'fallback.xlsx',
    })

    expect(result.method).toBe('blob')
    if (result.method === 'blob') {
      expect(result.fileName).toBe('西学中.xlsx')
    }
    expect(anchorClickCalled).toBe(1)
    expect(openedUrl).toBe('')
  })

  it('opens fallback url only when blob request has a transport failure', async () => {
    const result = await downloadBlob({
      request: async () => {
        throw makeAxiosNetworkError()
      },
      fallbackFileName: 'fallback.xlsx',
      fallbackUrl: '/download/fallback?type=1',
      fallbackWindowFeatures: 'width=640,NoOpener=0,noreferrer=false',
    })

    expect(result.method).toBe('fallback')
    if (result.method === 'fallback') {
      expect(result.fallbackUrl).toBe('/download/fallback?type=1')
    }
    expect(anchorClickCalled).toBe(0)
    expect(openedUrl).toBe('/download/fallback?type=1')
    expect(openedTarget).toBe('_blank')
    expect(openedFeatures).toBe('width=640,noopener,noreferrer')
  })

  it('supports fetch and normalized transport failures', async () => {
    for (const error of [new TypeError('Failed to fetch'), makeNormalizedTransportError()]) {
      openedUrl = ''
      const result = await downloadBlob({
        request: async () => { throw error },
        fallbackFileName: 'fallback.xlsx',
        fallbackUrl: 'https://oss.example.com/fallback.xlsx',
      })
      expect(result.method).toBe('fallback')
      expect(openedUrl).toBe('https://oss.example.com/fallback.xlsx')
    }
  })

  it('does not fallback for http, business, or plain application errors', async () => {
    const errors = [
      Object.assign(new Error('登录已失效'), { status: 401 }),
      Object.assign(new Error('接口返回错误'), { response: { status: 500 } }),
      Object.assign(new Error('业务错误'), { code: 'AUTH_EXPIRED' }),
      new Error('request failed'),
    ]

    for (const error of errors) {
      openedUrl = ''
      await expect(downloadBlob({
        request: async () => { throw error },
        fallbackFileName: 'fallback.xlsx',
        fallbackUrl: '/download/fallback',
      })).rejects.toThrow(error.message)
      expect(openedUrl).toBe('')
    }
  })

  it('rejects unsafe or credentialed fallback urls', async () => {
    for (const fallbackUrl of [
      'javascript:alert(1)',
      'data:text/plain,test',
      'file:///tmp/a.xlsx',
      'https://user:pass@oss.example.com/a.xlsx',
      '//user:pass@oss.example.com/a.xlsx',
    ]) {
      await expect(downloadBlob({
        request: async () => { throw makeAxiosNetworkError() },
        fallbackFileName: 'fallback.xlsx',
        fallbackUrl,
      })).rejects.toThrow('兜底下载地址不安全')
      expect(openedUrl).toBe('')
    }
  })

  it('rejects when fallback window opening throws', async () => {
    windowOpenError = new Error('blocked')
    await expect(downloadBlob({
      request: async () => { throw makeAxiosNetworkError() },
      fallbackFileName: 'fallback.xlsx',
      fallbackUrl: '/download/fallback',
    })).rejects.toThrow('兜底下载窗口打开失败')
  })

  it('rejects without opening a fallback window when no fallback url is provided', async () => {
    await expect(
      downloadBlob({
        request: async () => {
          throw new Error('request failed')
        },
        fallbackFileName: 'fallback.xlsx',
      })
    ).rejects.toThrow('request failed')

    expect(anchorClickCalled).toBe(0)
    expect(openedUrl).toBe('')
  })

  it('does not fallback when response is a json error blob', async () => {
    await expect(
      downloadBlob({
        request: async () => ({
          data: new Blob([JSON.stringify({ message: '导出失败' })]),
          headers: { 'content-type': 'application/json;charset=utf-8' },
        }),
        fallbackFileName: 'fallback.xlsx',
        fallbackUrl: '/download/fallback',
      })
    ).rejects.toThrow('导出失败')

    expect(anchorClickCalled).toBe(0)
    expect(openedUrl).toBe('')
  })

  it('builds download urls with filtered query params', () => {
    expect(
      buildDownloadUrl('/api/export?status=2', {
        size: 9999,
        keyword: 'abc',
        empty: '',
        missing: undefined,
      })
    ).toBe('/api/export?status=2&size=9999&keyword=abc')

    expect(buildDownloadUrl('templates/import.xlsx?version=old#download', {
      version: 'new',
      page: 0,
      enabled: false,
    })).toBe('templates/import.xlsx?version=new&page=0&enabled=false#download')

    expect(buildDownloadUrl('https://oss.example.com/import.xlsx?version=old#download', {
      version: 'new',
    })).toBe('https://oss.example.com/import.xlsx?version=new#download')
  })
})
