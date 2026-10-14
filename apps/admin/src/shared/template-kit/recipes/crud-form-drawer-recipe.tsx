import { Alert, App, Button, Drawer, Form } from 'antd'
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { FormSubmitActions } from '../../components/form-submit-toolbar'
import { QueryStateBlock } from '../../components/query-state-block'
import type { CrudFormDrawerSpec } from '../specs/crud-form-drawer-spec'
import { isFormValidationError, FORM_ERROR_SCROLL_OPTIONS } from '../form/form-validation-scroll'
import { useCurrentTranslate, useI18n } from '../../contexts/i18n-context'
import { localizeApiError } from '../../i18n/api-error'
import { normalizeApiError, type ApiError } from '../../../infrastructure/http/api-client'

void React

export const CrudFormDrawerRecipe = <TValues extends object>({
  spec,
}: {
  spec: CrudFormDrawerSpec<TValues>
}) => {
  const formName = useId()
  const { modal } = App.useApp()
  const { t } = useI18n()
  const currentTranslate = useCurrentTranslate()
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const submitLock = useRef(false)
  const alive = useRef(true)
  const exiting = useRef(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const discardModal = useRef<ReturnType<typeof modal.confirm> | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      discardModal.current?.destroy()
    }
  }, [])
  useEffect(() => {
    discardModal.current?.update({
      title: t('Unsaved changes'),
      content: t('Closing will discard these changes.'),
      okText: t('Discard changes and close'),
      cancelText: t('Continue editing'),
    })
  }, [t])
  const busy = !open || submitting || spec.saveLoading || spec.actionBusy
  const ready =
    spec.parsedMode.ok && !spec.permissionDenied && !spec.detailLoading && !spec.detailError
  const showActions =
    !spec.isReadonly &&
    spec.parsedMode.ok &&
    spec.parsedMode.mode !== 'readonly' &&
    spec.modeView?.showActions !== false
  // 遮罩的 motion 内容可能保留早期回调；所有入口均读取当前表单与请求状态。
  const closeState = useRef({ spec, busy, ready })
  useLayoutEffect(() => {
    closeState.current = { spec, busy, ready }
  }, [spec, busy, ready])

  const exit = () => {
    exiting.current = true
    setOpen(false)
  }

  const complete = () => {
    if (!alive.current || exiting.current) return
    exit()
    // 附加业务动作自己承接原反馈，只共用退出动画与当前上下文刷新。
    // 父内容持有读取错误与重试；刷新失败不能重新归类为写入失败。
    try {
      void closeState.current.spec.onSaved().catch(() => undefined)
    } catch {
      // 同步读取异常同样由父内容反馈，不触发第二次写入或普通保存失败。
    }
  }

  const requestClose = () => {
    const current = closeState.current
    if (
      exiting.current ||
      submitLock.current ||
      current.busy ||
      current.spec.nestedModalOpen ||
      discardModal.current
    )
      return
    if (!current.ready || current.spec.isReadonly || !current.spec.hasUnsavedChanges()) {
      exit()
      return
    }
    setDiscardOpen(true)
    discardModal.current = modal.confirm({
      title: currentTranslate('Unsaved changes'),
      content: currentTranslate('Closing will discard these changes.'),
      okText: currentTranslate('Discard changes and close'),
      cancelText: currentTranslate('Continue editing'),
      onOk: exit,
      afterClose: () => {
        setDiscardOpen(false)
        discardModal.current = null
      },
    })
  }

  const submit = async (values: TValues) => {
    if (!alive.current || exiting.current || !ready || !showActions || busy || submitLock.current)
      return
    submitLock.current = true
    setSubmitting(true)
    setSubmitError(null)
    let result: Awaited<ReturnType<typeof spec.onSubmit>>
    try {
      result = await spec.onSubmit(values)
    } catch (error) {
      if (isFormValidationError(error)) return
      result = {
        success: false,
        error: normalizeApiError(error),
      }
    } finally {
      submitLock.current = false
      if (alive.current) setSubmitting(false)
    }
    if (!alive.current || exiting.current) return
    if (!result.success) {
      setSubmitError(result.error)
      return
    }
    complete()
    modal.success({ title: closeState.current.spec.successTitle, okText: currentTranslate('Confirm') })
  }

  let state: React.ReactNode = null
  if (!spec.parsedMode.ok) {
    state = (
      <QueryStateBlock state="error" title={t('Invalid form parameters')} description={t(spec.parsedMode.message)} />
    )
  } else if (spec.permissionDenied) {
    state = <QueryStateBlock state="error" title={t('You do not have permission to access this form.')} />
  } else if (spec.detailLoading) {
    state = <QueryStateBlock state="loading" title={t('Loading form details…')} />
  } else if (spec.detailError) {
    const notFound = spec.detailError.code === 'RESOURCE_NOT_FOUND' || spec.detailError.status === 404
    state = (
      <QueryStateBlock
        state={notFound ? 'empty' : 'error'}
        title={t(notFound ? 'Record not found or deleted' : 'Form details could not be loaded')}
        description={notFound ? t('Close and select another record.') : localizeApiError(spec.detailError, t)}
        primaryActionLabel={notFound ? undefined : t('Retry')}
        onPrimaryAction={notFound ? undefined : spec.onRetryDetail}
      />
    )
  }

  const closeAction = (
    <Button disabled={busy || spec.nestedModalOpen} onClick={requestClose}>
      {t('Close')}
    </Button>
  )
  return (
    <Drawer
      open={open}
      title={spec.title}
      size={720}
      afterOpenChange={(visible) => {
        if (!visible) spec.onClose()
      }}
      keyboard={busy || spec.nestedModalOpen ? false : undefined}
      mask={busy || spec.nestedModalOpen ? { closable: false } : undefined}
      // 确认弹窗开启时由 Modal 约束焦点，避免两个浮层互相抢焦点。
      focusable={discardOpen || spec.nestedModalOpen ? { trap: false } : undefined}
      onClose={requestClose}
      footer={
        ready && showActions ? (
          <FormSubmitActions
            submitLoading={busy}
            submitDisabled={busy}
            resetDisabled={busy}
            onSubmit={() => spec.form.submit()}
            onReset={() => {
              if (submitLock.current || busy) return
              spec.onResetAll()
              setSubmitError(null)
            }}
          />
        ) : (
          <div className="flex justify-end">{closeAction}</div>
        )
      }
    >
      {state ?? (
        <>
          {submitError ? (
            <Alert
              type="error"
              showIcon
              title={t('Save failed')}
              description={localizeApiError(submitError, t)}
              className="mb-4"
            />
          ) : null}
          <Form<TValues>
            name={formName}
            form={spec.form}
            layout="vertical"
            initialValues={spec.initialValues}
            autoComplete={spec.autoComplete}
            disabled={spec.isReadonly || busy}
            onFinish={submit}
            scrollToFirstError={FORM_ERROR_SCROLL_OPTIONS}
          >
            {spec.sections?.length
              ? spec.sections.map((section) => (
                  <section key={section.key} className="mb-6">
                    <h3 className="mb-4 text-base font-medium">{section.title}</h3>
                    {section.renderFields()}
                  </section>
                ))
              : spec.renderFields?.()}
          </Form>
          {typeof spec.renderAfterForm === 'function'
            ? // eslint-disable-next-line react-hooks/refs -- 业务 slot 仅将 complete 绑定到动作事件，不在 render 中执行。
              spec.renderAfterForm({ complete })
            : spec.renderAfterForm}
        </>
      )}
    </Drawer>
  )
}
