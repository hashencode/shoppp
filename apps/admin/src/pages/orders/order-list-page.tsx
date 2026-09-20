import { fulfillmentStatusSchema, type AdminOrder } from '@shoppp/contracts'
import { Button, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { fetchOrders, type OrderFilters } from '../../services/orders/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'

void React

type OrderListResponse = Awaited<ReturnType<typeof fetchOrders>>

type OrderSearchValues = {
  fulfillmentStatus?: AdminOrder['fulfillmentStatus']
  paymentStatus?: AdminOrder['paymentStatus']
  query?: string
}

const money = (amount: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100)

const toFilters = (values: OrderSearchValues): OrderFilters => ({
  fulfillmentStatus: values.fulfillmentStatus,
  paymentStatus: values.paymentStatus,
  query: values.query?.trim() || undefined,
})

const buildOrderRequestFilters: StandardListPageSpec<
  OrderSearchValues,
  OrderFilters,
  OrderListResponse,
  AdminOrder,
  Error
>['buildRequestFilters'] = ({ filters, current, pageSize }) => ({
  ...filters,
  page: current,
  pageSize,
})

export const OrderListPage = () => {
  const navigate = useNavigate()
  const { locale, t } = useI18n()
  const localizeError = useLocalizedApiError()

  const filterFields = useMemo<TemplateListFilterField<OrderSearchValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: t('Order'),
        inputProps: {
          'aria-label': t('Search orders'),
          placeholder: t('Order reference or customer email'),
        },
      },
      {
        type: 'select',
        name: 'paymentStatus',
        label: t('Payment'),
        selectProps: {
          'aria-label': t('Filter payment status'),
          allowClear: true,
          placeholder: t('Payment status'),
        },
        options: ['paid', 'partially_refunded', 'refunded', 'failed'].map((value) => ({
          label: t(value),
          value,
        })),
      },
      {
        type: 'select',
        name: 'fulfillmentStatus',
        label: t('Fulfillment'),
        selectProps: {
          'aria-label': t('Filter fulfillment status'),
          allowClear: true,
          placeholder: t('Fulfillment status'),
        },
        options: fulfillmentStatusSchema.options.map((value) => ({ label: t(value), value })),
      },
    ],
    [t]
  )

  const spec = useMemo<
    StandardListPageSpec<OrderSearchValues, OrderFilters, OrderListResponse, AdminOrder, Error>
  >(
    () => ({
      pageTitle: t('Orders'),
      cardTitle: t('Orders'),
      tableId: 'orders-list',
      initialFilters: {},
      toFilters,
      pagination: {
        defaultPageSize: 20,
        includeAllDataOption: false,
        maxPageSize: 100,
        pageSizeOptions: [20, 50, 100],
      },
      buildRequestFilters: buildOrderRequestFilters,
      request: fetchOrders,
      selectItems: (response) => response?.data ?? [],
      mapError: (error) => new Error(localizeError(error)),
      filterFields,
      buildColumns: () => [
        {
          key: 'reference',
          title: t('Order'),
          width: 180,
          render: (_: unknown, order) => (
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
          render: (_: unknown, order) => money(order.grandTotal, order.currency, locale),
        },
        {
          key: 'created',
          title: t('Created'),
          dataIndex: 'createdAt',
          width: 170,
          render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        },
      ],
      buildTableNode: ({
        columns,
        dataSource,
        loading,
        pagination,
        tableClassName,
        tableSize,
        virtualScroll,
      }) => (
        <Table<AdminOrder>
          className={tableClassName}
          rowKey="publicReference"
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          size={tableSize}
          pagination={pagination}
          virtual={virtualScroll.enabled}
          scroll={virtualScroll.enabled ? virtualScroll.scroll : { x: 1160 }}
        />
      ),
      stateCopy: {
        errorTitle: t('List could not be loaded'),
        emptyTitle: t('No orders match these filters.'),
        emptyDescription: t('No orders match these filters.'),
      },
    }),
    [filterFields, locale, localizeError, navigate, t]
  )

  return <StandardListPageRecipe spec={spec} />
}
