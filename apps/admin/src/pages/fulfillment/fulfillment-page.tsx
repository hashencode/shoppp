import type { AdminOrder } from '@shoppp/contracts'
import { Button, Table, Tag, message } from 'antd'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchOrders } from '../../services/orders/api'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

export const FulfillmentPage = () => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const localizeError = useLocalizedApiError()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetchOrders({ page: 1, pageSize: 100 })
        setOrders(
          response.data.filter(
            (order) =>
              (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') &&
              ['unfulfilled', 'picking', 'packed', 'shipped'].includes(order.fulfillmentStatus)
          )
        )
      } catch (error) {
        void message.error(localizeError(error))
      } finally {
        setLoading(false)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [localizeError])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Fulfillment')}</h1>
        <p className="text-slate-500">
          {t('Paid orders waiting for the next warehouse transition.')}
        </p>
      </div>
      <Table<AdminOrder>
        rowKey="publicReference"
        loading={loading}
        dataSource={orders}
        locale={{ emptyText: t('No paid orders are waiting for fulfillment.') }}
        pagination={false}
        scroll={{ x: 820 }}
        columns={[
          { key: 'reference', title: t('Order'), dataIndex: 'publicReference', width: 180 },
          { key: 'customer', title: t('Customer'), dataIndex: 'email', width: 240 },
          {
            key: 'status',
            title: t('Fulfillment'),
            dataIndex: 'fulfillmentStatus',
            width: 150,
            render: (value: string) => <Tag>{t(value)}</Tag>,
          },
          {
            key: 'action',
            title: t('Action'),
            width: 150,
            render: (_, order) => (
              <Button type="link" onClick={() => navigate(`/orders/${order.publicReference}`)}>
                {t('Continue')}
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}
