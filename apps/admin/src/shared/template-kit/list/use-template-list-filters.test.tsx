import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import type { FormInstance } from 'antd'
import { useTemplateListFilters } from './use-template-list-filters'

type Values = {
  name?: string
}

type Filters = {
  keyword?: string
}

describe('useTemplateListFilters', () => {
  it('applies filters on submit and values change', () => {
    let resetPageCount = 0
    const form = {
      resetFields: () => undefined,
    } as unknown as FormInstance<Values>

    const { result } = renderHook(() =>
      useTemplateListFilters<Values, Filters>({
        form,
        initialFilters: {},
        toFilters: (values) => ({
          keyword: values.name,
        }),
        onResetPage: () => {
          resetPageCount += 1
        },
      })
    )

    act(() => {
      result.current.onValuesChange({ name: 'alpha' })
    })

    expect(result.current.filters).toEqual({ keyword: 'alpha' })

    act(() => {
      result.current.onSubmit({ name: 'beta' })
    })

    expect(result.current.filters).toEqual({ keyword: 'beta' })
    expect(resetPageCount).toBe(2)
  })

  it('does not auto-apply values change when autoApplyOnValuesChange=false', () => {
    const form = {
      resetFields: () => undefined,
    } as unknown as FormInstance<Values>

    const { result } = renderHook(() =>
      useTemplateListFilters<Values, Filters>({
        form,
        initialFilters: {},
        toFilters: (values) => ({ keyword: values.name }),
        autoApplyOnValuesChange: false,
      })
    )

    act(() => {
      result.current.onValuesChange({ name: 'alpha' })
    })

    expect(result.current.filters).toEqual({})

    act(() => {
      result.current.onSubmit({ name: 'alpha' })
    })

    expect(result.current.filters).toEqual({ keyword: 'alpha' })
  })

  it('resets form and filters', () => {
    let resetFieldCount = 0
    const form = {
      resetFields: () => {
        resetFieldCount += 1
      },
    } as unknown as FormInstance<Values>

    const { result } = renderHook(() =>
      useTemplateListFilters<Values, Filters>({
        form,
        initialFilters: {},
        toFilters: (values) => ({
          keyword: values.name,
        }),
      })
    )

    act(() => {
      result.current.onSubmit({ name: 'beta' })
    })

    expect(result.current.filters).toEqual({ keyword: 'beta' })

    act(() => {
      result.current.onReset()
    })

    expect(resetFieldCount).toBe(1)
    expect(result.current.filters).toEqual({})
  })
})
