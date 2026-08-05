import type { AdminOrderDetail, FulfillmentTransitionRequest } from '@shoppp/contracts'
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
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  cancelOrder,
  fetchOrderDetail,
  refundOrder,
  transitionFulfillment,
} from '../../services/orders/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'

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

const money = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)

const actionTitle = (
  action: Action | null,
  t: (message: string, values?: Record<string, string | number>) => string
) => {
  if (!action) return t('Confirm operation')
  if (action.type === 'cancel') return t('Cancel and refund order')
  if (action.type === 'refund') return t('Issue refund')
  return t('Move fulfillment to {status}', { status: t(action.toStatus) })
}

export const OrderDetailPage = () => {
  const { reference = '' } = useParams()
  const { role, permissions } = useAuth()
  const { locale, t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
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
      setLoadError(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [localizeError, reference])

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
      void message.success(translateNow('Order operation recorded.'))
    } catch (error) {
      void message.error(localizeError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !detail) return <Card loading />
  if (loadError || !detail) {
    return (
      <Result
        status="error"
        title={t('Order could not be loaded')}
        subTitle={loadError ?? t('The order is unavailable.')}
        extra={<Button onClick={() => void load()}>{t('Retry')}</Button>}
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
          <p className="text-sm text-slate-500">{t('Immutable order facts')}</p>
          <h1 className="text-2xl font-semibold">{facts.publicReference}</h1>
          <p className="text-slate-500">{facts.email}</p>
        </div>
        <Space wrap>
          <Tag color={facts.paymentStatus === 'paid' ? 'success' : 'blue'}>
            {t('Payment')} · {t(facts.paymentStatus)}
          </Tag>
          <Tag>
            {t('Order')} · {t(facts.orderStatus)}
          </Tag>
          <Tag color={facts.fulfillmentStatus === 'shipped' ? 'cyan' : 'default'}>
            {t('Fulfillment')} · {t(facts.fulfillmentStatus)}
          </Tag>
        </Space>
      </div>

      <Card title={t('Order facts')}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
          <Descriptions.Item label={t('Created')}>
            {dayjs(facts.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('Currency')}>{facts.currency}</Descriptions.Item>
          <Descriptions.Item label={t('Total')}>
            {money(facts.totals.grandTotal, facts.currency, locale)}
          </Descriptions.Item>
          <Descriptions.Item label={t('Ship to')} span={3}>
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
            { key: 'product', title: t('Product'), dataIndex: 'productName', width: 240 },
            { key: 'variant', title: t('Variant'), dataIndex: 'variantName', width: 160 },
            { key: 'sku', title: 'SKU', dataIndex: 'sku', width: 150 },
            { key: 'quantity', title: t('Quantity'), dataIndex: 'quantity', width: 100 },
            {
              key: 'total',
              title: t('Line total'),
              width: 130,
              render: (_, line) => money(line.lineTotalAmount, line.currency, locale),
            },
          ]}
        />
      </Card>

      <Card title={t('Allowed operations')}>
        <Space wrap>
          {canFulfill
            ? detail.allowedActions.fulfill.map((toStatus) => (
                <Button
                  key={toStatus}
                  type="primary"
                  onClick={() => openAction({ type: 'fulfill', toStatus })}
                >
                  {toStatus === 'shipped'
                    ? t('Add shipment')
                    : t('Mark {status}', { status: t(toStatus) })}
                </Button>
              ))
            : null}
          {canRefund && detail.allowedActions.refundMaximum > 0 ? (
            <Button onClick={() => openAction({ type: 'refund' })}>{t('Refund')}</Button>
          ) : null}
          {canCancel && detail.allowedActions.cancel ? (
            <Button danger onClick={() => openAction({ type: 'cancel' })}>
              {t('Cancel order')}
            </Button>
          ) : null}
          {!detail.allowedActions.fulfill.length &&
          !detail.allowedActions.cancel &&
          detail.allowedActions.refundMaximum === 0 ? (
            <span className="text-slate-500">{t('No operation is currently available.')}</span>
          ) : null}
        </Space>
      </Card>

      <Card title={t('Operational timeline')}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={detail.timeline}
          locale={{ emptyText: t('No operational events recorded.') }}
          scroll={{ x: 900 }}
          columns={[
            {
              key: 'created',
              title: t('Time'),
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
            },
            { key: 'kind', title: t('Dimension'), dataIndex: 'kind', width: 130 },
            { key: 'label', title: t('Event'), dataIndex: 'label', width: 240 },
            { key: 'status', title: t('Result / state'), dataIndex: 'status', width: 150 },
            { key: 'actor', title: t('Actor'), dataIndex: 'actor', width: 150 },
            { key: 'reason', title: t('Reason'), dataIndex: 'reason', width: 260 },
          ]}
        />
      </Card>

      <Modal
        title={actionTitle(action, t)}
        open={Boolean(action)}
        okText={t('Confirm operation')}
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
          message={t('This action is audited and cannot be silently reversed.')}
        />
        <Form<ActionValues> form={form} layout="vertical" onFinish={submitAction}>
          {action?.type === 'refund' ? (
            <Form.Item
              name="amount"
              label={t('Amount in minor units (maximum {maximum})', {
                maximum: detail.allowedActions.refundMaximum,
              })}
              rules={[
                { required: true, message: t('Enter a refund amount.') },
                {
                  type: 'number',
                  min: 1,
                  max: detail.allowedActions.refundMaximum,
                  message: t('Use the remaining refundable amount or less.'),
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
                label={t('Carrier')}
                rules={[{ required: true, whitespace: true, message: t('Enter the carrier.') }]}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                name="trackingNumber"
                label={t('Tracking number')}
                rules={[
                  { required: true, whitespace: true, message: t('Enter the tracking number.') },
                ]}
              >
                <Input maxLength={160} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="reason"
            label={t('Reason')}
            rules={[
              { required: true, whitespace: true, message: t('Enter a reason.') },
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
