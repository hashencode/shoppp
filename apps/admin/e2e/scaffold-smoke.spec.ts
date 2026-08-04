import { expect, test } from '@playwright/test'
import { normalizeAppBasePath } from '../src/shared/utils/normalize-app-base-path'
import { mockAccessRequired } from './support'

test('loads the Access session entry without offering application credentials', async ({ page }) => {
  await mockAccessRequired(page)
  const appBase = normalizeAppBasePath(process.env.PUBLIC_APP_BASE)
  await page.goto(`${appBase}/login`)

  await expect(page.getByText('Cloudflare Access session required')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify Access session' })).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
})
