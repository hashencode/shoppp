import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { PageHeaderWithBack } from './form-page-header'

void React

describe('PageHeaderWithBack', () => {
  it('shows a pointer cursor on the clickable back icon', () => {
    let backCount = 0

    render(
      <PageHeaderWithBack
        title="编辑记录"
        onBack={() => {
          backCount += 1
        }}
      />
    )

    const backIcon = screen.getByLabelText('返回')
    expect(backIcon.getAttribute('class')).toContain('cursor-pointer')

    fireEvent.click(backIcon)

    expect(backCount).toBe(1)
  })

  it('does not trigger back when clicking the title', () => {
    let backCount = 0

    render(
      <PageHeaderWithBack
        title="编辑记录"
        onBack={() => {
          backCount += 1
        }}
      />
    )

    fireEvent.click(screen.getByText('编辑记录'))

    expect(backCount).toBe(0)
  })
})
