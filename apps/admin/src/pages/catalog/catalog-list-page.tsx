import { Button, Input, Modal, Table, Tag, App } from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import React, { useCallback, useMemo, useState } from 'react'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchCatalogProducts,
  publishCatalogProduct,
  type CatalogListFilters,
  type CatalogListResponse,
  type CatalogProductListItem,
  type ProductStatus,
} from '../../services/catalog/api'
import { ListRowActions } from '../../shared/components/list-row-actions'
import { useCurrentTranslate, useI18n } from '../../shared/contexts/i18n-context'
import { useLocalizedApiError } from '../../shared/i18n/api-error'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'

import { useFormDialog } from '../../shared/hooks/use-form-dialog'

void React

// Budget the longest localized labels for every visible action combination.
const ACTION_CONTENT_WIDTHS = { view: 58, edit: 58, publish: 58 } as const
const ACTION_LAYOUT_COMBINATIONS = [
  [ACTION_CONTENT_WIDTHS.view],
  [ACTION_CONTENT_WIDTHS.view, ACTION_CONTENT_WIDTHS.edit, ACTION_CONTENT_WIDTHS.publish],
] as const

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
  onPublish: (reason: string) => Promise<boolean>
}) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const dialog = useFormDialog({
    open,
    onClose: () => {
      setOpen(false)
      setReason('')
    },
    getSubmission: () => reason.trim(),
  })
  return (
    <>
      <Button type="link" className="!px-0" onClick={() => setOpen(true)}>
        {t('Publish')}
      </Button>
      <Modal
        title={t('Publish {name}?', { name: product.name })}
        open={open}
        okText={t('Publish')}
        okButtonProps={{ disabled: reason.trim().length < 3 }}
        confirmLoading={dialog.busy}
        onCancel={dialog.requestClose}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !dialog.busy }}
        keyboard={!dialog.busy}
        onOk={() =>
          void dialog.submit(async () => {
            if (reason.trim().length < 3) return

            const saved = await onPublish(reason.trim())
            if (!saved || !dialog.isCurrent()) return
            dialog.complete()
          })
        }
      >
        <p>
          {t('Publishing starts a public storefront build. Changes appear only after deployment.')}
        </p>
        <Input.TextArea
          value={reason}
          disabled={dialog.busy}
          rows={3}
          maxLength={500}
          placeholder={t('Publication reason')}
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
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromSetupGuide = searchParams.get('from') === 'setup-guide'
  const { role, permissions } = useAuth()
  const { t } = useI18n()
  const translateNow = useCurrentTranslate()
  const localizeError = useLocalizedApiError()
  const canWrite = hasPermission(role, 'catalog.write', permissions)
  const canPublish = hasPermission(role, 'catalog.publish', permissions)

  const filters = useMemo<TemplateListFilterField<CatalogSearchValues>[]>(
    () => [
      {
        type: 'input',
        name: 'query',
        label: t('Product'),
        inputProps: { placeholder: t('Search name or slug') },
      },
      {
        type: 'select',
        name: 'status',
        label: t('Status'),
        selectProps: { allowClear: true, placeholder: t('All statuses') },
        options: Object.entries(statusStyle).map(([value, item]) => ({
          label: t(item.label),
          value,
        })),
      },
    ],
    [t]
  )

  const handlePublish = useCallback(
    async (product: CatalogProductListItem, reason: string, reload: () => Promise<void>) => {
      try {
        await publishCatalogProduct(product.id, reason, product.version)
        void message.success(
          translateNow('Product publication started. The storefront changes after deployment.')
        )
      } catch (error) {
        void message.error(localizeError(error))
        return false
      }
      void reload().catch(() => undefined)
      return true
    },
    [message, localizeError, translateNow]
  )

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
      pageTitle: t('Catalog'),
      cardTitle: t('Products'),
      tableId: 'catalog-products',
      formRoute: '/catalog/products/form',
      // The setup journey stays in this tab; ordinary list navigation retains its default.
      openFormPage: fromSetupGuide
        ? (mode, id) => {
            const params = new URLSearchParams({ mode, from: 'setup-guide' })
            if (id) params.set('id', id)
            navigate(`/catalog/products/form?${params.toString()}`)
          }
        : undefined,
      initialFilters: {},
      pagination: { includeAllDataOption: false, maxPageSize: 100 },
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
      buildColumns: ({ openFormPage, reload, resolveActionColumnLayout }) => {
        const actionLayout = resolveActionColumnLayout(ACTION_LAYOUT_COMBINATIONS)
        return [
          {
            key: 'name',
            title: t('Product'),
            dataIndex: 'name',
            width: 240,
            render: (value: string, record) => (
              <Button
                type="link"
                className="!p-0"
                onClick={() => openFormPage('readonly', record.id)}
              >
                {value}
              </Button>
            ),
          },
          { key: 'slug', title: t('Slug'), dataIndex: 'slug', width: 220 },
          {
            key: 'status',
            title: t('Status'),
            dataIndex: 'status',
            width: 120,
            render: (value: ProductStatus) => (
              <Tag color={statusStyle[value].color}>{t(statusStyle[value].label)}</Tag>
            ),
          },
          {
            key: 'updatedAt',
            title: t('Updated'),
            dataIndex: 'updated_at',
            width: 180,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
          },
          {
            key: 'buildStatus',
            title: t('Build'),
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
            title: t('Actions'),
            width: actionLayout.columnWidth,
            render: (_, record) => (
              <ListRowActions
                layoutMode={actionLayout.mode}
                maxRowContentWidth={actionLayout.maxRowContentWidth}
                actions={[
                  {
                    key: 'view',
                    label: t('View'),
                    contentWidth: ACTION_CONTENT_WIDTHS.view,
                    onClick: () => openFormPage('readonly', record.id),
                  },
                  {
                    key: 'edit',
                    label: t('Edit'),
                    contentWidth: ACTION_CONTENT_WIDTHS.edit,
                    visible: canWrite && record.status !== 'published',
                    onClick: () => openFormPage('modify', record.id),
                  },
                  {
                    key: 'publish',
                    label: t('Publish'),
                    contentWidth: ACTION_CONTENT_WIDTHS.publish,
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
        ]
      },
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
        label: t('New product'),
        permission: 'catalog.write',
      },
      stateCopy: {
        errorTitle: t('Catalog could not be loaded'),
        emptyTitle: t('No products match these filters'),
        emptyDescription: t('Reset the filters or create the first product.'),
      },
    }),
    [canPublish, canWrite, filters, fromSetupGuide, handlePublish, navigate, t]
  )

  return <StandardListPageRecipe spec={spec} />
}
