import React from 'react'
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { QueryStateBlock } from '../../components/query-state-block'
import type { ApiError } from '../../../infrastructure/http/api-client'
import type { ParsedFormMode, FormModeViewModel } from '../../../routes/form-route-contract'

void React

type TemplateFormStateGateProps = {
  parsedMode: ParsedFormMode
  modeView: FormModeViewModel | null
  permissionDenied: boolean
  detailLoading: boolean
  detailError: ApiError | null
  onBackToList: () => void
  onRetryDetail: () => void
  children: ReactNode
}

export const TemplateFormStateGate = ({
  parsedMode,
  modeView,
  permissionDenied,
  detailLoading,
  detailError,
  onBackToList,
  onRetryDetail,
  children,
}: TemplateFormStateGateProps) => {
  if (!parsedMode.ok) {
    return (
      <QueryStateBlock
        state="error"
        title="路由参数错误"
        description={parsedMode.message}
        primaryActionLabel="返回列表"
        onPrimaryAction={onBackToList}
      />
    )
  }

  if (permissionDenied) {
    return <Navigate to="/template/exception/403" replace state={{ from: '/template/list/table/form' }} />
  }

  if (modeView?.canFetch && detailLoading) {
    return <QueryStateBlock state="loading" title="正在加载表单详情..." />
  }

  if (modeView?.canFetch && detailError) {
    const notFound = detailError.code === 'RESOURCE_NOT_FOUND' || detailError.status === 404

    return (
      <QueryStateBlock
        state={notFound ? 'empty' : 'error'}
        title={notFound ? '记录不存在或已删除' : '表单详情加载失败'}
        description={
          notFound ? '请返回列表重新选择记录。' : detailError.message || '请检查网络连接后重试。'
        }
        primaryActionLabel="返回列表"
        onPrimaryAction={onBackToList}
        secondaryActionLabel={notFound ? undefined : '重试'}
        onSecondaryAction={notFound ? undefined : onRetryDetail}
      />
    )
  }

  return <>{children}</>
}
