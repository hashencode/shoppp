import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from '@rstest/core'

const readAppCss = () => readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

let styleElement: HTMLStyleElement | null = null

const installAppCss = () => {
  styleElement = document.createElement('style')
  styleElement.textContent = readAppCss()
  document.head.append(styleElement)
}

const appendToForm = (element: HTMLElement) => {
  const form = document.createElement('form')
  form.className = 'ant-form'
  form.style.color = 'rgb(1, 2, 3)'
  form.append(element)
  document.body.append(form)
}

describe('index.css disabled form control readability', () => {
  afterEach(() => {
    styleElement?.remove()
    styleElement = null
    document.body.replaceChildren()
  })

  it('uses the normal theme text color for disabled input-like form values', () => {
    installAppCss()

    const input = document.createElement('input')
    input.className = 'ant-input ant-input-disabled'
    input.disabled = true
    input.placeholder = '请输入名称'
    input.value = '基地名称'

    const emptyInput = document.createElement('input')
    emptyInput.className = 'ant-input ant-input-disabled'
    emptyInput.disabled = true
    emptyInput.placeholder = '请输入名称'

    const inputNumberInput = document.createElement('input')
    inputNumberInput.className = 'ant-input-number-input'
    inputNumberInput.placeholder = '请输入数量'
    inputNumberInput.value = '12'
    const inputNumber = document.createElement('div')
    inputNumber.className = 'ant-input-number ant-input-number-disabled'
    inputNumber.append(inputNumberInput)

    const pickerInput = document.createElement('input')
    pickerInput.placeholder = '请选择日期'
    pickerInput.value = '2026-07-02'
    const pickerInputWrapper = document.createElement('span')
    pickerInputWrapper.className = 'ant-picker-input'
    pickerInputWrapper.append(pickerInput)
    const picker = document.createElement('div')
    picker.className = 'ant-picker ant-picker-disabled'
    picker.append(pickerInputWrapper)

    const emptyPickerInput = document.createElement('input')
    emptyPickerInput.placeholder = '请选择日期'
    const emptyPickerInputWrapper = document.createElement('span')
    emptyPickerInputWrapper.className = 'ant-picker-input'
    emptyPickerInputWrapper.append(emptyPickerInput)
    const emptyPicker = document.createElement('div')
    emptyPicker.className = 'ant-picker ant-picker-disabled'
    emptyPicker.append(emptyPickerInputWrapper)

    appendToForm(input)
    appendToForm(emptyInput)
    appendToForm(inputNumber)
    appendToForm(picker)
    appendToForm(emptyPicker)

    expect(getComputedStyle(input).color).toBe('var(--app-text)')
    expect(getComputedStyle(emptyInput).color).not.toBe('var(--app-text)')
    expect(getComputedStyle(inputNumberInput).color).toBe('var(--app-text)')
    expect(getComputedStyle(pickerInput).color).toBe('var(--app-text)')
    expect(getComputedStyle(emptyPickerInput).color).not.toBe('var(--app-text)')
  })

  it('uses the normal theme text color for disabled select values without targeting placeholders or buttons', () => {
    installAppCss()
    const css = readAppCss()

    const selectionItem = document.createElement('span')
    selectionItem.className = 'ant-select-selection-item'
    const contentHasValue = document.createElement('div')
    contentHasValue.className = 'ant-select-content ant-select-content-has-value'
    const contentValue = document.createElement('span')
    contentValue.className = 'ant-select-content-value'
    const selectionItemContent = document.createElement('span')
    selectionItemContent.className = 'ant-select-selection-item-content'
    const placeholder = document.createElement('span')
    placeholder.className = 'ant-select-placeholder'
    const selectionPlaceholder = document.createElement('span')
    selectionPlaceholder.className = 'ant-select-selection-placeholder'
    const contentWithoutValue = document.createElement('div')
    contentWithoutValue.className = 'ant-select-content'
    contentWithoutValue.append(selectionPlaceholder)
    const select = document.createElement('div')
    select.className = 'ant-select ant-select-disabled'
    select.append(selectionItem, contentHasValue, contentValue, selectionItemContent, placeholder, contentWithoutValue)

    const pickerSelectionItem = document.createElement('span')
    pickerSelectionItem.className = 'ant-picker-selection-item'
    const picker = document.createElement('div')
    picker.className = 'ant-picker ant-picker-disabled'
    picker.append(pickerSelectionItem)

    const disabledButton = document.createElement('button')
    disabledButton.className = 'ant-btn ant-btn-disabled'
    disabledButton.disabled = true

    appendToForm(select)
    appendToForm(picker)
    appendToForm(disabledButton)

    expect(getComputedStyle(selectionItem).color).toBe('var(--app-text)')
    expect(getComputedStyle(contentHasValue).color).toBe('var(--app-text)')
    expect(getComputedStyle(contentValue).color).toBe('var(--app-text)')
    expect(getComputedStyle(selectionItemContent).color).toBe('var(--app-text)')
    expect(getComputedStyle(pickerSelectionItem).color).toBe('var(--app-text)')
    expect(getComputedStyle(placeholder).color).not.toBe('var(--app-text)')
    expect(getComputedStyle(contentWithoutValue).color).not.toBe('var(--app-text)')
    expect(getComputedStyle(selectionPlaceholder).color).not.toBe('var(--app-text)')
    expect(
      css.slice(
        css.indexOf('.ant-form .ant-input.ant-input-disabled'),
        css.indexOf(":root[data-form-content-align='left']")
      )
    ).not.toContain('ant-btn')
  })

  it('uses the normal theme text color for checked disabled checkbox and radio values only', () => {
    installAppCss()

    const checkedCheckboxIcon = document.createElement('span')
    checkedCheckboxIcon.className = 'ant-checkbox ant-checkbox-checked'
    const checkedCheckboxText = document.createElement('span')
    const checkedCheckbox = document.createElement('label')
    checkedCheckbox.className = 'ant-checkbox-wrapper ant-checkbox-wrapper-disabled'
    checkedCheckbox.append(checkedCheckboxIcon, checkedCheckboxText)

    const uncheckedCheckboxIcon = document.createElement('span')
    uncheckedCheckboxIcon.className = 'ant-checkbox'
    const uncheckedCheckboxText = document.createElement('span')
    const uncheckedCheckbox = document.createElement('label')
    uncheckedCheckbox.className = 'ant-checkbox-wrapper ant-checkbox-wrapper-disabled'
    uncheckedCheckbox.append(uncheckedCheckboxIcon, uncheckedCheckboxText)

    const checkedRadioIcon = document.createElement('span')
    checkedRadioIcon.className = 'ant-radio ant-radio-checked'
    const checkedRadioText = document.createElement('span')
    const checkedRadio = document.createElement('label')
    checkedRadio.className = 'ant-radio-wrapper ant-radio-wrapper-disabled'
    checkedRadio.append(checkedRadioIcon, checkedRadioText)

    const uncheckedRadioIcon = document.createElement('span')
    uncheckedRadioIcon.className = 'ant-radio'
    const uncheckedRadioText = document.createElement('span')
    const uncheckedRadio = document.createElement('label')
    uncheckedRadio.className = 'ant-radio-wrapper ant-radio-wrapper-disabled'
    uncheckedRadio.append(uncheckedRadioIcon, uncheckedRadioText)

    appendToForm(checkedCheckbox)
    appendToForm(uncheckedCheckbox)
    appendToForm(checkedRadio)
    appendToForm(uncheckedRadio)

    expect(getComputedStyle(checkedCheckboxText).color).toBe('var(--app-text)')
    expect(getComputedStyle(uncheckedCheckboxText).color).not.toBe('var(--app-text)')
    expect(getComputedStyle(checkedRadioText).color).toBe('var(--app-text)')
    expect(getComputedStyle(uncheckedRadioText).color).not.toBe('var(--app-text)')
  })

  it('keeps disabled form value colors tied to light and dark theme variables', () => {
    const css = readAppCss()

    expect(css).toContain('--app-text: #1f1f1f;')
    expect(css).toContain(":root[data-theme='dark']")
    expect(css).toContain('--app-text: #f5f5f5;')
    expect(css).toContain('color: var(--app-text);')
  })
})
