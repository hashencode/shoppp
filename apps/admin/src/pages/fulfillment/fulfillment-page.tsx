import type { AdminOrder } from '@shoppp/contracts'
import { Button, Card, Table, Tag } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import { fetchOrders } from '../../services/orders/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import {
  buildListToolbarColumnSettingOptions,
  ListToolbarActions,
} from '../../shared/components/list-toolbar-actions'
import { useListViewPreferences } from '../../shared/hooks/use-list-view-preferences'
import { STANDARD_LIST_TABLE_CLASS_NAME, TemplateListContent } from '../../shared/template-kit/list'

void React

const COLUMN_KEYS = ['reference', 'customer', 'status', 'action']

export const FulfillmentPage = () => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const localizeError = useLocalizedApiError()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const view = useListViewPreferences({
    tableId: 'fulfillment-list',
    defaultColumnKeys: COLUMN_KEYS,
    defaultDensity: 'middle',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
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
      setLoadError(localizeError(error))
    } finally {
      setLoading(false)
    }
  }, [localizeError])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = [
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
      render: (_: unknown, order: AdminOrder) => (
        <Button type="link" onClick={() => navigate(`/orders/${order.publicReference}`)}>
          {t('Continue')}
        </Button>
      ),
    },
  ]
  const orderedColumns = view.columnOrder.flatMap((key) =>
    columns.filter((column) => column.key === key)
  )
  const visibleColumns = orderedColumns.filter((column) =>
    view.selectedColumnKeys.includes(column.key)
  )

  return (
    <CustomPageRecipe title={t('Fulfillment')}>
      <Card variant="borderless" styles={{ body: { padding: 16 } }}>
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <ListToolbarActions
            tableSize={view.tableSize}
            onTableSizeChange={view.setTableSize}
            onClearColumnSort={view.clearColumnOrder}
            clearColumnSortDisabled={!view.hasCustomColumnOrder}
            reloadLoading={loading}
            onReload={() => void load()}
            columnSettingOptions={buildListToolbarColumnSettingOptions(orderedColumns)}
            selectedColumnKeys={view.selectedColumnKeys}
            onSelectedColumnKeysChange={view.setSelectedColumnKeys}
            onColumnSettingOrderChange={view.setColumnOrder}
          />
        </div>
        <TemplateListContent
          showInitialLoading={loading && orders.length === 0}
          showError={!loading && Boolean(loadError) && orders.length === 0}
          showPartial={Boolean(loadError) && orders.length > 0}
          showEmpty={!loading && !loadError && orders.length === 0}
          errorMessage={loadError ?? undefined}
          partialMessage={loadError ?? undefined}
          onRetry={() => void load()}
          onReloadPartial={() => void load()}
          onResetEmpty={() => void load()}
          copy={{
            loadingTitle: t('Loading orders'),
            errorTitle: t('List could not be loaded'),
            partialTitle: t('Refresh failed. Showing previously loaded data.'),
            emptyDescription: t('No paid orders are waiting for fulfillment.'),
            emptyActionLabel: t('Reload'),
          }}
          tableNode={
            <Table<AdminOrder>
              className={STANDARD_LIST_TABLE_CLASS_NAME}
              rowKey="publicReference"
              loading={loading}
              size={view.tableSize}
              dataSource={orders}
              pagination={false}
              scroll={{ x: 820 }}
              columns={visibleColumns}
            />
          }
        />
      </Card>
    </CustomPageRecipe>
  )
}
