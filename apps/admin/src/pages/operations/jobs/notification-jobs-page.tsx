import type { NotificationJob, NotificationJobStatus } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission } from '../../../infrastructure/auth/permissions'
import { useAuth } from '../../../infrastructure/auth/use-auth'
import { useLocalizedApiError } from '../../../shared/i18n/api-error'
import {
  fetchNotificationJobs,
  replayNotification,
} from '../../../services/operations/notifications-api'
import { useCurrentTranslate, useI18n } from '../../../shared/contexts/i18n-context'

void React

const statusColors: Record<NotificationJobStatus, string> = {
  dead_letter: 'error',
  failed: 'warning',
  pending: 'processing',
  processing: 'blue',
  sent: 'success',
}

export const NotificationJobsPage = () => {
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const [items, setItems] = useState<NotificationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [status, setStatus] = useState<NotificationJobStatus>()
  const [type, setType] = useState<NotificationJob['type']>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [replayJob, setReplayJob] = useState<NotificationJob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<{ reason: string }>()
  const pageSize = 20
  const canReplay = hasPermission(role, 'operations.replay', permissions)

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      try {
        const response = await fetchNotificationJobs({
          page: nextPage,
          pageSize,
          ...(committedQuery ? { query: committedQuery } : {}),
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
        })
        setItems(response.data)
        setPage(response.page)
        setTotal(response.total)
      } catch (error) {
        void message.error(localizeError(error))
      } finally {
        setLoading(false)
      }
    },
    [committedQuery, localizeError, status, type]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
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
        render: (value: NotificationJobStatus) => <Tag color={statusColors[value]}>{t(value)}</Tag>,
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
        render: (_: unknown, job: NotificationJob) => `${job.attemptCount} / ${job.maxAttempts}`,
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
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, job: NotificationJob) =>
          canReplay && job.status === 'dead_letter' ? (
            <Button
              type="link"
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
    [canReplay, form, t]
  )

  const submitReplay = async ({ reason }: { reason: string }) => {
    if (!replayJob) return
    setSubmitting(true)
    try {
      const updated = await replayNotification(replayJob.id, {
        confirm: true,
        reason,
      })
      setItems((current) => current.map((job) => (job.id === updated.id ? updated : job)))
      setReplayJob(null)
      void message.success(translateNow('Notification queued for safe replay.'))
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Automation recovery')}</h1>
        <p className="text-slate-500">
          {t(
            'Inspect bounded notification and provider attempts, then safely replay exhausted work.'
          )}
        </p>
      </div>
      <Space wrap>
        <Input.Search
          aria-label={t('Search notification jobs')}
          allowClear
          value={query}
          placeholder={t('Order reference or job ID')}
          className="w-80"
          onChange={(event) => setQuery(event.target.value)}
          onSearch={(value) => setCommittedQuery(value.trim())}
        />
        <Select
          aria-label={t('Filter notification status')}
          allowClear
          value={status}
          placeholder="Status"
          className="w-44"
          options={['pending', 'processing', 'sent', 'failed', 'dead_letter'].map((value) => ({
            label: t(value),
            value,
          }))}
          onChange={(value) => setStatus(value)}
        />
        <Select
          aria-label={t('Filter notification type')}
          allowClear
          value={type}
          placeholder={t('Job type')}
          className="w-52"
          options={[
            'order_receipt',
            'payment_failed',
            'cancellation',
            'refund',
            'shipment',
            'payment_reconciliation',
            'admin_invitation',
            'admin_password_reset',
          ].map((value) => ({ label: t(value), value }))}
          onChange={(value) => setType(value)}
        />
      </Space>
      <Table<NotificationJob>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{ emptyText: t('No notification jobs match these filters.') }}
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: false,
          total,
          onChange: (nextPage) => void load(nextPage),
        }}
        scroll={{ x: 1730 }}
        expandable={{
          expandedRowRender: (job) => (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={job.attempts}
              locale={{ emptyText: t('No delivery attempt has run yet.') }}
              scroll={{ x: 880 }}
              columns={[
                { key: 'number', title: t('Attempt'), dataIndex: 'attemptNumber', width: 100 },
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
      <Modal
        title={t('Replay notification')}
        open={Boolean(replayJob)}
        okText={t('Confirm replay')}
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => setReplayJob(null)}
        onOk={() => form.submit()}
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message={t(
            'Replay keeps the original provider idempotency identity and is fully audited.'
          )}
        />
        <Form form={form} layout="vertical" onFinish={submitReplay}>
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
    </div>
  )
}
