import { act, renderHook } from '@testing-library/react'
import type { FormInstance } from 'antd'
import { describe, expect, it } from '@rstest/core'
import { getFormModeViewModel } from '../../../routes/form-route-contract'
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
})
