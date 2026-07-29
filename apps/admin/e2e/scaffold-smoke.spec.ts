import { expect, test } from '@playwright/test'
import { normalizeAppBasePath } from '../src/shared/utils/normalize-app-base-path'

test('loads the public login entry without credentials', async ({ page }) => {
  const appBase = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)
  await page.goto(`${appBase}/login`)

  await expect(page.getByPlaceholder('用户名')).toBeVisible()
  await expect(page.getByPlaceholder('密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '登 录' })).toBeVisible()
})
