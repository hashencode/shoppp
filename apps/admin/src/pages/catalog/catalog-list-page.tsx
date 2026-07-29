import { Button, Input, Modal, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useMemo, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchCatalogProducts,
  previewCatalogProduct,
  publishCatalogProduct,
  type CatalogListFilters,
  type CatalogListResponse,
  type CatalogProductListItem,
  type ProductStatus,
} from '../../services/catalog/api'
import { ListRowActions } from '../../shared/components/list-row-actions'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'

void React

// Fixed action width for “View + Edit + Publish”, including dividers and padding.
const ACTION_COLUMN_WIDTH = 248

const statusStyle: Record<ProductStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Draft' },
  scheduled: { color: 'processing', label: 'Scheduled' },
  published: { color: 'success', label: 'Published' },
  archived: { color: 'warning', label: 'Archived' },
}

const PublishAction = ({
  product,
  onPublish,
}: {
  product: CatalogProductListItem
  onPublish: (reason: string) => Promise<void>
}) => {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <>
      <Button type="link" className="!px-0" onClick={() => setOpen(true)}>
        Publish
      </Button>
      <Modal
        title={`Publish ${product.name}?`}
        open={open}
        okText="Publish"
        okButtonProps={{ disabled: reason.trim().length < 3 }}
        confirmLoading={loading}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          setLoading(true)
          try {
            await onPublish(reason.trim())
            setOpen(false)
            setReason('')
          } finally {
            setLoading(false)
          }
        }}
      >
        <p>This creates an immutable release and starts one storefront build.</p>
        <Input.TextArea
          value={reason}
          rows={3}
          maxLength={500}
          placeholder="Publication reason"
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </>
  )
}

type CatalogSearchValues = {
  query?: string
  status?: ProductStatus
}

const toFilters = (values: CatalogSearchValues): CatalogListFilters => ({
  query: values.query?.trim() || undefined,
  status: values.status,
})

export const CatalogListPage = () => {
  const { role, permissions } = useAuth()
  const canWrite = hasPermission(role, 'catalog.write', permissions)
  const canPublish = hasPermission(role, 'catalog.publish', permissions)

  const filters = useMemo<TemplateListFilterField<CatalogSearchValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: 'Product',
        inputProps: { placeholder: 'Search name or slug' },
      },
      {
        type: 'select',
        name: 'status',
        label: 'Status',
        selectProps: { allowClear: true, placeholder: 'All statuses' },
        options: Object.entries(statusStyle).map(([value, item]) => ({
          label: item.label,
          value,
        })),
      },
    ],
    []
  )

  const handlePublish = useCallback(async (product: CatalogProductListItem, reason: string, reload: () => Promise<void>) => {
    try {
      const release = await publishCatalogProduct(product.id, reason)
      void message.success(`Build started: ${release.buildCorrelationId}`)
      await reload()
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    }
  }, [])

  const handlePreview = useCallback(async (product: CatalogProductListItem) => {
    try {
      const preview = await previewCatalogProduct(product.id)
      const origin = import.meta.env.PUBLIC_STOREFRONT_ORIGIN?.replace(/\/$/, '') ?? ''
      window.open(`${origin}/preview?token=${encodeURIComponent(preview.token)}`, '_blank', 'noopener')
    } catch (error) {
      void message.error(normalizeApiError(error).message)
    }
  }, [])

  const spec = useMemo<
    StandardListPageSpec<
      CatalogSearchValues,
      CatalogListFilters,
      CatalogListResponse,
      CatalogProductListItem,
      ApiError
    >
  >(
    () => ({
      pageTitle: 'Catalog',
      cardTitle: 'Products',
      tableId: 'catalog-products',
      formRoute: '/catalog/products/form',
      initialFilters: {},
      toFilters,
      buildRequestFilters: ({ filters: submitted, current, pageSize }) => ({
        ...submitted,
        page: current,
        pageSize,
      }),
      request: fetchCatalogProducts,
      selectItems: (response) => response?.data ?? [],
      mapError: normalizeApiError,
      filterFields: filters,
      buildColumns: ({ openFormPage, reload }) => [
        {
          key: 'name',
          title: 'Product',
          dataIndex: 'name',
          width: 240,
          render: (value: string, record) => (
            <Button type="link" className="!p-0" onClick={() => openFormPage('readonly', record.id)}>
              {value}
            </Button>
          ),
        },
        { key: 'slug', title: 'Slug', dataIndex: 'slug', width: 220 },
        {
          key: 'status',
          title: 'Status',
          dataIndex: 'status',
          width: 120,
          render: (value: ProductStatus) => (
            <Tag color={statusStyle[value].color}>{statusStyle[value].label}</Tag>
          ),
        },
        {
          key: 'updatedAt',
          title: 'Updated',
          dataIndex: 'updated_at',
          width: 180,
          render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        },
        {
          key: 'buildStatus',
          title: 'Build',
          dataIndex: 'build_status',
          width: 150,
          render: (value: string | null, record) =>
            value ? (
              <Tag title={record.build_correlation_id ?? undefined}>{value}</Tag>
            ) : (
              <span>—</span>
            ),
        },
        {
          key: 'action',
          title: 'Actions',
          width: ACTION_COLUMN_WIDTH,
          render: (_, record) => (
            <ListRowActions
              actions={[
                {
                  key: 'view',
                  label: 'View',
                  onClick: () => openFormPage('readonly', record.id),
                },
                {
                  key: 'preview',
                  label: 'Preview',
                  onClick: () => handlePreview(record),
                },
                {
                  key: 'edit',
                  label: 'Edit',
                  visible: canWrite && record.status !== 'published',
                  onClick: () => openFormPage('modify', record.id),
                },
                {
                  key: 'publish',
                  label: 'Publish',
                  visible: canPublish && record.status !== 'published',
                  render: (
                    <PublishAction
                      product={record}
                      onPublish={(reason) => handlePublish(record, reason, reload)}
                    />
                  ),
                },
              ]}
            />
          ),
        },
      ],
      buildTableNode: ({
        columns,
        dataSource,
        loading,
        tableSize,
        pagination,
        tableClassName,
        virtualScroll,
      }) => (
        <Table<CatalogProductListItem>
          className={tableClassName}
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          size={tableSize}
          pagination={pagination}
          virtual={virtualScroll.enabled}
          scroll={virtualScroll.enabled ? virtualScroll.scroll : undefined}
        />
      ),
      createAction: {
        label: 'New product',
        permission: 'catalog.write',
      },
      stateCopy: {
        errorTitle: 'Catalog could not be loaded',
        emptyTitle: 'No products match these filters',
        emptyDescription: 'Reset the filters or create the first product.',
      },
    }),
    [canPublish, canWrite, filters, handlePreview, handlePublish]
  )

  return <StandardListPageRecipe spec={spec} />
}
