import { useCallback, useEffect, useRef, useState } from 'react'
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
  const alive = useRef(true)
  const detailGeneration = useRef(0)
  const submitLock = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      detailGeneration.current += 1
    }
  }, [])
  const {
    loading: detailLoading,
    error: detailError,
    runWithResult: runDetailRequest,
    clearError: clearDetailError,
  } = useLatestRequest<TEntity, [string], TError>({
    request: fetchDetail,
    mapError,
  })

  const loadDetail = useCallback(async () => {
    const generation = ++detailGeneration.current
    if (!parsedMode.ok || !modeView?.canFetch || !parsedMode.resourceKey) {
      return
    }

    const result = await runDetailRequest(parsedMode.resourceKey)
    if (!alive.current || generation !== detailGeneration.current || result.status === 'ignored')
      return
    if (result.status === 'error') {
      setDetailData(null)
      return
    }

    setDetailData(result.data)
    form.setFieldsValue(toValues(result.data) as SetFieldsValueArg)
  }, [form, modeView?.canFetch, parsedMode, runDetailRequest, toValues])

  const initializeForm = useCallback(async () => {
    detailGeneration.current += 1
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

      if (parsedMode.mode === 'readonly' || !modeView.canEdit || submitLock.current) {
        const blockedError = new Error('form is readonly or a save is already in progress')
        return {
          success: false,
          error: mapError ? mapError(blockedError) : (blockedError as TError),
        }
      }

      submitLock.current = true
      setSaveLoading(true)
      try {
        const payload = toPayload(values)
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
        submitLock.current = false
        if (alive.current) setSaveLoading(false)
      }
    },
    [createEntity, mapError, modeView, parsedMode, toPayload, updateEntity]
  )

  return {
    detailData,
    detailLoading: Boolean(modeView?.canFetch) && detailLoading,
    detailError: modeView?.canFetch ? detailError : null,
    saveLoading,
    isReadonly: !modeView?.canEdit,
    initializeForm,
    loadDetail,
    resetFormValues,
    submitFormValues,
  }
}
