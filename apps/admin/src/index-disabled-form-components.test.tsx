import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from '@rstest/core'
import {
  AutoComplete,
  DatePicker,
  Form,
  Input,
  Mentions,
  Rate,
  Slider,
  Switch,
  TimePicker,
  TreeSelect,
  Upload,
} from 'antd'
import dayjs from 'dayjs'
import React from 'react'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const { TextArea } = Input
const { RangePicker } = DatePicker

const readAppCss = () => readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

let styleElement: HTMLStyleElement | null = null

const installAppCss = () => {
  styleElement = document.createElement('style')
  styleElement.textContent = readAppCss()
  document.head.append(styleElement)
}

const findElement = <T extends HTMLElement>(container: HTMLElement, selector: string) => {
  const element = container.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing rendered AntD element for selector: ${selector}`)
  }
  return element as T
}

const expectNormalTextColor = (element: HTMLElement) => {
  expect(getComputedStyle(element).color).toBe('var(--app-text)')
}

const expectNotNormalTextColor = (element: HTMLElement) => {
  expect(getComputedStyle(element).color).not.toBe('var(--app-text)')
}

const renderDisabledComponentMatrix = () =>
  render(
    <Form className="ant-form" disabled style={{ color: 'rgb(1, 2, 3)' }}>
      <Form.Item label="TextArea">
        <TextArea defaultValue="多行说明" placeholder="请输入说明" />
      </Form.Item>

      <Form.Item label="TreeSelect">
        <TreeSelect
          defaultValue="dongcheng"
          treeData={[
            {
              title: '北京市',
              value: 'beijing',
              children: [{ title: '东城区', value: 'dongcheng' }],
            },
          ]}
        />
      </Form.Item>

      <Form.Item label="RangePicker">
        <RangePicker
          value={[dayjs('2026-07-01'), dayjs('2026-07-02')]}
          placeholder={['开始日期', '结束日期']}
        />
      </Form.Item>

      <Form.Item label="TimePicker">
        <TimePicker value={dayjs('09:30:00', 'HH:mm:ss')} placeholder="请选择时间" />
      </Form.Item>

      <Form.Item label="AutoComplete">
        <AutoComplete defaultValue="北京基地" options={[{ value: '北京基地' }]} placeholder="请输入基地" />
      </Form.Item>

      <Form.Item label="Mentions">
        <Mentions defaultValue="@zhangsan" placeholder="请输入人员" />
      </Form.Item>

      <Form.Item label="Switch">
        <Switch defaultChecked checkedChildren="启用" unCheckedChildren="停用" />
      </Form.Item>

      <Form.Item label="Slider">
        <Slider defaultValue={50} marks={{ 50: '50' }} />
      </Form.Item>

      <Form.Item label="Rate">
        <Rate defaultValue={3} />
      </Form.Item>

      <Form.Item label="Upload">
        <Upload
          defaultFileList={[
            {
              uid: 'license',
              name: 'license.png',
              status: 'done',
              url: 'https://oss.example.com/license.png',
            },
          ]}
        />
      </Form.Item>
    </Form>
  )

describe('index.css disabled AntD form component readability', () => {
  afterEach(() => {
    cleanup()
    styleElement?.remove()
    styleElement = null
  })

  it('uses normal text color for disabled text-bearing component values', () => {
    installAppCss()
    const { container } = renderDisabledComponentMatrix()

    expectNormalTextColor(findElement(container, 'textarea.ant-input[disabled]'))
    expectNormalTextColor(findElement(container, '.ant-tree-select.ant-select-disabled .ant-select-content-has-value'))

    const rangePickerInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('.ant-picker-range.ant-picker-disabled .ant-picker-input > input')
    )
    expect(rangePickerInputs).toHaveLength(2)
    rangePickerInputs.forEach(expectNormalTextColor)

    expectNormalTextColor(findElement(container, '.ant-picker:not(.ant-picker-range).ant-picker-disabled .ant-picker-input > input'))
    expectNormalTextColor(findElement(container, '.ant-select-auto-complete.ant-select-disabled .ant-select-input'))
    expectNormalTextColor(findElement(container, '.ant-mentions.ant-mentions-disabled textarea'))
  })

  it('keeps disabled non-text controls outside the forced value text-color rule', () => {
    installAppCss()
    const css = readAppCss()
    const { container } = renderDisabledComponentMatrix()

    expect(findElement(container, '.ant-switch.ant-switch-disabled')).toBeTruthy()
    expect(findElement(container, '.ant-slider.ant-slider-disabled')).toBeTruthy()
    expect(findElement(container, '.ant-rate.ant-rate-disabled')).toBeTruthy()
    expect(findElement(container, '.ant-upload-wrapper .ant-upload-list-item-name')).toBeTruthy()

    const forcedValueRule = css.slice(
      css.indexOf('.ant-form .ant-input.ant-input-disabled'),
      css.indexOf(":root[data-form-content-align='left']")
    )
    expect(forcedValueRule).not.toContain('ant-switch')
    expect(forcedValueRule).not.toContain('ant-slider')
    expect(forcedValueRule).not.toContain('ant-rate')
    expect(forcedValueRule).not.toContain('ant-upload')

    expectNotNormalTextColor(findElement(container, '.ant-slider-mark-text-active'))
  })
})
