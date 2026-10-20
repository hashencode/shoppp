import type { CreatePrivacyRequest, PrivacyRequest } from '@shoppp/contracts'
import { Button, Form, Input, Modal, Select, Space, Table, Tag, App } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  createPrivacyRequest,
  downloadPrivacyExport,
  fetchPrivacyRequests,
} from '../../services/platform/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'

import { useFormDialog } from '../../shared/hooks/use-form-dialog'

void React

type FormValues = Omit<CreatePrivacyRequest, 'confirm' | 'correction'> & {
  correctionField?: 'email' | 'shipping_address'
  requestedValue?: string
}

export const PrivacyPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [items, setItems] = useState<PrivacyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const privacyDialog = useFormDialog({ open, form, onClose: () => setOpen(false) })
  const type = Form.useWatch('type', form)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchPrivacyRequests())
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [message, localizeError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      {
        key: 'created',
        title: t('Completed'),
        dataIndex: 'completedAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        key: 'reference',
        title: t('Subject reference'),
        dataIndex: 'subjectReference',
        width: 170,
      },
      {
        key: 'type',
        title: t('Request type'),
        dataIndex: 'type',
        width: 130,
        render: (value: string) => t(value),
      },
      {
        key: 'decision',
        title: t('Decision'),
        dataIndex: 'decision',
        width: 300,
        render: (value: string) => t(value),
      },
      {
        key: 'status',
        title: t('Status'),
        dataIndex: 'status',
        width: 120,
        render: (value: string) => <Tag color="success">{t(value)}</Tag>,
      },
      {
        key: 'expires',
        title: t('Export expiry'),
        dataIndex: 'expiresAt',
        width: 180,
        render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, item: PrivacyRequest) =>
          item.decision === 'export_created' ? (
            <Button type="link" onClick={() => void downloadPrivacyExport(item)}>
              {t('Download')}
            </Button>
          ) : null,
      },
    ],
    [t]
  )

  return (
    <CustomPageRecipe title={t('Privacy requests')}>
      <div className="flex flex-wrap items-center gap-3">
        <Space>
          <Button
            type="primary"
            onClick={() => {
              form.resetFields()
              setOpen(true)
            }}
          >
            {t('Record verified request')}
          </Button>
          <Button onClick={() => void load()}>{t('Refresh')}</Button>
        </Space>
      </div>
      <Table<PrivacyRequest>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <Modal
        title={t('Record verified privacy request')}
        open={open}
        okText={t('Confirm and execute')}
        confirmLoading={privacyDialog.busy}
        onCancel={privacyDialog.requestClose}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !privacyDialog.busy }}
        keyboard={!privacyDialog.busy}
        onOk={() => form.submit()}
      >
        <p className="mb-4 text-slate-500">
          {t("Before proceeding, confirm that the requester's identity has been verified.")}
        </p>
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={() =>
            void privacyDialog.submit(async (values) => {

              try {
                await createPrivacyRequest({
                  confirm: true,
                  email: values.email,
                  reason: values.reason,
                  type: values.type,
                  ...(values.type === 'correction'
                    ? {
                        correction: {
                          field: values.correctionField!,
                          requestedValue: values.requestedValue!,
                        },
                      }
                    : {}),
                })
                if (!privacyDialog.isCurrent()) return
                privacyDialog.complete()
                void load().catch(() => undefined)
                void message.success(translateNow('Privacy request completed and audited.'))
              } catch (error) {
                void message.error(localizeError(error))
              }
            })
          }
          disabled={privacyDialog.busy}
        >
          <Form.Item
            name="email"
            label={t('Verified subject email')}
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="type" label={t('Request type')} rules={[{ required: true }]}>
            <Select
              options={['access', 'correction', 'deletion'].map((value) => ({
                label: t(value),
                value,
              }))}
            />
          </Form.Item>
          {type === 'correction' ? (
            <>
              <Form.Item
                name="correctionField"
                label={t('Correction field')}
                rules={[{ required: true }]}
              >
                <Select
                  options={['email', 'shipping_address'].map((value) => ({
                    label: t(value),
                    value,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="requestedValue"
                label={t('Requested value')}
                rules={[{ required: true, max: 500 }]}
              >
                <Input.TextArea rows={3} maxLength={500} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="reason"
            label={t('Verification and action reason')}
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </CustomPageRecipe>
  )
}
