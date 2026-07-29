import type { CreatePrivacyRequest, PrivacyRequest } from '@shoppp/contracts'
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  createPrivacyRequest,
  downloadPrivacyExport,
  fetchPrivacyRequests,
} from '../../services/platform/api'

void React

type FormValues = Omit<CreatePrivacyRequest, 'confirm' | 'correction'> & {
  correctionField?: 'email' | 'shipping_address'
  requestedValue?: string
}

export const PrivacyPage = () => {
  const [items, setItems] = useState<PrivacyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const type = Form.useWatch('type', form)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchPrivacyRequests())
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      {
        key: 'created',
        title: 'Completed',
        dataIndex: 'completedAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      { key: 'reference', title: 'Subject reference', dataIndex: 'subjectReference', width: 170 },
      { key: 'type', title: 'Request type', dataIndex: 'type', width: 130 },
      { key: 'decision', title: 'Decision', dataIndex: 'decision', width: 300 },
      {
        key: 'status',
        title: 'Status',
        dataIndex: 'status',
        width: 120,
        render: (value: string) => <Tag color="success">{value}</Tag>,
      },
      {
        key: 'expires',
        title: 'Export expiry',
        dataIndex: 'expiresAt',
        width: 180,
        render: (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        key: 'actions',
        title: 'Actions',
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, item: PrivacyRequest) =>
          item.decision === 'export_created' ? (
            <Button type="link" onClick={() => void downloadPrivacyExport(item)}>
              Download
            </Button>
          ) : null,
      },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Privacy requests</h1>
        <p className="text-slate-500">
          Verified access, correction, and deletion operations with immutable retention decisions.
        </p>
      </div>
      <Space>
        <Button
          type="primary"
          onClick={() => {
            form.resetFields()
            setOpen(true)
          }}
        >
          Record verified request
        </Button>
        <Button onClick={() => void load()}>Refresh</Button>
      </Space>
      <Table<PrivacyRequest>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <Modal
        title="Record verified privacy request"
        open={open}
        okText="Confirm and execute"
        confirmLoading={submitting}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSubmitting(true)
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
              setOpen(false)
              await load()
              void message.success('Privacy request completed and audited.')
            } catch (error) {
              void message.error(normalizeApiError(error).message)
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item
            name="email"
            label="Verified subject email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Request type" rules={[{ required: true }]}>
            <Select options={['access', 'correction', 'deletion'].map((value) => ({ value }))} />
          </Form.Item>
          {type === 'correction' ? (
            <>
              <Form.Item
                name="correctionField"
                label="Correction field"
                rules={[{ required: true }]}
              >
                <Select options={[{ value: 'email' }, { value: 'shipping_address' }]} />
              </Form.Item>
              <Form.Item
                name="requestedValue"
                label="Requested value"
                rules={[{ required: true, max: 500 }]}
              >
                <Input.TextArea rows={3} maxLength={500} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="reason"
            label="Verification and action reason"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
