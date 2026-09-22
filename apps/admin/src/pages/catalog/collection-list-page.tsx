import React, { useCallback, useMemo } from 'react'
import { Alert, Button, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchCatalogCollections,
  type CatalogCollection,
} from '../../services/catalog/api'
import { ListRowActions } from '../../shared/components/list-row-actions'
import { useI18n } from '../../shared/contexts/i18n-context'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'

void React

type SearchValues = { query?: string; status?: CatalogCollection['status'] }
type RequestFilters = SearchValues & { page?: number; pageSize?: number; productId?: string }
type Response = { data: CatalogCollection[]; total: number }

const statusStyle: Record<CatalogCollection['status'], { color: string; label: string }> = {
  draft: { color: 'default', label: 'Draft' },
  published: { color: 'success', label: 'Published' },
  archived: { color: 'warning', label: 'Archived' },
}

export const CollectionListPage = () => {
  const { t } = useI18n()
  const { role, permissions } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const handoffProductId = searchParams.get('handoffProductId') || undefined
  const showAll = searchParams.get('show') === 'all'
  const returnTo = searchParams.get('returnTo') || undefined
  const canWrite = hasPermission(role, 'catalog.write', permissions)
  const canPublish = hasPermission(role, 'catalog.publish', permissions)
  const fields = useMemo<TemplateListFilterField<SearchValues>[]>(
    () => [
      {
        inputProps: { placeholder: t('Search name or slug') },
        label: t('Collection'),
        name: 'query',
        type: 'input',
      },
      {
        label: t('Status'),
        name: 'status',
        options: Object.entries(statusStyle).map(([value, item]) => ({
          label: t(item.label),
          value,
        })),
        selectProps: { allowClear: true, placeholder: t('All statuses') },
        type: 'select',
      },
    ],
    [t]
  )
  const openFormPage = useCallback(
    (mode: 'add' | 'modify' | 'readonly', id?: string) => {
      const params = new URLSearchParams({ mode })
      if (id) params.set('id', id)
      if (handoffProductId) params.set('handoffProductId', handoffProductId)
      if (returnTo) params.set('returnTo', returnTo)
      navigate(`/catalog/collections/form?${params.toString()}`)
    },
    [handoffProductId, navigate, returnTo]
  )
  const spec = useMemo<
    StandardListPageSpec<SearchValues, RequestFilters, Response, CatalogCollection, ApiError>
  >(
    () => ({
      buildColumns: ({ openFormPage: open, resolveActionColumnLayout }) => {
        const actionLayout = resolveActionColumnLayout([[58], [58, 58], [58, 58, 70]])
        return [
          {
            dataIndex: 'name',
            key: 'name',
            title: t('Collection'),
            width: 220,
            render: (value: string, record) => (
              <Button type="link" className="!p-0" onClick={() => open('readonly', record.id)}>
                {value}
              </Button>
            ),
          },
          { dataIndex: 'slug', key: 'slug', title: t('Slug'), width: 210 },
          {
            key: 'products',
            title: t('Products'),
            width: 220,
            render: (_, record) =>
              record.products.length ? record.products.map(({ name }) => name).join(', ') : '—',
          },
          {
            dataIndex: 'status',
            key: 'status',
            title: t('Release state'),
            width: 260,
            render: (status: CatalogCollection['status'], record) => (
              <Space wrap size={[4, 4]}>
                <Tag color={statusStyle[status].color}>{t(statusStyle[status].label)}</Tag>
                <Tag>{t('Saved v{version}', { version: record.version })}</Tag>
                {record.candidate.candidateReleaseId ? (
                  <Tag color="blue">
                    {t('Candidate included')} · {record.candidate.candidateDigest?.slice(0, 8)}
                  </Tag>
                ) : record.candidate.candidateStaleCause ? (
                  <Tag color="orange">{t('Candidate stale: saved version is newer')}</Tag>
                ) : (
                  <Tag>{t('Not in candidate')}</Tag>
                )}
                {record.candidate.liveReleaseId ? (
                  <Tag color="green">
                    {t('Live included')} · {record.candidate.liveDigest?.slice(0, 8)}
                  </Tag>
                ) : record.candidate.liveStaleCause ? (
                  <Tag color="orange">{t('Live stale: saved version is newer')}</Tag>
                ) : (
                  <Tag>{t('Not live')}</Tag>
                )}
              </Space>
            ),
          },
          {
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            title: t('Updated'),
            width: 180,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
          },
          {
            key: 'actions',
            title: t('Actions'),
            width: actionLayout.columnWidth,
            render: (_, record) => (
              <ListRowActions
                layoutMode={actionLayout.mode}
                maxRowContentWidth={actionLayout.maxRowContentWidth}
                actions={[
                  {
                    contentWidth: 58,
                    key: 'view',
                    label: t('View'),
                    onClick: () => open('readonly', record.id),
                  },
                  {
                    contentWidth: 58,
                    key: 'edit',
                    label: t('Edit'),
                    onClick: () => open('modify', record.id),
                    visible: canWrite,
                  },
                  {
                    contentWidth: 70,
                    key: 'publish',
                    label: t('Publish'),
                    onClick: () => open('modify', record.id),
                    visible: canWrite && canPublish && record.status === 'draft',
                  },
                ]}
              />
            ),
          },
        ]
      },
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        page: current,
        pageSize,
        productId: showAll ? undefined : handoffProductId,
      }),
      buildTableNode: ({ columns, dataSource, loading, pagination, tableClassName, tableSize }) => (
        <Table<CatalogCollection>
          className={tableClassName}
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={pagination}
          rowKey="id"
          size={tableSize}
        />
      ),
      cardTitle:
        handoffProductId && !showAll
          ? t('Collections containing this Product')
          : t('Collections'),
      createAction: { label: t('New collection'), permission: 'catalog.write' },
      filterFields: fields,
      formRoute: '/catalog/collections/form',
      initialFilters: {},
      mapError: normalizeApiError,
      openFormPage,
      pageTitle: t('Collections'),
      pagination: { includeAllDataOption: false, maxPageSize: 100 },
      request: fetchCatalogCollections,
      renderBeforeFilter: handoffProductId ? (
        <Alert
          type="info"
          title={
            showAll
              ? t('Choose any Collection to add the selected Product')
              : t('Showing Collections that contain the selected Product')
          }
          action={
            <Button
              onClick={() => {
                const params = new URLSearchParams({ handoffProductId })
                if (returnTo) params.set('returnTo', returnTo)
                if (!showAll) params.set('show', 'all')
                navigate(`/catalog/collections?${params.toString()}`)
              }}
            >
              {t(showAll ? 'Show matching Collections' : 'Show all Collections')}
            </Button>
          }
        />
      ) : undefined,
      selectItems: (response) => response?.data ?? [],
      stateCopy: {
        emptyDescription: t('Reset the filters or create the first Collection.'),
        emptyTitle: t('No Collections match these filters'),
        errorTitle: t('Collections could not be loaded'),
      },
      tableId: 'catalog-collections',
      toFilters: (values) => ({
        productId: showAll ? undefined : handoffProductId,
        query: values.query?.trim() || undefined,
        status: values.status,
      }),
    }),
    [canPublish, canWrite, fields, handoffProductId, navigate, openFormPage, returnTo, showAll, t]
  )
  return <StandardListPageRecipe spec={spec} />
}
