import { ExportOutlined, ImportOutlined, InboxOutlined } from '@ant-design/icons'
import { Button, Modal, Upload } from 'antd'
import type { ButtonProps, ModalProps, UploadProps } from 'antd'
import React, { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

void React

type ExcelActionClick = () => void | Promise<void>

type ListExcelButtonAction = {
  label: ReactNode
  loading?: boolean
  disabled?: boolean
  onClick: ExcelActionClick
  buttonProps?: Omit<ButtonProps, 'children' | 'disabled' | 'icon' | 'loading' | 'onClick'>
}

type ListExcelTemplateAction = {
  label?: ReactNode
  loading?: boolean
  disabled?: boolean
  href?: string
  download?: ButtonProps['download']
  target?: string
  rel?: string
  onClick?: ExcelActionClick
}

type ListExcelImportAction = {
  label?: ReactNode
  modalTitle?: ReactNode
  uploading?: boolean
  disabled?: boolean
  uploadProps: UploadProps | ((helpers: { close: () => void }) => UploadProps)
  uploadText?: ReactNode
  uploadHint?: ReactNode
  uploadIcon?: ReactNode
  buttonProps?: Omit<ButtonProps, 'children' | 'disabled' | 'icon' | 'onClick'>
  modalProps?: Omit<ModalProps, 'children' | 'footer' | 'onCancel' | 'open' | 'title'>
}

type ListExcelActionsProps = {
  exportAction?: ListExcelButtonAction
  importAction?: ListExcelImportAction
  templateAction?: ListExcelTemplateAction
}

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  Boolean(value) && typeof (value as Promise<unknown>).then === 'function'

const runAction = (
  action: ExcelActionClick | undefined,
  setPending: (pending: boolean) => void,
  pendingRef: React.MutableRefObject<boolean>
) => {
  if (!action || pendingRef.current) return

  pendingRef.current = true
  let result: void | Promise<void>
  try {
    result = action()
  } catch (error) {
    pendingRef.current = false
    throw error
  }

  if (!isPromiseLike(result)) {
    pendingRef.current = false
    return
  }

  setPending(true)
  const clearPending = () => {
    pendingRef.current = false
    setPending(false)
  }
  void result.then(clearPending, clearPending)
}

export const ListExcelActions = ({
  exportAction,
  importAction,
  templateAction,
}: ListExcelActionsProps) => {
  const [importOpen, setImportOpen] = useState(false)
  const [exportPending, setExportPending] = useState(false)
  const [templatePending, setTemplatePending] = useState(false)
  const exportPendingRef = useRef(false)
  const templatePendingRef = useRef(false)

  const closeImportModal = useCallback(() => {
    setImportOpen(false)
  }, [])

  const resolvedUploadProps = useMemo(() => {
    if (!importAction) {
      return undefined
    }

    const uploadProps = typeof importAction.uploadProps === 'function'
      ? importAction.uploadProps({ close: closeImportModal })
      : importAction.uploadProps

    return {
      ...uploadProps,
      disabled: importAction.uploading || uploadProps.disabled,
    }
  }, [closeImportModal, importAction])

  return (
    <>
      {exportAction ? (
        <Button
          icon={<ExportOutlined aria-hidden />}
          loading={exportAction.loading ?? exportPending}
          disabled={exportAction.disabled}
          onClick={() => runAction(exportAction.onClick, setExportPending, exportPendingRef)}
          {...exportAction.buttonProps}
        >
          {exportAction.label}
        </Button>
      ) : null}
      {importAction ? (
        <>
          <Button
            icon={<ImportOutlined aria-hidden />}
            disabled={importAction.disabled}
            onClick={() => setImportOpen(true)}
            {...importAction.buttonProps}
          >
            {importAction.label ?? '数据导入'}
          </Button>
          {templateAction ? (
            <Button
              type="link"
              loading={templateAction.loading ?? templatePending}
              disabled={templateAction.disabled}
              href={templateAction.href}
              download={templateAction.download}
              target={templateAction.target}
              rel={templateAction.rel}
              onClick={() => runAction(templateAction.onClick, setTemplatePending, templatePendingRef)}
            >
              {templateAction.label ?? '下载导入模板'}
            </Button>
          ) : null}
          <Modal
            {...importAction.modalProps}
            open={importOpen}
            title={importAction.modalTitle ?? importAction.label ?? '数据导入'}
            footer={null}
            destroyOnHidden={importAction.modalProps?.destroyOnHidden ?? true}
            onCancel={closeImportModal}
          >
            {resolvedUploadProps ? (
              <Upload.Dragger {...resolvedUploadProps}>
                <p className="ant-upload-drag-icon">
                  {importAction.uploadIcon ?? <InboxOutlined />}
                </p>
                <p className="ant-upload-text">{importAction.uploadText ?? '点击或拖拽文件至此区域'}</p>
                {importAction.uploadHint ? (
                  <p className="ant-upload-hint">{importAction.uploadHint}</p>
                ) : null}
              </Upload.Dragger>
            ) : null}
          </Modal>
        </>
      ) : null}
    </>
  )
}
