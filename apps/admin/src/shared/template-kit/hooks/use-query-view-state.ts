type UseQueryViewStateOptions = {
  loading: boolean
  hasData: boolean
  isEmpty: boolean
  hasError: boolean
  isPartial: boolean
}

type QueryViewStateResult = {
  showInitialLoading: boolean
  showError: boolean
  showEmpty: boolean
  showPartial: boolean
}

export const useQueryViewState = ({
  loading,
  hasData,
  isEmpty,
  hasError,
  isPartial,
}: UseQueryViewStateOptions): QueryViewStateResult => {
  const showInitialLoading = loading && !hasData
  const showError = hasError && !hasData
  const showEmpty = !showInitialLoading && !showError && isEmpty
  const showPartial = !showInitialLoading && !showError && isPartial

  return {
    showInitialLoading,
    showError,
    showEmpty,
    showPartial,
  }
}
