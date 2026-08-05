import type { AdminOrder } from '@shoppp/contracts'
import { Button, Input, Select, Space, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchOrders } from '../../services/orders/api'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

const money = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)

export const OrderListPage = () => {
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const localizeError = useLocalizedApiError()
  const [items, setItems] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<AdminOrder['paymentStatus']>()
  const [fulfillmentStatus, setFulfillmentStatus] = useState<AdminOrder['fulfillmentStatus']>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const load = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      try {
        const response = await fetchOrders({
          fulfillmentStatus,
          page: nextPage,
          pageSize,
          paymentStatus,
          query: committedQuery || undefined,
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
    [committedQuery, fulfillmentStatus, localizeError, paymentStatus]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(1), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      {
        key: 'reference',
        title: t('Order'),
        width: 180,
        render: (_: unknown, order: AdminOrder) => (
          <Button
            type="link"
            className="!px-0 font-medium"
            onClick={() => navigate(`/orders/${order.publicReference}`)}
          >
            {order.publicReference}
          </Button>
        ),
      },
      { key: 'email', title: t('Customer'), dataIndex: 'email', width: 230 },
      {
        key: 'payment',
        title: t('Payment'),
        dataIndex: 'paymentStatus',
        width: 150,
        render: (value: string) => (
          <Tag color={value === 'paid' ? 'success' : 'blue'}>{t(value)}</Tag>
        ),
      },
      {
        key: 'orderStatus',
        title: t('Order state'),
        dataIndex: 'orderStatus',
        width: 150,
        render: (value: string) => <Tag>{t(value)}</Tag>,
      },
      {
        key: 'fulfillment',
        title: t('Fulfillment'),
        dataIndex: 'fulfillmentStatus',
        width: 150,
        render: (value: string) => (
          <Tag color={value === 'shipped' ? 'cyan' : 'default'}>{t(value)}</Tag>
        ),
      },
      {
        key: 'total',
        title: t('Total'),
        width: 130,
        render: (_: unknown, order: AdminOrder) => money(order.grandTotal, order.currency, locale),
      },
      {
        key: 'created',
        title: t('Created'),
        dataIndex: 'createdAt',
        width: 170,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
    ],
    [locale, navigate, t]
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Orders')}</h1>
        <p className="text-slate-500">
          {t('Search immutable order facts and independent operational states.')}
        </p>
      </div>
      <Space wrap>
        <Input.Search
          aria-label={t('Search orders')}
          allowClear
          value={query}
          placeholder={t('Order reference or customer email')}
          className="w-80"
          onChange={(event) => setQuery(event.target.value)}
          onSearch={(value) => setCommittedQuery(value.trim())}
        />
        <Select
          aria-label={t('Filter payment status')}
          allowClear
          value={paymentStatus}
          placeholder={t('Payment status')}
          className="w-44"
          options={['paid', 'partially_refunded', 'refunded', 'failed'].map((value) => ({
            label: t(value),
            value,
          }))}
          onChange={(value) => setPaymentStatus(value)}
        />
        <Select
          aria-label={t('Filter fulfillment status')}
          allowClear
          value={fulfillmentStatus}
          placeholder={t('Fulfillment status')}
          className="w-48"
          options={['unfulfilled', 'picking', 'packed', 'shipped', 'delivered', 'canceled'].map(
            (value) => ({ label: t(value), value })
          )}
          onChange={(value) => setFulfillmentStatus(value)}
        />
      </Space>
      <Table<AdminOrder>
        rowKey="publicReference"
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{ emptyText: t('No orders match these filters.') }}
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: false,
          total,
          onChange: (nextPage) => void load(nextPage),
        }}
        scroll={{ x: 1160 }}
      />
    </div>
  )
}
