import { App, Form, Input, InputNumber, Modal, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import {
  adjustInventory,
  fetchInventory,
  fetchInventoryDetail,
  type InventoryDetail,
  type InventoryListItem,
} from '../../services/inventory/api'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { ListRowActions } from '../../shared/components/list-row-actions'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'

import { useFormDialog } from '../../shared/hooks/use-form-dialog'

void React

type AdjustmentValues = {
  quantityDelta: number
  reason: string
}

type InventorySearchValues = {
  query?: string
}

type InventoryFilters = Parameters<typeof fetchInventory>[0]
type InventoryListResponse = Awaited<ReturnType<typeof fetchInventory>>

const ACTION_CONTENT_WIDTHS = { history: 56, adjust: 56 } as const
const ACTION_LAYOUT_COMBINATIONS = [
  [ACTION_CONTENT_WIDTHS.history],
  [ACTION_CONTENT_WIDTHS.history, ACTION_CONTENT_WIDTHS.adjust],
] as const

const toFilters = (values: InventorySearchValues): InventoryFilters => ({
  query: values.query?.trim() || undefined,
})

const buildInventoryRequestFilters: StandardListPageSpec<
  InventorySearchValues,
  InventoryFilters,
  InventoryListResponse,
  InventoryListItem,
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

export const InventoryPage = () => {
  const { message } = App.useApp()
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const canAdjust = hasPermission(role, 'inventory.adjust', permissions)
  const [selected, setSelected] = useState<InventoryListItem | null>(null)
  const [detail, setDetail] = useState<InventoryDetail | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [form] = Form.useForm<AdjustmentValues>()
  const adjustmentDialog = useFormDialog({
    open: adjustOpen,
    form,
    onClose: () => setAdjustOpen(false),
  })
  const reloadRef = useRef<() => Promise<void>>(async () => undefined)
  const captureReload = useCallback((reload: () => Promise<void>) => {
    reloadRef.current = reload
  }, [])

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

  const openAdjustment = useCallback(
    (item: InventoryListItem) => {
      setSelected(item)
      form.resetFields()
      setAdjustOpen(true)
    },
    [form]
  )

  const filterFields = useMemo<TemplateListFilterField<InventorySearchValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: t('Inventory'),
        inputProps: {
          'aria-label': t('Search inventory'),
          placeholder: t('Search product or SKU'),
        },
      },
    ],
    [t]
  )

  const spec = useMemo<
    StandardListPageSpec<
      InventorySearchValues,
      InventoryFilters,
      InventoryListResponse,
      InventoryListItem,
      Error
    >
  >(
    () => ({
      pageTitle: t('Inventory'),
      cardTitle: t('Inventory'),
      tableId: 'inventory-list',
      initialFilters: {},
      toFilters,
      pagination: {
        defaultPageSize: 20,
        includeAllDataOption: false,
        maxPageSize: 100,
        pageSizeOptions: [20, 50, 100],
      },
      buildRequestFilters: buildInventoryRequestFilters,
      request: fetchInventory,
      selectItems: (response) => response?.data ?? [],
      mapError: (error) => new Error(localizeError(error)),
      filterFields,
      buildColumns: ({ resolveActionColumnLayout }) => {
        const actionLayout = resolveActionColumnLayout(ACTION_LAYOUT_COMBINATIONS)
        return [
          {
            key: 'product',
            title: t('Product / variant'),
            width: 260,
            render: (_: unknown, item) => (
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
            width: actionLayout.columnWidth,
            render: (_: unknown, item) => (
              <ListRowActions
                layoutMode={actionLayout.mode}
                maxRowContentWidth={actionLayout.maxRowContentWidth}
                actions={[
                  {
                    key: 'history',
                    label: t('History'),
                    contentWidth: ACTION_CONTENT_WIDTHS.history,
                    onClick: () => openHistory(item),
                  },
                  {
                    key: 'adjust',
                    label: t('Adjust'),
                    contentWidth: ACTION_CONTENT_WIDTHS.adjust,
                    visible: canAdjust,
                    onClick: () => openAdjustment(item),
                  },
                ]}
              />
            ),
          },
        ]
      },
      buildTableNode: ({
        columns,
        dataSource,
        loading,
        pagination,
        reload,
        tableClassName,
        tableSize,
        virtualScroll,
      }) => {
        return (
          <>
            <ReloadBridge reload={reload} capture={captureReload} />
            <Table<InventoryListItem>
              className={tableClassName}
              rowKey={(item) => `${item.variantId}:${item.warehouseId}`}
              columns={columns}
              dataSource={dataSource}
              loading={loading}
              size={tableSize}
              pagination={pagination}
              virtual={virtualScroll.enabled}
              scroll={virtualScroll.enabled ? virtualScroll.scroll : { x: 1040 }}
            />
          </>
        )
      },
      stateCopy: {
        errorTitle: t('List could not be loaded'),
        emptyTitle: t('No data matches the current filters'),
        emptyDescription: t('Reset the filters and search again.'),
      },
    }),
    [canAdjust, captureReload, filterFields, localizeError, openAdjustment, openHistory, t]
  )

  return (
    <>
      <StandardListPageRecipe spec={spec} />

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
        confirmLoading={adjustmentDialog.busy}
        onCancel={adjustmentDialog.requestClose}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !adjustmentDialog.busy }}
        keyboard={!adjustmentDialog.busy}
        onOk={() => form.submit()}
      >
        <Form<AdjustmentValues>
          form={form}
          layout="vertical"
          onFinish={() =>
            void adjustmentDialog.submit(async (values) => {
              if (!selected || !canAdjust) return

              try {
                await adjustInventory(selected.variantId, selected.warehouseId, values)
                if (!adjustmentDialog.isCurrent()) return
                void message.success(translateNow('Inventory adjustment recorded.'))
                adjustmentDialog.complete()
                void reloadRef.current().catch(() => undefined)
              } catch (error) {
                void message.error(localizeError(error))
              }
            })
          }
          disabled={adjustmentDialog.busy}
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
    </>
  )
}
