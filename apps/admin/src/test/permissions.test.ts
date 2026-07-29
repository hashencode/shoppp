import { describe, expect, it } from '@rstest/core'
import { hasPermission } from '../infrastructure/auth/permissions'

describe('permission policy', () => {
  it('viewer cannot access form.write', () => {
    expect(hasPermission('viewer', 'form.write')).toBe(false)
  })

  it('viewer can access read-only domains', () => {
    expect(hasPermission('viewer', 'dashboard.read')).toBe(true)
    expect(hasPermission('viewer', 'list.read')).toBe(true)
    expect(hasPermission('viewer', 'form.read')).toBe(true)
    expect(hasPermission('viewer', 'profile.read')).toBe(true)
    expect(hasPermission('viewer', 'result.read')).toBe(true)
  })

  it('admin can access all current permissions', () => {
    expect(hasPermission('admin', 'dashboard.read')).toBe(true)
    expect(hasPermission('admin', 'list.read')).toBe(true)
    expect(hasPermission('admin', 'form.read')).toBe(true)
    expect(hasPermission('admin', 'form.write')).toBe(true)
    expect(hasPermission('admin', 'profile.read')).toBe(true)
    expect(hasPermission('admin', 'result.read')).toBe(true)
    expect(hasPermission('admin', 'exception.read')).toBe(true)
  })
})
