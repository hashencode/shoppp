import React from 'react'
import type { ReactNode } from 'react'
import { QueryStateBlock } from '../../components/query-state-block'

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
  const mergedCopy = {
    loadingTitle: '正在加载规则列表...',
    errorTitle: '规则列表加载失败',
    errorDescription: '请检查网络连接或稍后重试。',
    errorActionLabel: '重试',
    partialTitle: '当前仅返回部分数据',
    partialDescription: '请检查网络后重试。',
    partialActionLabel: '重新加载',
    emptyTitle: '当前筛选条件下没有数据',
    emptyDescription: '尝试重置筛选条件后重新查询。',
    emptyActionLabel: '重置筛选',
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
