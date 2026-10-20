import { act, renderHook } from '@testing-library/react'
import type { FormInstance } from 'antd'
import { describe, expect, it } from '@rstest/core'
import { getFormModeViewModel, type ParsedFormMode } from '../../../routes/form-route-contract'
import { useTemplateFormController } from './use-template-form-controller'

type FormValues = { title: string }
type Entity = { resourceKey: string; title: string }
type Payload = { title: string }
type FormError = { message: string }

const createFormStub = () => {
  let resetCount = 0
  const setFieldsValueCalls: FormValues[] = []

  return {
    form: {
      resetFields: () => {
        resetCount += 1
      },
      setFieldsValue: (values: FormValues) => {
        setFieldsValueCalls.push(values)
      },
    } as unknown as FormInstance<FormValues>,
    getResetCount: () => resetCount,
    getSetFieldsValueCalls: () => setFieldsValueCalls,
  }
}

describe('useTemplateFormController', () => {
  it('initializes add mode with default values', async () => {
    const formStub = createFormStub()
    let fetchDetailCallCount = 0
    const fetchDetail = async (resourceKey: string): Promise<Entity> => {
      void resourceKey
      fetchDetailCallCount += 1
      return { resourceKey: '1', title: 'x' }
    }
    const createEntity = async (payload: Payload): Promise<Entity> => {
      void payload
      return { resourceKey: '2', title: 'x' }
    }
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => {
      void resourceKey
      void payload
      return { resourceKey: '3', title: 'x' }
    }

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'add' },
        modeView: getFormModeViewModel('add'),
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
      })
    )

    await act(async () => {
      await result.current.initializeForm()
    })

    expect(formStub.getResetCount()).toBe(1)
    expect(formStub.getSetFieldsValueCalls()).toEqual([{ title: 'default title' }])
    expect(fetchDetailCallCount).toBe(0)
  })

  it('loads detail and submits modify mode through updateEntity', async () => {
    const formStub = createFormStub()
    let lastFetchDetailResourceKey = ''
    const fetchDetail = async (resourceKey: string): Promise<Entity> => {
      lastFetchDetailResourceKey = resourceKey
      return {
        resourceKey: '9',
        title: 'remote title',
      }
    }
    let createEntityCallCount = 0
    const createEntity = async (payload: Payload): Promise<Entity> => {
      void payload
      createEntityCallCount += 1
      return { resourceKey: '2', title: 'x' }
    }
    let lastUpdateArgs: { resourceKey: string; payload: Payload } | null = null
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => {
      lastUpdateArgs = { resourceKey, payload }
      return {
        resourceKey,
        title: payload.title,
      }
    }

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'modify', resourceKey: '9' },
        modeView: getFormModeViewModel('modify'),
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
      })
    )

    await act(async () => {
      await result.current.initializeForm()
    })

    expect(lastFetchDetailResourceKey).toBe('9')
    expect(formStub.getSetFieldsValueCalls()).toContainEqual({ title: 'remote title' })

    let submitResult: Awaited<ReturnType<typeof result.current.submitFormValues>> | null = null
    await act(async () => {
      submitResult = await result.current.submitFormValues({ title: 'updated title' })
    })

    expect(lastUpdateArgs).toEqual({
      resourceKey: '9',
      payload: { title: 'updated title' },
    })
    expect(createEntityCallCount).toBe(0)
    expect(submitResult).toEqual({ success: true })
  })

  it('submits add mode through createEntity', async () => {
    const formStub = createFormStub()
    let createPayload: Payload | null = null
    const fetchDetail = async (resourceKey: string): Promise<Entity> => {
      return { resourceKey, title: 'x' }
    }
    const createEntity = async (payload: Payload): Promise<Entity> => {
      createPayload = payload
      return { resourceKey: 'new', title: payload.title }
    }
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => {
      return { resourceKey, title: payload.title }
    }

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'add' },
        modeView: getFormModeViewModel('add'),
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
      })
    )

    let submitResult: Awaited<ReturnType<typeof result.current.submitFormValues>> | null = null
    await act(async () => {
      submitResult = await result.current.submitFormValues({ title: 'created title' })
    })

    expect(createPayload).toEqual({ title: 'created title' })
    expect(submitResult).toEqual({ success: true })
  })

  it('returns mapped error when parsed mode is unavailable while submitting', async () => {
    const formStub = createFormStub()
    const fetchDetail = async (resourceKey: string): Promise<Entity> => ({ resourceKey, title: 'x' })
    const createEntity = async (payload: Payload): Promise<Entity> => ({ resourceKey: '2', title: payload.title })
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => ({
      resourceKey,
      title: payload.title,
    })

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: false, errorCode: 'ROUTE_PARAM_INVALID', message: 'invalid mode' },
        modeView: null,
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
        mapError: (error) => ({ message: (error as Error).message }),
      })
    )

    let submitResult: Awaited<ReturnType<typeof result.current.submitFormValues>> | null = null
    await act(async () => {
      submitResult = await result.current.submitFormValues({ title: 'x' })
    })

    expect(submitResult).toEqual({
      success: false,
      error: { message: 'parsed mode unavailable while submitting form' },
    })
  })

  it('returns mapped error when modify mode misses resourceKey', async () => {
    const formStub = createFormStub()
    const fetchDetail = async (resourceKey: string): Promise<Entity> => ({ resourceKey, title: 'x' })
    const createEntity = async (payload: Payload): Promise<Entity> => ({ resourceKey: '2', title: payload.title })
    let updateCalled = false
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => {
      updateCalled = true
      return { resourceKey, title: payload.title }
    }

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'modify' },
        modeView: getFormModeViewModel('modify'),
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
        mapError: (error) => ({ message: (error as Error).message }),
      })
    )

    let submitResult: Awaited<ReturnType<typeof result.current.submitFormValues>> | null = null
    await act(async () => {
      submitResult = await result.current.submitFormValues({ title: 'x' })
    })

    expect(updateCalled).toBe(false)
    expect(submitResult).toEqual({
      success: false,
      error: { message: 'resource key is missing for modify/readonly mode' },
    })
  })

  it('maps submit request error when createEntity fails', async () => {
    const formStub = createFormStub()
    const fetchDetail = async (resourceKey: string): Promise<Entity> => ({ resourceKey, title: 'x' })
    const createEntity = async (payload: Payload): Promise<Entity> => {
      void payload
      throw new Error('create failed')
    }
    const updateEntity = async (resourceKey: string, payload: Payload): Promise<Entity> => ({
      resourceKey,
      title: payload.title,
    })

    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload, FormError>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'add' },
        modeView: getFormModeViewModel('add'),
        defaultValues: { title: 'default title' },
        fetchDetail,
        createEntity,
        updateEntity,
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => ({ title: values.title }),
        mapError: (error) => ({ message: (error as Error).message }),
      })
    )

    let submitResult: Awaited<ReturnType<typeof result.current.submitFormValues>> | null = null
    await act(async () => {
      submitResult = await result.current.submitFormValues({ title: 'x' })
    })

    expect(submitResult).toEqual({ success: false, error: { message: 'create failed' } })
  })
  it('blocks readonly controller calls before payload conversion or writes', async () => {
    const formStub = createFormStub()
    let writes = 0
    let conversions = 0
    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'readonly', resourceKey: '7' },
        modeView: getFormModeViewModel('readonly'),
        defaultValues: {},
        fetchDetail: async (resourceKey) => ({ resourceKey, title: 'original' }),
        createEntity: async (payload) => {
          writes += 1
          return { resourceKey: '7', ...payload }
        },
        updateEntity: async (resourceKey, payload) => {
          writes += 1
          return { resourceKey, ...payload }
        },
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => {
          conversions += 1
          return values
        },
      })
    )
    await act(async () => {
      await result.current.submitFormValues({ title: 'changed' })
    })
    expect(writes).toBe(0)
    expect(conversions).toBe(0)
  })

  it('allows one write for duplicate calls in the same tick and recovers after failure', async () => {
    const formStub = createFormStub()
    let writes = 0
    let reject!: (reason: Error) => void
    const pending = new Promise<Entity>((_, fail) => {
      reject = fail
    })
    const { result } = renderHook(() =>
      useTemplateFormController<FormValues, Entity, Payload>({
        form: formStub.form,
        parsedMode: { ok: true, mode: 'add' },
        modeView: getFormModeViewModel('add'),
        defaultValues: {},
        fetchDetail: async (resourceKey) => ({ resourceKey, title: 'original' }),
        createEntity: async () => {
          writes += 1
          return pending
        },
        updateEntity: async (resourceKey, payload) => ({ resourceKey, ...payload }),
        toValues: (entity) => ({ title: entity.title }),
        toPayload: (values) => values,
      })
    )
    let calls!: Promise<unknown[]>
    act(() => {
      calls = Promise.all([
        result.current.submitFormValues({ title: 'first' }),
        result.current.submitFormValues({ title: 'second' }),
      ])
    })
    const pendingWrites = writes
    await act(async () => {
      reject(new Error('write failed'))
      await calls
    })
    expect(pendingWrites).toBe(1)
    expect(result.current.saveLoading).toBe(false)
    await act(async () => {
      await result.current.submitFormValues({ title: 'retry' })
    })
    expect(writes).toBe(2)
  })

  it('isolates a late modify detail from a newly initialized add session', async () => {
    const formStub = createFormStub()
    let resolve!: (entity: Entity) => void
    const pending = new Promise<Entity>((done) => {
      resolve = done
    })
    const { result, rerender } = renderHook(
      ({ parsedMode }: { parsedMode: ParsedFormMode }) =>
        useTemplateFormController<FormValues, Entity, Payload>({
          form: formStub.form,
          parsedMode,
          modeView: parsedMode.ok ? getFormModeViewModel(parsedMode.mode) : null,
          defaultValues: { title: 'new draft' },
          fetchDetail: async () => pending,
          createEntity: async (payload) => ({ resourceKey: 'new', ...payload }),
          updateEntity: async (resourceKey, payload) => ({ resourceKey, ...payload }),
          toValues: (entity) => ({ title: entity.title }),
          toPayload: (values) => values,
        }),
      {
        initialProps: {
          parsedMode: { ok: true, mode: 'modify', resourceKey: 'old' } as ParsedFormMode,
        },
      }
    )
    let oldLoad!: Promise<void>
    act(() => {
      oldLoad = result.current.initializeForm()
    })
    rerender({ parsedMode: { ok: true, mode: 'add' } })
    await act(async () => {
      await result.current.initializeForm()
    })
    await act(async () => {
      resolve({ resourceKey: 'old', title: 'stale detail' })
      await oldLoad
    })
    expect(formStub.getSetFieldsValueCalls().at(-1)).toEqual({ title: 'new draft' })
    expect(result.current.detailData).toBeNull()
    expect(result.current.detailError).toBeNull()
  })
})
