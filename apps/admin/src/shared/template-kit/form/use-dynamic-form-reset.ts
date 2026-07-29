import { useCallback } from 'react'
import type { FormInstance } from 'antd'
import type { NamePath } from 'antd/es/form/interface'

type DynamicResetFieldName<TValues> = Parameters<FormInstance<TValues>['getFieldValue']>[0]

type DynamicResetFieldContext<TValues> = {
  name: DynamicResetFieldName<TValues>
  instance: unknown
  element: HTMLElement | null
  value: unknown
}

type UseDynamicFormResetOptions<TValues> = {
  form: FormInstance<TValues>
  isReadonly?: boolean
  shouldResetField?: (field: DynamicResetFieldContext<TValues>) => boolean
  getResetValue?: (field: DynamicResetFieldContext<TValues>) => unknown
  afterReset?: (fields: DynamicResetFieldContext<TValues>[]) => void
}

const isHtmlElement = (value: unknown): value is HTMLElement => {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
}

const resolveFieldElement = (value: unknown, depth = 0): HTMLElement | null => {
  if (depth > 3 || !value) {
    return null
  }

  if (isHtmlElement(value)) {
    return value
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const element = resolveFieldElement(item, depth + 1)
      if (element) {
        return element
      }
    }
    return null
  }

  if (typeof value !== 'object') {
    return null
  }

  const objectValue = value as Record<string, unknown>
  const candidates = [
    objectValue.nativeElement,
    objectValue.input,
    objectValue.element,
    objectValue.selector,
    objectValue.picker,
    objectValue.resizableTextArea,
  ]

  for (const candidate of candidates) {
    const element = resolveFieldElement(candidate, depth + 1)
    if (element) {
      return element
    }
  }

  if (
    objectValue.resizableTextArea &&
    typeof objectValue.resizableTextArea === 'object' &&
    'textArea' in objectValue.resizableTextArea
  ) {
    return resolveFieldElement(
      (objectValue.resizableTextArea as Record<string, unknown>).textArea,
      depth + 1
    )
  }

  return null
}

const isFieldElementHidden = (element: HTMLElement | null) => {
  if (!element) {
    return false
  }

  if (element instanceof HTMLInputElement && element.type === 'hidden') {
    return true
  }

  return Boolean(element.closest('.ant-form-item-hidden,[hidden],[aria-hidden="true"]'))
}

const isFieldElementDisabled = (element: HTMLElement | null) => {
  if (!element) {
    return false
  }

  if (
    element.matches(':disabled,[aria-disabled="true"]') ||
    element.closest(
      [
        '.ant-select-disabled',
        '.ant-picker-disabled',
        '.ant-input-number-disabled',
        '.ant-upload-disabled',
        '.ant-checkbox-disabled',
        '.ant-radio-disabled',
        '.ant-cascader-disabled',
      ].join(',')
    )
  ) {
    return true
  }

  return false
}

const toNamePathSegments = (name: NamePath) => (Array.isArray(name) ? name : [name])

const namePathKey = (name: NamePath) => JSON.stringify(toNamePathSegments(name))

const assignValueAtNamePath = (target: Record<string, unknown>, name: NamePath, value: unknown) => {
  const segments = toNamePathSegments(name)
  let current: Record<string, unknown> = target

  segments.forEach((segment, index) => {
    const nextKey = String(segment)

    if (index === segments.length - 1) {
      current[nextKey] = value
      return
    }

    const nextValue = current[nextKey]
    if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
      current[nextKey] = {}
    }

    current = current[nextKey] as Record<string, unknown>
  })
}

const buildResettableFields = <TValues,>(
  form: FormInstance<TValues>,
  shouldResetField?: (field: DynamicResetFieldContext<TValues>) => boolean
) => {
  const fields = form.getFieldsError()
  const seen = new Set<string>()

  return fields
    .map((field) => field.name)
    .filter((name) => {
      if (toNamePathSegments(name).length === 0) {
        return false
      }

      const key = namePathKey(name)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .map((name) => {
      const fieldName = name as DynamicResetFieldName<TValues>
      const instance = form.getFieldInstance(fieldName)
      const element = resolveFieldElement(instance)
      return {
        name: fieldName,
        instance,
        element,
        value: form.getFieldValue(fieldName),
      }
    })
    .filter((field) => {
      if (isFieldElementHidden(field.element) || isFieldElementDisabled(field.element)) {
        return false
      }

      return shouldResetField ? shouldResetField(field) : true
    })
}

export const useDynamicFormReset = <TValues extends object>({
  form,
  isReadonly = false,
  shouldResetField,
  getResetValue,
  afterReset,
}: UseDynamicFormResetOptions<TValues>) => {
  return useCallback(() => {
    if (isReadonly) {
      return
    }

    const resettableFields = buildResettableFields(form, shouldResetField)
    if (resettableFields.length === 0) {
      return
    }

    const nextValues: Record<string, unknown> = {}
    for (const field of resettableFields) {
      assignValueAtNamePath(nextValues, field.name, getResetValue ? getResetValue(field) : undefined)
    }

    form.setFieldsValue(nextValues as Parameters<FormInstance<TValues>['setFieldsValue']>[0])
    form.setFields(
      resettableFields.map((field) => ({
        name: field.name,
        errors: [],
        warnings: [],
      })) as Parameters<FormInstance<TValues>['setFields']>[0]
    )

    afterReset?.(resettableFields)
  }, [afterReset, form, getResetValue, isReadonly, shouldResetField])
}

export const getFormNativeElement = <TValues extends object>(form: FormInstance<TValues>) => {
  return (form as FormInstance<TValues> & { nativeElement?: HTMLElement | null }).nativeElement ?? null
}
