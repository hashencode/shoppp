import type { FormInstance } from 'antd'

export const FORM_ERROR_SCROLL_OPTIONS = {
  behavior: 'smooth',
  block: 'center',
  focus: true,
} as const

type ScrollableFormValidationError<TValues extends object> = {
  errorFields?: Array<{
    name?: Parameters<FormInstance<TValues>['scrollToField']>[0]
  }>
}

export const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } =>
  error !== null &&
  typeof error === 'object' &&
  'errorFields' in error &&
  Array.isArray(error.errorFields)

export const validateFieldsWithScroll = async <TValues extends object>(
  form: FormInstance<TValues>,
  ...args: Parameters<FormInstance<TValues>['validateFields']>
): Promise<TValues> => {
  try {
    return await form.validateFields(...args)
  } catch (error) {
    if (isFormValidationError(error)) {
      const firstErrorName = (error as ScrollableFormValidationError<TValues>).errorFields?.[0]
        ?.name

      if (firstErrorName) {
        form.scrollToField(firstErrorName, FORM_ERROR_SCROLL_OPTIONS)
      }
    }

    throw error
  }
}
