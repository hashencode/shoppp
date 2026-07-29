import { describe, expect, it } from '@rstest/core'
import { normalizeAppBasePath, stripAppBasePath, withAppBasePath } from './app-base'

describe('app-base utils', () => {
  it('normalizes internal app base paths', () => {
    expect(normalizeAppBasePath('/admin/')).toBe('/admin')
    expect(normalizeAppBasePath('/platform//admin/')).toBe('/platform/admin')
    expect(normalizeAppBasePath('/')).toBe('')
    expect(normalizeAppBasePath()).toBe('')
  })

  it('rejects external, ambiguous, and traversal app bases', () => {
    for (const value of ['https://example.com/admin', '//example.com/admin', 'admin', '/admin?x=1', '/admin#x', '/admin\\x', '/admin/../x', '/admin/%2e%2e/x']) {
      expect(() => normalizeAppBasePath(value)).toThrow()
    }
  })

  it('prefixes root-relative paths once and keeps external or relative urls unchanged', () => {
    expect(withAppBasePath('/users?status=1#top', '/admin')).toBe('/admin/users?status=1#top')
    expect(withAppBasePath('/admin/users', '/admin')).toBe('/admin/users')
    expect(withAppBasePath('https://example.com/users', '/admin')).toBe('https://example.com/users')
    expect(withAppBasePath('relative/users', '/admin')).toBe('relative/users')
  })

  it('strips only the configured app base', () => {
    expect(stripAppBasePath('/admin/users?status=1', '/admin')).toBe('/users?status=1')
    expect(stripAppBasePath('/admin', '/admin')).toBe('/')
    expect(stripAppBasePath('/other/users', '/admin')).toBe('/other/users')
  })
})
