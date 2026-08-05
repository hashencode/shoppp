import React from 'react'
import { ConfigProvider, DatePicker } from 'antd'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { getAntdLocale } from './antd-locale'

void React

describe('Ant Design locale', () => {
  it('uses locale-sensitive component copy for Chinese and English', () => {
    const { rerender } = render(
      <ConfigProvider locale={getAntdLocale('zh-CN')}>
        <DatePicker />
      </ConfigProvider>
    )

    expect(screen.getByPlaceholderText('请选择日期')).toBeTruthy()

    rerender(
      <ConfigProvider locale={getAntdLocale('en-US')}>
        <DatePicker />
      </ConfigProvider>
    )

    expect(screen.getByPlaceholderText('Select date')).toBeTruthy()
  })
})
