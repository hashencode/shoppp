import { App, type FormInstance } from 'antd'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useCurrentTranslate, useI18n } from '../contexts/i18n-context'
import { isFormValidationError } from '../template-kit/form/form-validation-scroll'

// Empty optional fields have the same submission meaning before and after typing then clearing.
const snapshot = (value: unknown): string => {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize)
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)])
      )
    return item
  }
  return JSON.stringify(normalize(value))
}

/** Lifecycle only; each page owns its fields, payload, result and recovery. */
export const useFormDialog = <TValues extends object = Record<string, unknown>>({
  open,
  form,
  onClose,
  toSubmission = (values: TValues) => values,
  getSubmission,
}: {
  open: boolean
  form?: FormInstance<TValues>
  onClose: () => void
  toSubmission?: (values: TValues) => unknown
  getSubmission?: () => unknown
}) => {
  const { modal } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const instance = useMemo(() => ({ open }), [open])
  const current = useRef({ open, instance, onClose, toSubmission, getSubmission })
  const baseline = useRef('')
  const lock = useRef(false)
  const alive = useRef(true)
  const confirmation = useRef<ReturnType<typeof modal.confirm> | null>(null)
  const [busy, setBusy] = useState(false)
  useLayoutEffect(() => {
    current.current = { open, instance, onClose, toSubmission, getSubmission }
  }, [open, instance, onClose, toSubmission, getSubmission])
  useLayoutEffect(() => {
    if (open)
      baseline.current = snapshot(
        current.current.getSubmission?.() ??
          current.current.toSubmission(form?.getFieldsValue(true) ?? ({} as TValues))
      )
  }, [form, instance, open])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      confirmation.current?.destroy()
    }
  }, [])
  useEffect(() => {
    confirmation.current?.update({
      title: t('Unsaved changes'),
      content: t('Closing will discard these changes.'),
      okText: t('Discard changes and close'),
      cancelText: t('Continue editing'),
    })
  }, [t])
  const isCurrent = () =>
    alive.current && current.current.open && current.current.instance === instance
  const complete = () => {
    if (!isCurrent()) return
    current.current.open = false
    current.current.onClose()
  }
  const requestClose = () => {
    if (!isCurrent() || lock.current || confirmation.current) return
    if (
      snapshot(
        current.current.getSubmission?.() ??
          current.current.toSubmission(form?.getFieldsValue(true) ?? ({} as TValues))
      ) === baseline.current
    ) {
      complete()
      return
    }
    confirmation.current = modal.confirm({
      title: translateNow('Unsaved changes'),
      content: translateNow('Closing will discard these changes.'),
      okText: translateNow('Discard changes and close'),
      cancelText: translateNow('Continue editing'),
      onOk: complete,
      afterClose: () => {
        confirmation.current = null
      },
    })
  }
  const submit = async (action: (values: TValues) => Promise<void>) => {
    if (!isCurrent() || lock.current || confirmation.current) return
    lock.current = true
    setBusy(true)
    try {
      const values = form ? await form.validateFields() : ({} as TValues)
      if (!isCurrent()) return
      await action(values)
    } catch (error) {
      if (!isFormValidationError(error)) throw error
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  return { busy, complete, isCurrent, requestClose, submit }
}
