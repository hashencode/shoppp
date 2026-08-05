import React from 'react'
import type { ReactNode } from 'react'
import { QueryStateBlock } from '../../components/query-state-block'
import { useI18n } from '../../contexts/i18n-context'

void React

type TemplateListContentProps = {
  showInitialLoading: boolean
  showError: boolean
  showPartial: boolean
  showEmpty: boolean
  errorMessage?: string
  partialMessage?: string
  onRetry: () => void
  onReloadPartial: () => void
  onResetEmpty: () => void
  tableNode: ReactNode
  copy?: Partial<{
    loadingTitle: string
    errorTitle: string
    errorDescription: string
    errorActionLabel: string
    partialTitle: string
    partialDescription: string
    partialActionLabel: string
    emptyTitle: string
    emptyDescription: string
    emptyActionLabel: string
  }>
}

export const TemplateListContent = ({
  showInitialLoading,
  showError,
  showPartial,
  showEmpty,
  errorMessage,
  partialMessage,
  onRetry,
  onReloadPartial,
  onResetEmpty,
  tableNode,
  copy,
}: TemplateListContentProps) => {
  const { t } = useI18n()
  const mergedCopy = {
    loadingTitle: t('Loading rules…'),
    errorTitle: t('Rules could not be loaded'),
    errorDescription: t('Check your network connection or try again later.'),
    errorActionLabel: t('Retry'),
    partialTitle: t('Only partial data is available'),
    partialDescription: t('Check your network connection and try again.'),
    partialActionLabel: t('Reload'),
    emptyTitle: t('No data matches the current filters'),
    emptyDescription: t('Reset the filters and search again.'),
    emptyActionLabel: t('Reset filters'),
    ...copy,
  }

  if (showInitialLoading) {
    return <QueryStateBlock state="loading" title={mergedCopy.loadingTitle} />
  }

  if (showError) {
    return (
      <QueryStateBlock
        state="error"
        title={mergedCopy.errorTitle}
        description={errorMessage || mergedCopy.errorDescription}
        primaryActionLabel={mergedCopy.errorActionLabel}
        primaryActionButtonType="default"
        onPrimaryAction={onRetry}
      />
    )
  }

  if (showPartial) {
    return (
      <QueryStateBlock
        state="partial"
        title={mergedCopy.partialTitle}
        description={partialMessage ?? mergedCopy.partialDescription}
        primaryActionLabel={mergedCopy.partialActionLabel}
        onPrimaryAction={onReloadPartial}
      >
        {tableNode}
      </QueryStateBlock>
    )
  }

  if (showEmpty) {
    return (
      <QueryStateBlock
        state="empty"
        title={mergedCopy.emptyTitle}
        description={mergedCopy.emptyDescription}
        primaryActionLabel={mergedCopy.emptyActionLabel}
        primaryActionButtonType="default"
        onPrimaryAction={onResetEmpty}
      />
    )
  }

  return <>{tableNode}</>
}
