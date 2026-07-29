import type { ModalFuncProps } from 'antd'
import type { ReactNode } from 'react'

type CreateFormSaveSuccessModalConfigOptions = {
  content: ReactNode
  onConfirm: NonNullable<ModalFuncProps['onOk']>
}

export const createFormSaveSuccessModalConfig = ({
  content,
  onConfirm,
}: CreateFormSaveSuccessModalConfigOptions): ModalFuncProps => ({
  title: '提示',
  content,
  closable: true,
  okText: '确定',
  onOk: onConfirm,
})
