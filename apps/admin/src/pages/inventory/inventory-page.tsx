import { Button, Form, Input, InputNumber, Modal, Space, Table, Tag, App } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  adjustInventory,
  fetchInventory,
  fetchInventoryDetail,
  type InventoryDetail,
  type InventoryListItem,
} from '../../services/inventory/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'

void React

type AdjustmentValues = {
  quantityDelta: number
  reason: string
}

export const InventoryPage = () => {
  const { message } = App.useApp()
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const canAdjust = hasPermission(role, 'inventory.adjust', permissions)
  const [items, setItems] = useState<InventoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<InventoryListItem | null>(null)
  const [detail, setDetail] = useState<InventoryDetail | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<AdjustmentValues>()

  const load = useCallback(
    async (nextQuery: string) => {
      setLoading(true)
      try {
        const response = await fetchInventory({
          page: 1,
          pageSize: 100,
          query: nextQuery.trim() || undefined,
        })
        setItems(response.data)
      } catch (error) {
        void message.error(localizeError(error))
      } finally {
        setLoading(false)
      }
    },
    [message, localizeError]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(''), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openHistory = useCallback(
    async (item: InventoryListItem) => {
      setSelected(item)
      setHistoryOpen(true)
      setDetail(null)
      try {
        setDetail(await fetchInventoryDetail(item.variantId, item.warehouseId))
      } catch (error) {
        void message.error(localizeError(error))
      }
    },
    [message, localizeError]
  )

  const columns = useMemo(
    () => [
      {
        key: 'product',
        title: t('Product / variant'),
        width: 260,
        render: (_: unknown, item: InventoryListItem) => (
          <>
            <div>{item.productName}</div>
            <span className="text-sm text-slate-500">
              {item.variantName} · {item.sku}
            </span>
          </>
        ),
      },
      { key: 'warehouse', title: t('Warehouse'), dataIndex: 'warehouseName', width: 160 },
      { key: 'onHand', title: t('On hand'), dataIndex: 'onHand', width: 110 },
      { key: 'reserved', title: t('Reserved'), dataIndex: 'reserved', width: 110 },
      {
        key: 'available',
        title: t('Available'),
        dataIndex: 'available',
        width: 110,
        render: (value: number) => <Tag color={value > 0 ? 'success' : 'error'}>{value}</Tag>,
      },
      {
        key: 'adjusted',
        title: t('Adjusted'),
        dataIndex: 'adjusted',
        width: 110,
        render: (value: number) => (value > 0 ? `+${value}` : value),
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: 180,
        render: (_: unknown, item: InventoryListItem) => (
          <Space>
            <Button type="link" className="!px-0" onClick={() => void openHistory(item)}>
              {t('History')}
            </Button>
            {canAdjust ? (
              <Button
                type="link"
                className="!px-0"
                onClick={() => {
                  setSelected(item)
                  form.resetFields()
                  setAdjustOpen(true)
                }}
              >
                {t('Adjust')}
              </Button>
            ) : null}
          </Space>
        ),
      },
    ],
    [canAdjust, form, openHistory, t]
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('Inventory')}</h1>
        <p className="text-slate-500">
          {t('On-hand, reserved, available, and append-only adjustments.')}
        </p>
      </div>
      <Space.Compact>
        <Input
          aria-label={t('Search inventory')}
          value={query}
          placeholder={t('Search product or SKU')}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => void load(query)}
        />
        <Button onClick={() => void load(query)}>{t('Search')}</Button>
      </Space.Compact>
      <Table<InventoryListItem>
        rowKey={(item) => `${item.variantId}:${item.warehouseId}`}
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        scroll={{ x: 1040 }}
      />

      <Modal
        title={selected ? `${t('History')} · ${selected.sku}` : t('Inventory history')}
        open={historyOpen}
        footer={null}
        width={760}
        onCancel={() => setHistoryOpen(false)}
      >
        <Table
          rowKey="id"
          loading={!detail}
          dataSource={detail?.history ?? []}
          pagination={false}
          scroll={{ x: 660 }}
          locale={{ emptyText: t('No manual adjustments yet.') }}
          columns={[
            {
              key: 'created',
              title: t('Time'),
              dataIndex: 'created_at',
              width: 160,
              render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
            },
            { key: 'delta', title: t('Delta'), dataIndex: 'quantity_delta', width: 90 },
            { key: 'reason', title: t('Reason'), dataIndex: 'reason', width: 280 },
            { key: 'actor', title: t('Actor'), dataIndex: 'actor_name', width: 130 },
          ]}
        />
      </Modal>

      <Modal
        title={selected ? `${t('Adjust')} · ${selected.sku}` : t('Adjust inventory')}
        open={adjustOpen}
        okText={t('Apply adjustment')}
        confirmLoading={submitting}
        onCancel={() => setAdjustOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<AdjustmentValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (!selected) return
            setSubmitting(true)
            try {
              await adjustInventory(selected.variantId, selected.warehouseId, values)
              void message.success(translateNow('Inventory adjustment recorded.'))
              setAdjustOpen(false)
              await load(query)
            } catch (error) {
              void message.error(localizeError(error))
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item
            name="quantityDelta"
            label={t('Quantity delta')}
            rules={[
              { required: true, message: t('Enter a quantity delta.') },
              {
                validator: (_, value) =>
                  value === 0
                    ? Promise.reject(new Error(t('Quantity delta cannot be zero.')))
                    : Promise.resolve(),
              },
            ]}
          >
            <InputNumber
              precision={0}
              step={1}
              className="w-full"
              placeholder={t('Use a negative value to remove stock')}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t('Reason')}
            rules={[
              { required: true, whitespace: true, message: t('Enter an adjustment reason.') },
              { min: 3, message: t('Use at least 3 characters.') },
              { max: 500, message: t('Use at most 500 characters.') },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder={t('Cycle count, damage, receipt…')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
