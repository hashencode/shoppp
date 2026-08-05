import { describe, expect, it } from '@rstest/core'
import { ADMIN_PERMISSION_KEYS } from '@shoppp/contracts'
import { hasPermission } from '../infrastructure/auth/permissions'

describe('permission policy', () => {
  it('denies every permission when the API did not supply an authoritative set', () => {
    expect(hasPermission('admin', 'catalog.read')).toBe(false)
    expect(hasPermission('read_only_operator', 'catalog.read')).toBe(false)
  })

  it('uses only the API permission set as the authority', () => {
    const apiPermissions = ['catalog.read'] as const

    expect(hasPermission('admin', 'catalog.read', apiPermissions)).toBe(true)
    expect(hasPermission('admin', 'catalog.write', apiPermissions)).toBe(false)
    expect(hasPermission('support', 'orders.read', [])).toBe(false)
  })

  it('lets the protected admin grant exactly the complete catalog when returned by the API', () => {
    for (const permission of ADMIN_PERMISSION_KEYS) {
      expect(hasPermission('admin', permission, ADMIN_PERMISSION_KEYS)).toBe(true)
    }
  })

  it('does not let frontend-only role names grant business actions', () => {
    expect(hasPermission('catalog_operator', 'catalog.write')).toBe(false)
    expect(hasPermission('support_operator', 'orders.read')).toBe(false)
  })
})
