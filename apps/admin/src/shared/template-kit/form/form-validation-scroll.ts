import type { FormInstance } from 'antd'

export const FORM_ERROR_SCROLL_OPTIONS = {
  behavior: 'smooth',
  block: 'center',
  focus: true,
} as const

type FormValidationError<TValues extends object> = {
  errorFields?: Array<{
    name?: Parameters<FormInstance<TValues>['scrollToField']>[0]
  }>
}

export const validateFieldsWithScroll = async <TValues extends object>(
  form: FormInstance<TValues>,
  ...args: Parameters<FormInstance<TValues>['validateFields']>
): Promise<TValues> => {
  try {
    return await form.validateFields(...args)
  } catch (error) {
    const firstErrorName = (error as FormValidationError<TValues>).errorFields?.[0]?.name

    if (firstErrorName) {
      form.scrollToField(firstErrorName, FORM_ERROR_SCROLL_OPTIONS)
    }

    throw error
  }
}
