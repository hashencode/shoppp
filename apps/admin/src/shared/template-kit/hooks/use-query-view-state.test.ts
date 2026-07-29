import { describe, expect, it } from '@rstest/core'
import { useQueryViewState } from './use-query-view-state'

describe('useQueryViewState', () => {
  it('prefers initial loading over empty/error/partial when no data yet', () => {
    const state = useQueryViewState({
      loading: true,
      hasData: false,
      isEmpty: true,
      hasError: true,
      isPartial: true,
    })

    expect(state).toEqual({
      showInitialLoading: true,
      showError: true,
      showEmpty: false,
      showPartial: false,
    })
  })

  it('shows error when request failed and no prior data', () => {
    const state = useQueryViewState({
      loading: false,
      hasData: false,
      isEmpty: false,
      hasError: true,
      isPartial: false,
    })

    expect(state).toEqual({
      showInitialLoading: false,
      showError: true,
      showEmpty: false,
      showPartial: false,
    })
  })

  it('shows empty state when request completes with no rows', () => {
    const state = useQueryViewState({
      loading: false,
      hasData: true,
      isEmpty: true,
      hasError: false,
      isPartial: false,
    })

    expect(state).toEqual({
      showInitialLoading: false,
      showError: false,
      showEmpty: true,
      showPartial: false,
    })
  })

  it('shows partial state when data is partial without loading/error', () => {
    const state = useQueryViewState({
      loading: false,
      hasData: true,
      isEmpty: false,
      hasError: false,
      isPartial: true,
    })

    expect(state).toEqual({
      showInitialLoading: false,
      showError: false,
      showEmpty: false,
      showPartial: true,
    })
  })
})
