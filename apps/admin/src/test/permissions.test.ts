import { describe, expect, it } from '@rstest/core'
import { hasPermission } from '../infrastructure/auth/permissions'

describe('permission policy', () => {
  it('viewer cannot access form.write', () => {
    expect(hasPermission('viewer', 'form.write')).toBe(false)
    expect(hasPermission('viewer', 'catalog.write')).toBe(false)
    expect(hasPermission('viewer', 'catalog.publish')).toBe(false)
    expect(hasPermission('viewer', 'inventory.adjust')).toBe(false)
    expect(hasPermission('viewer', 'reporting.export')).toBe(false)
    expect(hasPermission('viewer', 'settings.read')).toBe(false)
    expect(hasPermission('viewer', 'audit.read')).toBe(false)
    expect(hasPermission('viewer', 'privacy.manage')).toBe(false)
  })

  it('viewer can access read-only domains', () => {
    expect(hasPermission('viewer', 'dashboard.read')).toBe(true)
    expect(hasPermission('viewer', 'list.read')).toBe(true)
    expect(hasPermission('viewer', 'form.read')).toBe(true)
    expect(hasPermission('viewer', 'profile.read')).toBe(true)
    expect(hasPermission('viewer', 'result.read')).toBe(true)
    expect(hasPermission('viewer', 'catalog.read')).toBe(true)
    expect(hasPermission('viewer', 'inventory.read')).toBe(true)
    expect(hasPermission('viewer', 'reporting.read')).toBe(true)
  })

  it('admin can access all current permissions', () => {
    expect(hasPermission('admin', 'dashboard.read')).toBe(true)
    expect(hasPermission('admin', 'list.read')).toBe(true)
    expect(hasPermission('admin', 'form.read')).toBe(true)
    expect(hasPermission('admin', 'form.write')).toBe(true)
    expect(hasPermission('admin', 'profile.read')).toBe(true)
    expect(hasPermission('admin', 'result.read')).toBe(true)
    expect(hasPermission('admin', 'exception.read')).toBe(true)
    expect(hasPermission('admin', 'inventory.adjust')).toBe(true)
    expect(hasPermission('admin', 'reporting.export')).toBe(true)
    expect(hasPermission('admin', 'settings.read')).toBe(true)
    expect(hasPermission('admin', 'settings.write')).toBe(true)
    expect(hasPermission('admin', 'audit.read')).toBe(true)
    expect(hasPermission('admin', 'privacy.manage')).toBe(true)
  })

  it('uses the API permission set as the authority when present', () => {
    const apiPermissions = ['catalog.read'] as const

    expect(hasPermission('admin', 'catalog.read', apiPermissions)).toBe(true)
    expect(hasPermission('admin', 'catalog.write', apiPermissions)).toBe(false)
    expect(hasPermission('support', 'orders.read', [])).toBe(false)
  })

  it('enforces the storefront theme lifecycle permission matrix', () => {
    for (const permission of [
      'themes.read',
      'themes.write',
      'themes.preview',
      'themes.approve',
    ] as const) {
      expect(hasPermission('admin', permission)).toBe(true)
      expect(hasPermission('catalog_manager', permission)).toBe(true)
      expect(hasPermission('support', permission)).toBe(false)
      expect(hasPermission('analyst', permission)).toBe(false)
    }
    expect(hasPermission('operations', 'themes.read')).toBe(true)
    expect(hasPermission('operations', 'themes.write')).toBe(false)
    expect(hasPermission('operations', 'themes.preview')).toBe(false)
    expect(hasPermission('operations', 'themes.approve')).toBe(false)
  })
})
