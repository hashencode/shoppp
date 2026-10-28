import type { CreatePrivacyRequest, PrivacyRequest } from '@shoppp/contracts'
import { Button, Card, Form, Input, Modal, Select, Table, Tag, App } from 'antd'
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
import {
  buildListToolbarColumnSettingOptions,
  ListToolbarActions,
} from '../../shared/components/list-toolbar-actions'
import { useListViewPreferences } from '../../shared/hooks/use-list-view-preferences'
import { STANDARD_LIST_TABLE_CLASS_NAME, TemplateListContent } from '../../shared/template-kit/list'

void React

type FormValues = Omit<CreatePrivacyRequest, 'confirm' | 'correction'> & {
  correctionField?: 'email' | 'shipping_address'
  requestedValue?: string
}

const COLUMN_KEYS = ['created', 'reference', 'type', 'decision', 'status', 'expires', 'actions']

export const PrivacyPage = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [items, setItems] = useState<PrivacyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const view = useListViewPreferences({
    tableId: 'privacy-requests-list',
    defaultColumnKeys: COLUMN_KEYS,
    defaultDensity: 'middle',
  })
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const privacyDialog = useFormDialog({ open, form, onClose: () => setOpen(false) })
  const type = Form.useWatch('type', form)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setItems(await fetchPrivacyRequests())
    } catch (error) {
      setLoadError(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [localizeError])

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

  const orderedColumns = view.columnOrder.flatMap((key) =>
    columns.filter((column) => column.key === key)
  )
  const visibleColumns = orderedColumns.filter((column) =>
    view.selectedColumnKeys.includes(column.key)
  )

  return (
    <CustomPageRecipe title={t('Privacy requests')}>
      <Card variant="borderless" styles={{ body: { padding: 16 } }}>
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button
            type="primary"
            onClick={() => {
              form.resetFields()
              setOpen(true)
            }}
          >
            {t('Record verified request')}
          </Button>
          <ListToolbarActions
            tableSize={view.tableSize}
            onTableSizeChange={view.setTableSize}
            onClearColumnSort={view.clearColumnOrder}
            clearColumnSortDisabled={!view.hasCustomColumnOrder}
            reloadLoading={loading}
            onReload={() => void load()}
            columnSettingOptions={buildListToolbarColumnSettingOptions(orderedColumns)}
            selectedColumnKeys={view.selectedColumnKeys}
            onSelectedColumnKeysChange={view.setSelectedColumnKeys}
            onColumnSettingOrderChange={view.setColumnOrder}
          />
        </div>
        <TemplateListContent
          showInitialLoading={loading && items.length === 0}
          showError={!loading && Boolean(loadError) && items.length === 0}
          showPartial={Boolean(loadError) && items.length > 0}
          showEmpty={!loading && !loadError && items.length === 0}
          errorMessage={loadError ?? undefined}
          partialMessage={loadError ?? undefined}
          onRetry={() => void load()}
          onReloadPartial={() => void load()}
          onResetEmpty={() => void load()}
          copy={{
            loadingTitle: t('Loading privacy requests'),
            errorTitle: t('List could not be loaded'),
            partialTitle: t('Refresh failed. Showing previously loaded data.'),
            emptyDescription: t('No privacy requests recorded.'),
            emptyActionLabel: t('Reload'),
          }}
          tableNode={
            <Table<PrivacyRequest>
              className={STANDARD_LIST_TABLE_CLASS_NAME}
              rowKey="id"
              columns={visibleColumns}
              dataSource={items}
              loading={loading}
              size={view.tableSize}
              pagination={false}
              scroll={{ x: 1200 }}
            />
          }
        />
      </Card>
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
