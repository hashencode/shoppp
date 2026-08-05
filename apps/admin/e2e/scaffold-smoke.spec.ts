import { expect, test } from '@playwright/test'
import { normalizeAppBasePath } from '../src/shared/utils/normalize-app-base-path'
import { mockLoginRequired } from './support'

test('loads the administrator email and password login', async ({ page }) => {
  await mockLoginRequired(page)
  const appBase = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)
  await page.goto(`${appBase}/login`)

  await expect(page.getByText('登录 Shoppp 后台')).toBeVisible()
  await expect(page.getByLabel('邮箱')).toBeVisible()
  await expect(page.getByLabel('密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
})
