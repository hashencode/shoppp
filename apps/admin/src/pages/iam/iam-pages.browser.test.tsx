import React, { useState } from 'react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { AdminPermission } from '@shoppp/contracts'

import { PermissionChecklist } from './permission-checklist'

void React

afterEach(() => cleanup())

describe('IAM controls in a real browser', () => {
  it('keeps delegated permissions keyboard-accessible in a narrow container', async () => {
    const Probe = () => {
      const [value, setValue] = useState<AdminPermission[]>([])
      return (
        <div style={{ width: 320 }}>
          <PermissionChecklist
            permitted={['iam.users.read', 'iam.roles.read']}
            value={value}
            onChange={setValue}
          />
          <output aria-label="Selected permissions">{value.join(',')}</output>
        </div>
      )
    }
    render(<Probe />)

    const checkbox = page.getByRole('checkbox', { name: /View users/i })
    await expect.element(checkbox).toBeVisible()
    await checkbox.press('Space')
    await waitFor(() =>
      expect(document.querySelector('output')?.textContent).toBe('iam.users.read')
    )
    expect(document.querySelector('[aria-label="Role permissions"]')?.scrollWidth).toBeLessThanOrEqual(320)
  })
})
