import type {
  AdminOrderDetail,
  FulfillmentTransitionRequest,
} from '@shoppp/contracts'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Result,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  cancelOrder,
  fetchOrderDetail,
  refundOrder,
  transitionFulfillment,
} from '../../services/orders/api'

void React

type Action =
  | { type: 'cancel' }
  | { type: 'refund' }
  | { toStatus: FulfillmentTransitionRequest['toStatus']; type: 'fulfill' }

type ActionValues = {
  amount?: number
  carrier?: string
  reason: string
  trackingNumber?: string
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100)

const actionTitle = (action: Action | null) => {
  if (!action) return 'Confirm operation'
  if (action.type === 'cancel') return 'Cancel and refund order'
  if (action.type === 'refund') return 'Issue refund'
  return `Move fulfillment to ${action.toStatus}`
}

export const OrderDetailPage = () => {
  const { reference = '' } = useParams()
  const { role, permissions } = useAuth()
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<ActionValues>()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setDetail(await fetchOrderDetail(reference))
    } catch (error) {
      setLoadError(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [reference])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openAction = (next: Action) => {
    form.resetFields()
    setAction(next)
  }

  const submitAction = async (values: ActionValues) => {
    if (!action || !detail) return
    setSubmitting(true)
    try {
      let updated: AdminOrderDetail
      if (action.type === 'refund') {
        updated = await refundOrder(reference, {
          amount: values.amount ?? 0,
          confirm: true,
          reason: values.reason,
        })
      } else if (action.type === 'cancel') {
        updated = await cancelOrder(reference, {
          confirm: true,
          reason: values.reason,
        })
      } else {
        updated = await transitionFulfillment(reference, {
          ...(action.toStatus === 'shipped'
            ? {
                carrier: values.carrier ?? '',
                trackingNumber: values.trackingNumber ?? '',
              }
            : {}),
          confirm: true,
          reason: values.reason,
          toStatus: action.toStatus,
        })
      }
      setDetail(updated)
      setAction(null)
      void message.success('Order operation recorded.')
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !detail) return <Card loading />
  if (loadError || !detail) {
    return (
      <Result
        status="error"
        title="Order could not be loaded"
        subTitle={loadError ?? 'The order is unavailable.'}
        extra={<Button onClick={() => void load()}>Retry</Button>}
      />
    )
  }

  const { facts } = detail
  const canFulfill = hasPermission(role, 'orders.fulfill', permissions)
  const canRefund = hasPermission(role, 'orders.refund', permissions)
  const canCancel = hasPermission(role, 'orders.cancel', permissions)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Immutable order facts</p>
          <h1 className="text-2xl font-semibold">{facts.publicReference}</h1>
          <p className="text-slate-500">{facts.email}</p>
        </div>
        <Space wrap>
          <Tag color={facts.paymentStatus === 'paid' ? 'success' : 'blue'}>
            Payment · {facts.paymentStatus}
          </Tag>
          <Tag>Order · {facts.orderStatus}</Tag>
          <Tag color={facts.fulfillmentStatus === 'shipped' ? 'cyan' : 'default'}>
            Fulfillment · {facts.fulfillmentStatus}
          </Tag>
        </Space>
      </div>

      <Card title="Order facts">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
          <Descriptions.Item label="Created">
            {dayjs(facts.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="Currency">{facts.currency}</Descriptions.Item>
          <Descriptions.Item label="Total">
            {money(facts.totals.grandTotal, facts.currency)}
          </Descriptions.Item>
          <Descriptions.Item label="Ship to" span={3}>
            {facts.shippingAddress.name}, {facts.shippingAddress.line1},{' '}
            {facts.shippingAddress.city} {facts.shippingAddress.region}{' '}
            {facts.shippingAddress.postalCode}, {facts.shippingAddress.countryCode}
          </Descriptions.Item>
        </Descriptions>
        <Table
          className="mt-4"
          rowKey="sku"
          pagination={false}
          dataSource={facts.lines}
          scroll={{ x: 760 }}
          columns={[
            { key: 'product', title: 'Product', dataIndex: 'productName', width: 240 },
            { key: 'variant', title: 'Variant', dataIndex: 'variantName', width: 160 },
            { key: 'sku', title: 'SKU', dataIndex: 'sku', width: 150 },
            { key: 'quantity', title: 'Quantity', dataIndex: 'quantity', width: 100 },
            {
              key: 'total',
              title: 'Line total',
              width: 130,
              render: (_, line) => money(line.lineTotalAmount, line.currency),
            },
          ]}
        />
      </Card>

      <Card title="Allowed operations">
        <Space wrap>
          {canFulfill
            ? detail.allowedActions.fulfill.map((toStatus) => (
                <Button key={toStatus} type="primary" onClick={() => openAction({ type: 'fulfill', toStatus })}>
                  {toStatus === 'shipped' ? 'Add shipment' : `Mark ${toStatus}`}
                </Button>
              ))
            : null}
          {canRefund && detail.allowedActions.refundMaximum > 0 ? (
            <Button onClick={() => openAction({ type: 'refund' })}>
              Refund
            </Button>
          ) : null}
          {canCancel && detail.allowedActions.cancel ? (
            <Button danger onClick={() => openAction({ type: 'cancel' })}>
              Cancel order
            </Button>
          ) : null}
          {!detail.allowedActions.fulfill.length &&
          !detail.allowedActions.cancel &&
          detail.allowedActions.refundMaximum === 0 ? (
            <span className="text-slate-500">No operation is currently available.</span>
          ) : null}
        </Space>
      </Card>

      <Card title="Operational timeline">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={detail.timeline}
          locale={{ emptyText: 'No operational events recorded.' }}
          scroll={{ x: 900 }}
          columns={[
            {
              key: 'created',
              title: 'Time',
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
            },
            { key: 'kind', title: 'Dimension', dataIndex: 'kind', width: 130 },
            { key: 'label', title: 'Event', dataIndex: 'label', width: 240 },
            { key: 'status', title: 'Result / state', dataIndex: 'status', width: 150 },
            { key: 'actor', title: 'Actor', dataIndex: 'actor', width: 150 },
            { key: 'reason', title: 'Reason', dataIndex: 'reason', width: 260 },
          ]}
        />
      </Card>

      <Modal
        title={actionTitle(action)}
        open={Boolean(action)}
        okText="Confirm operation"
        okButtonProps={{ danger: action?.type === 'cancel' || action?.type === 'refund' }}
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => setAction(null)}
        onOk={() => form.submit()}
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="This action is audited and cannot be silently reversed."
        />
        <Form<ActionValues> form={form} layout="vertical" onFinish={submitAction}>
          {action?.type === 'refund' ? (
            <Form.Item
              name="amount"
              label={`Amount in minor units (maximum ${detail.allowedActions.refundMaximum})`}
              rules={[
                { required: true, message: 'Enter a refund amount.' },
                {
                  type: 'number',
                  min: 1,
                  max: detail.allowedActions.refundMaximum,
                  message: 'Use the remaining refundable amount or less.',
                },
              ]}
            >
              <InputNumber precision={0} className="w-full" />
            </Form.Item>
          ) : null}
          {action?.type === 'fulfill' && action.toStatus === 'shipped' ? (
            <>
              <Form.Item
                name="carrier"
                label="Carrier"
                rules={[{ required: true, whitespace: true, message: 'Enter the carrier.' }]}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                name="trackingNumber"
                label="Tracking number"
                rules={[{ required: true, whitespace: true, message: 'Enter the tracking number.' }]}
              >
                <Input maxLength={160} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="reason"
            label="Reason"
            rules={[
              { required: true, whitespace: true, message: 'Enter a reason.' },
              { min: 3, message: 'Use at least 3 characters.' },
              { max: 500, message: 'Use at most 500 characters.' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
