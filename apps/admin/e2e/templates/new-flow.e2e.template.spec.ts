import { expect, test } from '@playwright/test'
import { mockAdminSession } from '../support'

test.describe('Xxx Flow E2E', () => {
  test('should complete the critical user journey', async ({ page }) => {
    // Local UI E2E mocks the authoritative session endpoint, never an application credential form.
    await mockAdminSession(page)
    await page.goto('/template/list/table')

    // 1) navigate to target page
    await page.getByRole('link', { name: '查询列表' }).click()
    await expect(page.getByText('查询列表')).toBeVisible()

    // 2) query
    await page.getByPlaceholder('请输入规则名称').fill('模板')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.getByText('模板列表')).toBeVisible()

    // 3) open create form and validate navigation
    await page.getByRole('button', { name: '新建规则' }).click()
    await expect(page).toHaveURL(/\/template\/form\/basic-form/)
  })

  test('should reject unauthorized write action for viewer', async ({ page }) => {
    await mockAdminSession(page, ['catalog.read'])
    await page.goto('/template/list/table')
    await expect(page.getByText('查询列表')).toBeVisible()
    await expect(page.getByRole('button', { name: '新建规则' })).toHaveCount(0)
  })
})
