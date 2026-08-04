import {
  ADMIN_PERMISSION_KEYS,
  type AdminPermission,
  type AdminSession,
} from '@shoppp/contracts'
import type { Page } from '@playwright/test'

const session: AdminSession = {
  displayName: 'Admin browser proof',
  email: 'admin-browser-proof@example.test',
  environment: 'test',
  identityId: 'admin-browser-proof',
  permissions: [...ADMIN_PERMISSION_KEYS],
  principalKind: 'human',
  role: {
    enabled: true,
    id: 'role_admin',
    key: 'admin',
    name: 'Admin',
    protected: true,
    system: true,
    version: 1,
  },
}

export async function mockAdminSession(
  page: Page,
  permissions: readonly AdminPermission[] = ADMIN_PERMISSION_KEYS
): Promise<void> {
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { data: { ...session, permissions: [...permissions] } },
    })
  })
}

export async function mockAccessRequired(page: Page): Promise<void> {
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        error: { code: 'access_required', message: 'Cloudflare Access authentication is required.' },
      },
      status: 401,
    })
  })
}
