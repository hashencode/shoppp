import React, { useCallback, useMemo } from 'react'
import { Button, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  fetchContentList,
  type ContentArticleRecord,
  type ContentKind,
  type ContentPageRecord,
} from '../../services/content/api'
import { ListRowActions } from '../../shared/components/list-row-actions'
import { useI18n } from '../../shared/contexts/i18n-context'
import { localizeApiError } from '../../shared/i18n/api-error'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'
import { useCrudFormNavigation } from '../../shared/template-kit/hooks'

void React

type ContentRecord = ContentPageRecord | ContentArticleRecord
type SearchValues = { query?: string; status?: ContentRecord['status'] }
type Filters = SearchValues & { page?: number; pageSize?: number }
type Response = { data: ContentRecord[]; total: number }

const buildRequestFilters = ({ current, filters, pageSize }: {
  current: number
  filters: SearchValues
  pageSize: number
}): Filters => ({ ...filters, page: current, pageSize })

const toFilters = (values: SearchValues): Filters => ({
  query: values.query?.trim() || undefined,
  status: values.status,
})

const statusColor: Record<ContentRecord['status'], string> = {
  archived: 'warning',
  draft: 'default',
  published: 'success',
}
const statusLabel: Record<ContentRecord['status'], 'Archived' | 'Draft' | 'Published'> = {
  archived: 'Archived',
  draft: 'Draft',
  published: 'Published',
}

const ContentList = ({ kind }: { kind: ContentKind }) => {
  const { t } = useI18n()
  const { permissions, role } = useAuth()
  const canWrite = hasPermission(role, 'content.write', permissions)
  const canPublish = hasPermission(role, 'content.publish', permissions)
  const label = kind === 'page' ? t('Pages') : t('Articles')
  const formRoute = `/content/${kind === 'page' ? 'pages' : 'articles'}/form`
  const fields = useMemo<TemplateListFilterField<SearchValues>[]>(
    () => [
      {
        inputProps: { placeholder: t('Search title or slug') },
        label: t('Content'),
        name: 'query',
        type: 'input',
      },
      {
        label: t('Status'),
        name: 'status',
        options: (['draft', 'published', 'archived'] as const).map((value) => ({
          label: t(statusLabel[value]),
          value,
        })),
        selectProps: { allowClear: true, placeholder: t('All statuses') },
        type: 'select',
      },
    ],
    [t]
  )
  const { openFormPage } = useCrudFormNavigation(formRoute)
  const request = useCallback((filters: Filters) => fetchContentList(kind, filters), [kind])
  const mapError = useCallback((error: unknown) => {
    const normalized = normalizeApiError(error)
    normalized.message = localizeApiError(normalized, t)
    return normalized
  }, [t])
  const spec = useMemo<
    StandardListPageSpec<SearchValues, Filters, Response, ContentRecord, ApiError>
  >(
    () => ({
      buildColumns: ({ openFormPage: open, resolveActionColumnLayout }) => {
        const actionLayout = resolveActionColumnLayout([[58], [58, 58], [58, 58, 70]])
        return [
          {
            dataIndex: 'title',
            key: 'title',
            title: t('Title'),
            width: 240,
            render: (title: string, record) => (
              <Button type="link" className="!p-0" onClick={() => open('readonly', record.id)}>
                {title}
              </Button>
            ),
          },
          { dataIndex: 'slug', key: 'slug', title: t('Slug'), width: 200 },
          { dataIndex: 'route', key: 'route', title: t('Storefront route'), width: 260 },
          {
            dataIndex: 'status',
            key: 'status',
            title: t('Release state'),
            width: 290,
            render: (status: ContentRecord['status'], record) => (
              <Space wrap size={[4, 4]}>
                <Tag color={statusColor[status]}>{t(statusLabel[status])}</Tag>
                <Tag>{t('Saved v{version}', { version: record.version })}</Tag>
                <Tag color={record.inclusion.candidate ? 'blue' : 'default'}>
                  {t(record.inclusion.candidate ? 'Candidate included' : record.inclusion.candidateStale ? 'Candidate stale: saved version is newer' : 'Not in candidate')}
                </Tag>
                <Tag color={record.inclusion.live ? 'green' : 'default'}>
                  {t(record.inclusion.live ? 'Live included' : record.inclusion.liveStale ? 'Live stale: saved version is newer' : 'Not live')}
                </Tag>
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
                    onClick: () => open('readonly', record.id),
                    visible: canPublish && record.status === 'draft',
                  },
                ]}
              />
            ),
          },
        ]
      },
      buildRequestFilters,
      buildTableNode: ({ columns, dataSource, loading, pagination, tableClassName, tableSize }) => (
        <Table<ContentRecord>
          className={tableClassName}
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={pagination}
          rowKey="id"
          size={tableSize}
        />
      ),
      cardTitle: label,
      createAction: {
        label: kind === 'page' ? t('New page') : t('New article'),
        permission: 'content.write',
      },
      filterFields: fields,
      formRoute,
      initialFilters: {},
      mapError,
      openFormPage,
      pageTitle: label,
      pagination: { includeAllDataOption: false, maxPageSize: 100 },
      request,
      selectItems: (response) => response?.data ?? [],
      stateCopy: {
        emptyDescription: t('Reset the filters or create the first record.'),
        emptyTitle: t('No content matches these filters'),
        errorTitle: t('Content could not be loaded'),
      },
      tableId: `content-${kind}s`,
      toFilters,
    }),
    [canPublish, canWrite, fields, formRoute, kind, label, mapError, openFormPage, request, t]
  )
  return <StandardListPageRecipe spec={spec} />
}

export const ContentPagesListPage = () => <ContentList kind="page" />
export const ContentArticlesListPage = () => <ContentList kind="article" />
