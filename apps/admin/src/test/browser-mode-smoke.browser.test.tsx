import { describe, it, expect } from '@rstest/core'
import { page } from '@rstest/browser'
import { render } from '@testing-library/react'
import React from 'react'

void React

describe('browser mode smoke', () => {
  it('renders and interacts in real browser runtime', async () => {
    const Demo = () => <button type="button">Click Me</button>
    render(<Demo />)

    await expect.element(page.getByRole('button', { name: 'Click Me' })).toBeVisible()
  })
})
