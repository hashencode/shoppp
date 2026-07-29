import { message } from 'antd'
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

type UseBatchStatusActionOptions<TEntity extends { id: number; name: string }, TStatus, TError extends { message: string }> = {
  entityLabel: string
  statusValue: TStatus
  emptySelectionMessage: string
  updateStatus: (id: number, status: TStatus) => Promise<TEntity>
  reload: () => Promise<void>
  mapError: (error: unknown) => TError
}

export const useBatchStatusAction = <
  TEntity extends { id: number; name: string },
  TStatus,
  TError extends { message: string },
>({
  entityLabel,
  statusValue,
  emptySelectionMessage,
  updateStatus,
  reload,
  mapError,
}: UseBatchStatusActionOptions<TEntity, TStatus, TError>) => {
  const handleSingleStatusAction = useCallback(
    async (
      entity: TEntity,
      setSelectedRows?: Dispatch<SetStateAction<TEntity[]>>
    ) => {
      try {
        await updateStatus(entity.id, statusValue)
        message.success(`已删除${entityLabel}：${entity.name}`)
        setSelectedRows?.((rows) => rows.filter((item) => item.id !== entity.id))
        await reload()
      } catch (requestError) {
        const apiError = mapError(requestError)
        message.error(apiError.message)
      }
    },
    [entityLabel, mapError, reload, statusValue, updateStatus]
  )

  const handleBatchStatusAction = useCallback(
    async (
      selectedRows: TEntity[],
      setSelectedRows: Dispatch<SetStateAction<TEntity[]>>
    ) => {
      if (selectedRows.length === 0) {
        message.info(emptySelectionMessage)
        return
      }

      try {
        await Promise.all(selectedRows.map((entity) => updateStatus(entity.id, statusValue)))
        setSelectedRows([])
        message.success(`已批量删除 ${selectedRows.length} 个${entityLabel}`)
        await reload()
      } catch (requestError) {
        const apiError = mapError(requestError)
        message.error(apiError.message)
      }
    },
    [emptySelectionMessage, entityLabel, mapError, reload, statusValue, updateStatus]
  )

  return {
    handleSingleStatusAction,
    handleBatchStatusAction,
  }
}
