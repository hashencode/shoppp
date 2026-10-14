import {
  notificationJobSchema,
  notificationJobStatusSchema,
  type NotificationJob,
  type NotificationJobStatus,
} from '@shoppp/contracts'
import { App, Button, Form, Input, Modal, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { hasPermission } from '../../../infrastructure/auth/permissions'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import {
  fetchNotificationJobs,
  replayNotification,
  type NotificationJobFilters,
} from '../../../services/operations/notifications-api'
import { useCurrentTranslate, useI18n } from '../../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../../shared/i18n/api-error'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../../shared/template-kit/list'

import { useFormDialog } from '../../../shared/hooks/use-form-dialog'

void React

const statusColors: Record<NotificationJobStatus, string> = {
  dead_letter: 'error',
  failed: 'warning',
  pending: 'processing',
  processing: 'blue',
  sent: 'success',
}

const notificationStatuses = notificationJobStatusSchema.options
const notificationTypes = notificationJobSchema.shape.type.options

type NotificationJobFilterValues = {
  query?: string
  status?: NotificationJobStatus
  type?: NotificationJob['type']
}

type NotificationJobListResponse = Awaited<ReturnType<typeof fetchNotificationJobs>>

const toFilters = (values: NotificationJobFilterValues): NotificationJobFilters => ({
  query: values.query?.trim() || undefined,
  status: values.status,
  type: values.type,
})

const buildNotificationJobRequestFilters: StandardListPageSpec<
  NotificationJobFilterValues,
  NotificationJobFilters,
  NotificationJobListResponse,
  NotificationJob,
  Error
>['buildRequestFilters'] = ({ filters, current, pageSize }) => ({
  ...filters,
  page: current,
  pageSize,
})

const ReloadBridge = ({
  reload,
  capture,
}: {
  reload: () => Promise<void>
  capture: (reload: () => Promise<void>) => void
}) => {
  useEffect(() => capture(reload), [capture, reload])
  return null
}

export const NotificationJobsPage = () => {
  const { message } = App.useApp()
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [replayJob, setReplayJob] = useState<NotificationJob | null>(null)
  const [form] = Form.useForm<{ reason: string }>()
  const replayDialog = useFormDialog({
    open: Boolean(replayJob),
    form,
    onClose: () => setReplayJob(null),
  })
  const reloadRef = useRef<() => Promise<void>>(async () => undefined)
  const canReplay = hasPermission(role, 'operations.replay', permissions)
  const captureReload = useCallback((reload: () => Promise<void>) => {
    reloadRef.current = reload
  }, [])

  const filterFields = useMemo<TemplateListFilterField<NotificationJobFilterValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: t('Job ID'),
        inputProps: {
          'aria-label': t('Search notification jobs'),
          placeholder: t('Order reference or job ID'),
          type: 'search',
        },
      },
      {
        type: 'select',
        name: 'status',
        label: t('Status'),
        options: notificationStatuses.map((value) => ({ label: t(value), value })),
        selectProps: {
          'aria-label': t('Filter notification status'),
          allowClear: true,
        },
      },
      {
        type: 'select',
        name: 'type',
        label: t('Job type'),
        options: notificationTypes.map((value) => ({ label: t(value), value })),
        selectProps: {
          'aria-label': t('Filter notification type'),
          allowClear: true,
        },
      },
    ],
    [t]
  )

  const spec = useMemo<
    StandardListPageSpec<
      NotificationJobFilterValues,
      NotificationJobFilters,
      NotificationJobListResponse,
      NotificationJob,
      Error
    >
  >(
    () => ({
      pageTitle: t('Automation recovery'),
      cardTitle: t('Automation recovery'),
      tableId: 'notification-jobs-list',
      initialFilters: {},
      toFilters,
      pagination: {
        defaultPageSize: 20,
        includeAllDataOption: false,
        maxPageSize: 100,
        pageSizeOptions: [20, 50, 100],
      },
      buildRequestFilters: buildNotificationJobRequestFilters,
      request: fetchNotificationJobs,
      selectItems: (response) => response?.data ?? [],
      mapError: (error) => new Error(localizeError(error)),
      filterFields,
      buildColumns: ({ resolveActionColumnWidth }) => [
        { key: 'id', title: t('Job ID'), dataIndex: 'id', width: 230 },
        { key: 'kind', title: t('Kind'), dataIndex: 'kind', width: 160 },
        {
          key: 'type',
          title: t('Job type'),
          dataIndex: 'type',
          width: 190,
          render: (value: string) => t(value),
        },
        {
          key: 'status',
          title: t('Status'),
          dataIndex: 'status',
          width: 130,
          render: (value: NotificationJobStatus) => (
            <Tag color={statusColors[value]}>{t(value)}</Tag>
          ),
        },
        {
          key: 'order',
          title: t('Order'),
          dataIndex: 'orderReference',
          width: 180,
          render: (value: string | null) => value ?? t('Checkout only'),
        },
        { key: 'recipient', title: t('Recipient'), dataIndex: 'recipient', width: 220 },
        {
          key: 'attempts',
          title: t('Attempts'),
          width: 120,
          render: (_: unknown, job) => `${job.attemptCount} / ${job.maxAttempts}`,
        },
        {
          key: 'error',
          title: t('Last error'),
          dataIndex: 'lastErrorCode',
          width: 220,
          render: (value: string | null) => value ?? '—',
        },
        {
          key: 'updated',
          title: t('Updated'),
          dataIndex: 'updatedAt',
          width: 180,
          render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        },
        {
          key: 'actions',
          title: t('Actions'),
          width: resolveActionColumnWidth(120),
          fixed: 'right' as const,
          render: (_: unknown, job) =>
            canReplay && job.status === 'dead_letter' ? (
              <Button
                type="link"
                className="!px-0"
                onClick={() => {
                  form.resetFields()
                  setReplayJob(job)
                }}
              >
                {t('Replay')}
              </Button>
            ) : null,
        },
      ],
      buildTableNode: ({
        columns,
        dataSource,
        loading,
        pagination,
        reload,
        tableClassName,
        tableSize,
        virtualScroll,
      }) => (
        <>
          <ReloadBridge reload={reload} capture={captureReload} />
          <Table<NotificationJob>
            className={tableClassName}
            rowKey="id"
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            size={tableSize}
            pagination={pagination}
            virtual={virtualScroll.enabled}
            scroll={virtualScroll.enabled ? virtualScroll.scroll : { x: 1730 }}
            expandable={{
              expandedRowRender: (job) => (
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={job.attempts}
                  locale={{ emptyText: t('No delivery attempt has run yet.') }}
                  scroll={{ x: 880 }}
                  columns={[
                    {
                      key: 'number',
                      title: t('Attempt'),
                      dataIndex: 'attemptNumber',
                      width: 100,
                    },
                    { key: 'result', title: t('Result'), dataIndex: 'result', width: 190 },
                    { key: 'error', title: t('Error code'), dataIndex: 'errorCode', width: 220 },
                    {
                      key: 'provider',
                      title: t('Provider message'),
                      dataIndex: 'providerMessageId',
                      width: 220,
                    },
                    {
                      key: 'completed',
                      title: t('Completed'),
                      dataIndex: 'completedAt',
                      width: 180,
                      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
                    },
                  ]}
                />
              ),
            }}
          />
        </>
      ),
      stateCopy: {
        errorTitle: t('List could not be loaded'),
        emptyTitle: t('No notification jobs match these filters.'),
        emptyDescription: t('Reset the filters and search again.'),
      },
    }),
    [canReplay, captureReload, filterFields, form, localizeError, t]
  )

  const submitReplay = async ({ reason }: { reason: string }) => {
    if (!replayJob || !canReplay) return

    try {
      await replayNotification(replayJob.id, { confirm: true, reason })
      if (!replayDialog.isCurrent()) return
      replayDialog.complete()
      void message.success(translateNow('Notification queued for safe replay.'))
      void reloadRef.current().catch(() => undefined)
    } catch (error) {
      void message.error(localizeError(error))
    }
  }

  return (
    <>
      <StandardListPageRecipe spec={spec} />
      <Modal
        title={t('Replay notification')}
        open={Boolean(replayJob)}
        okText={t('Confirm replay')}
        confirmLoading={replayDialog.busy}
        destroyOnHidden
        onCancel={replayDialog.requestClose}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !replayDialog.busy }}
        keyboard={!replayDialog.busy}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={() => void replayDialog.submit(submitReplay)}
          disabled={replayDialog.busy}
        >
          <Form.Item
            name="reason"
            label={t('Reason')}
            rules={[
              { required: true, whitespace: true, message: t('Enter a replay reason.') },
              { min: 3, message: t('Use at least 3 characters.') },
              { max: 500, message: t('Use at most 500 characters.') },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
