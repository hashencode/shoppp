import { localizeThemeError } from '../theme-feedback'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, App, Button, Form, Input, Modal, Select, Space } from 'antd'
import {
  applyStorefrontDraftLibraryAction,
  type StorefrontExperienceDraft,
} from '../../../services/storefront/api'
import { useI18n } from '../../../shared/contexts/i18n-context'
import { useFormDialog } from '../../../shared/hooks/use-form-dialog'

void React
type Values = { name: string; source: 'saved' | 'save-first' }
type Props = {
  draft: StorefrontExperienceDraft
  disabled?: boolean
  dirty?: boolean
  onUpdated: (kind: 'rename' | 'copy' | 'remove') => void | Promise<void>
  onCopy?: (draft: StorefrontExperienceDraft) => void
  saveFirst?: () => Promise<StorefrontExperienceDraft | undefined>
}

export const DraftLibraryActions = ({
  draft,
  disabled,
  dirty,
  onUpdated,
  onCopy,
  saveFirst,
}: Props) => {
  const { t } = useI18n(),
    { modal, message } = App.useApp()
  const [target, setTarget] = useState<{
    draft: StorefrontExperienceDraft
    kind: 'rename' | 'copy'
  } | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [stale, setStale] = useState(false)
  const [copyResult, setCopyResult] = useState<StorefrontExperienceDraft | null>(null)
  const [form] = Form.useForm<Values>()
  const dialog = useFormDialog({ open: target !== null, form, onClose: () => setTarget(null) })
  const open = (kind: 'rename' | 'copy') => {
    setTarget({ draft, kind })
    setFailure(null)
    setStale(false)
    form.setFieldsValue({
      name:
        kind === 'copy'
          ? `${draft.name ?? draft.experienceId} ${t('Copy')}`
          : (draft.name ?? draft.experienceId),
      source: 'saved',
    })
  }
  return (
    <>
      <Space wrap>
        <Button size="small" disabled={disabled || dialog.busy} onClick={() => open('rename')}>
          {t('Rename')}
        </Button>
        <Button size="small" disabled={disabled || dialog.busy} onClick={() => open('copy')}>
          {t('Duplicate')}
        </Button>
        <Button
          size="small"
          danger
          disabled={disabled || dialog.busy}
          onClick={() =>
            modal.confirm({
              title: t('Remove this draft?'),
              content: `${draft.name ?? draft.experienceId}. ${t('Published versions and immutable history are retained.')} ${dirty ? t('Unsaved changes will be discarded.') : ''}`,
              okButtonProps: { danger: true },
              onOk: async () => {
                try {
                  await applyStorefrontDraftLibraryAction(draft.id, {
                    kind: 'remove',
                    expectedVersion: draft.version,
                    confirm: true,
                  })
                  void message.success(t('Draft removed'))
                  await onUpdated('remove')
                } catch (cause) {
                  void message.error(localizeThemeError(cause, t))
                  throw cause
                }
              },
            })
          }
        >
          {t('Remove')}
        </Button>
        {copyResult ? (
          <Link to={`/storefront/themes/${copyResult.id}`} target="_blank" rel="noopener">
            {t('Open copied draft')}
          </Link>
        ) : null}
      </Space>
      <Modal
        title={t(target?.kind === 'rename' ? 'Rename draft' : 'Duplicate saved draft')}
        open={target !== null}
        confirmLoading={dialog.busy}
        onCancel={dialog.requestClose}
        onOk={() => form.submit()}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !dialog.busy }}
        keyboard={!dialog.busy}
        destroyOnHidden
        okButtonProps={{ disabled: stale }}
      >
        {failure ? (
          <Alert
            type="error"
            title={t('The draft could not be changed.')}
            description={localizeThemeError(failure, t)}
            className="mb-4"
          />
        ) : null}
        <Form<Values>
          form={form}
          layout="vertical"
          disabled={dialog.busy}
          onFinish={() =>
            void dialog.submit(async (values) => {
              if (!target || stale) return
              try {
                const source =
                  target.kind === 'copy' && dirty && values.source === 'save-first'
                    ? await saveFirst?.()
                    : target.draft
                if (!source || !dialog.isCurrent()) return
                const result = await applyStorefrontDraftLibraryAction(source.id, {
                  kind: target.kind,
                  expectedVersion: source.version,
                  name: values.name.trim(),
                })
                if (!dialog.isCurrent()) return
                dialog.complete()
                void message.success(t(target.kind === 'copy' ? 'Draft copied' : 'Draft renamed'))
                await onUpdated(target.kind)
                if (target.kind === 'copy' && 'version' in result) {
                  setCopyResult(result)
                  onCopy?.(result)
                }
              } catch (cause) {
                if (!dialog.isCurrent()) return
                setFailure(cause)
                if (typeof cause === 'object' && cause && 'status' in cause && cause.status === 409)
                  setStale(true)
              }
            })
          }
        >
          <Form.Item
            name="name"
            label={t('Draft name')}
            rules={[{ required: true, whitespace: true, max: 120 }]}
          >
            <Input aria-label={t('Draft name')} maxLength={120} />
          </Form.Item>
          {target?.kind === 'copy' && dirty ? (
            <Form.Item name="source" label={t('Copy source')}>
              <Select
                options={[
                  { label: t('Copy the saved version'), value: 'saved' },
                  {
                    label: t('Save changes, then copy'),
                    value: 'save-first',
                    disabled: !saveFirst,
                  },
                ]}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </>
  )
}
