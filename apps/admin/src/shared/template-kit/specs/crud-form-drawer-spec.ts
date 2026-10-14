import type { BasicCrudFormSpec } from './basic-crud-form-spec'
import type { ReactNode } from 'react'
import type { ApiError } from '../../../infrastructure/http/api-client'

export type CrudFormDrawerSpec<TValues extends object> = Pick<
  BasicCrudFormSpec<TValues>,
  | 'parsedMode'
  | 'permissionDenied'
  | 'detailLoading'
  | 'detailError'
  | 'saveLoading'
  | 'isReadonly'
  | 'form'
  | 'initialValues'
  | 'title'
  | 'onRetryDetail'
  | 'onResetAll'
  | 'renderFields'
  | 'sections'
  | 'autoComplete'
> & {
  modeView?: BasicCrudFormSpec<TValues>['modeView']
  successTitle: string
  actionBusy?: boolean
  nestedModalOpen?: boolean
  /** 函数 slot 仅构造业务动作，将 complete 绑定到事件，禁止在 render 中调用。 */
  renderAfterForm?: ReactNode | ((actions: { complete: () => void }) => ReactNode)
  /** 按业务提交值与初始值比较，包含改回原值和重置后的结果。 */
  hasUnsavedChanges: () => boolean
  /** 关闭动画结束后清理本次表单实例。 */
  onClose: () => void
  /** 父内容唯一刷新入口；调用方负责读取错误反馈和仅重读的恢复。 */
  onSaved: () => Promise<void>
  onSubmit: (
    values: TValues
  ) => Promise<{ success: true } | { success: false; error: ApiError }>
}
