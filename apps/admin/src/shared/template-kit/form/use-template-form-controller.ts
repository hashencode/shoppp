import { useCallback, useState } from 'react'
import type { FormInstance } from 'antd'
import { useLatestRequest } from '../hooks/use-latest-request'
import type { FormModeViewModel, ParsedFormMode } from '../../../routes/form-route-contract'

type UseTemplateFormControllerOptions<TValues, TEntity, TPayload, TError> = {
  form: FormInstance<TValues>
  parsedMode: ParsedFormMode
  modeView: FormModeViewModel | null
  defaultValues: Partial<TValues>
  fetchDetail: (resourceKey: string) => Promise<TEntity>
  createEntity: (payload: TPayload) => Promise<TEntity>
  updateEntity: (resourceKey: string, payload: TPayload) => Promise<TEntity>
  toValues: (entity: TEntity) => TValues
  toPayload: (values: TValues) => TPayload
  mapError?: (error: unknown) => TError
}

type UseTemplateFormControllerResult<TValues, TEntity, TError> = {
  detailData: TEntity | null
  detailLoading: boolean
  detailError: TError | null
  saveLoading: boolean
  isReadonly: boolean
  initializeForm: () => Promise<void>
  loadDetail: () => Promise<void>
  resetFormValues: () => void
  submitFormValues: (
    values: TValues
  ) => Promise<{ success: true } | { success: false; error: TError }>
}

export const useTemplateFormController = <TValues, TEntity, TPayload, TError = unknown>({
  form,
  parsedMode,
  modeView,
  defaultValues,
  fetchDetail,
  createEntity,
  updateEntity,
  toValues,
  toPayload,
  mapError,
}: UseTemplateFormControllerOptions<
  TValues,
  TEntity,
  TPayload,
  TError
>): UseTemplateFormControllerResult<TValues, TEntity, TError> => {
  type SetFieldsValueArg = Parameters<FormInstance<TValues>['setFieldsValue']>[0]
  const [detailData, setDetailData] = useState<TEntity | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const {
    loading: detailLoading,
    error: detailError,
    run: runDetailRequest,
    clearError: clearDetailError,
  } = useLatestRequest<TEntity, [string], TError>({
    request: fetchDetail,
    mapError,
  })

  const loadDetail = useCallback(async () => {
    if (!parsedMode.ok || !modeView?.canFetch || !parsedMode.resourceKey) {
      return
    }

    const response = await runDetailRequest(parsedMode.resourceKey)
    if (!response) {
      setDetailData(null)
      return
    }

    setDetailData(response)
    form.setFieldsValue(toValues(response) as SetFieldsValueArg)
  }, [form, modeView?.canFetch, parsedMode, runDetailRequest, toValues])

  const initializeForm = useCallback(async () => {
    if (!parsedMode.ok || !modeView) {
      return
    }

    form.resetFields()
    if (!modeView.canFetch) {
      setDetailData(null)
      clearDetailError()
      form.setFieldsValue(defaultValues as SetFieldsValueArg)
      return
    }

    await loadDetail()
  }, [clearDetailError, defaultValues, form, loadDetail, modeView, parsedMode])

  const resetFormValues = useCallback(() => {
    form.resetFields()

    if (modeView?.canFetch && detailData) {
      form.setFieldsValue(toValues(detailData) as SetFieldsValueArg)
      return
    }

    form.setFieldsValue(defaultValues as SetFieldsValueArg)
  }, [defaultValues, detailData, form, modeView?.canFetch, toValues])

  const submitFormValues = useCallback(
    async (values: TValues): Promise<{ success: true } | { success: false; error: TError }> => {
      if (!parsedMode.ok || !modeView) {
        const unavailableModeError = mapError
          ? mapError(new Error('parsed mode unavailable while submitting form'))
          : (new Error('parsed mode unavailable while submitting form') as TError)
        return { success: false, error: unavailableModeError }
      }

      const payload = toPayload(values)
      setSaveLoading(true)
      try {
        if (parsedMode.mode === 'add') {
          await createEntity(payload)
        } else {
          const resourceKey = parsedMode.resourceKey
          if (!resourceKey) {
            const missingResourceKeyError = mapError
              ? mapError(new Error('resource key is missing for modify/readonly mode'))
              : (new Error('resource key is missing for modify/readonly mode') as TError)
            return { success: false, error: missingResourceKeyError }
          }
          await updateEntity(resourceKey, payload)
        }
        return { success: true }
      } catch (requestError) {
        const normalized = mapError ? mapError(requestError) : (requestError as TError)
        return { success: false, error: normalized }
      } finally {
        setSaveLoading(false)
      }
    },
    [createEntity, mapError, modeView, parsedMode, toPayload, updateEntity]
  )

  return {
    detailData,
    detailLoading,
    detailError,
    saveLoading,
    isReadonly: !modeView?.canEdit,
    initializeForm,
    loadDetail,
    resetFormValues,
    submitFormValues,
  }
}
