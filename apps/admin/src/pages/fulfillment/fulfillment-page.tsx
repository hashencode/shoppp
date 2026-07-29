import type { AdminOrder } from '@shoppp/contracts'
import { Button, Table, Tag, message } from 'antd'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchOrders } from '../../services/orders/api'

void React

export const FulfillmentPage = () => {
  const navigate = useNavigate()
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
        void message.error(normalizeApiError(error).message)
      } finally {
        setLoading(false)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Fulfillment</h1>
        <p className="text-slate-500">Paid orders waiting for the next warehouse transition.</p>
      </div>
      <Table<AdminOrder>
        rowKey="publicReference"
        loading={loading}
        dataSource={orders}
        locale={{ emptyText: 'No paid orders are waiting for fulfillment.' }}
        pagination={false}
        scroll={{ x: 820 }}
        columns={[
          { key: 'reference', title: 'Order', dataIndex: 'publicReference', width: 180 },
          { key: 'customer', title: 'Customer', dataIndex: 'email', width: 240 },
          {
            key: 'status',
            title: 'Fulfillment',
            dataIndex: 'fulfillmentStatus',
            width: 150,
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            key: 'action',
            title: 'Action',
            width: 150,
            render: (_, order) => (
              <Button type="link" onClick={() => navigate(`/orders/${order.publicReference}`)}>
                Continue
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}
