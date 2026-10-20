import type { AdminPermission, AdminRole } from '@shoppp/contracts'
import { Button, Form, Input, Space, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { createAdminRole, fetchAdminRoles, type IamPage } from '../../services/iam/api'
import { useI18n } from '../../shared/contexts/i18n-context'
import {
  StandardListPageRecipe,
  type StandardListPageSpec,
  type TemplateListFilterField,
} from '../../shared/template-kit/list'
import { PermissionChecklist } from './permission-checklist'
import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'
import { RoleDetailPage } from './role-detail-page'

void React

type RoleValues = {
  description?: string
  key: string
  name: string
  permissions: AdminPermission[]
}

type RoleSearchValues = {
  search?: string
}

type RoleListFilters = NonNullable<Parameters<typeof fetchAdminRoles>[0]>

const toFilters = (values: RoleSearchValues): RoleListFilters => ({
  search: values.search?.trim() || undefined,
})

const buildRoleRequestFilters: StandardListPageSpec<
  RoleSearchValues,
  RoleListFilters,
  IamPage<AdminRole>,
  AdminRole,
  ApiError
>['buildRequestFilters'] = ({ filters, current, pageSize }) => ({
  ...filters,
  page: current,
  pageSize,
})

const CreateRoleAction = ({
  permitted,
  reload,
}: {
  permitted: readonly AdminPermission[]
  reload: () => Promise<void>
}) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<RoleValues>()
  const toPayload = (values: RoleValues) => ({
    description: values.description?.trim() || null,
    key: values.key?.trim() || '',
    name: values.name?.trim() || '',
    permissions: [...(values.permissions ?? [])].sort(),
  })
  return (
    <>
      <Button
        type="primary"
        disabled={open}
        onClick={() => {
          if (open) return
          form.resetFields()
          setOpen(true)
        }}
      >
        {t('New role')}
      </Button>
      {open ? (
        <CrudFormDrawerRecipe<RoleValues>
          spec={{
            title: t('New role'),
            successTitle: t('Role created.'),
            parsedMode: { ok: true, mode: 'add' },
            permissionDenied: false,
            detailLoading: false,
            detailError: null,
            saveLoading: false,
            isReadonly: false,
            form,
            initialValues: { permissions: [] },
            onRetryDetail: () => undefined,
            onResetAll: () => form.resetFields(),
            hasUnsavedChanges: () =>
              JSON.stringify(toPayload(form.getFieldsValue(true))) !==
              JSON.stringify(toPayload({ key: '', name: '', permissions: [] })),
            onClose: () => setOpen(false),
            onSaved: reload,
            onSubmit: async (values) => {
              try {
                await createAdminRole(toPayload(values))
                return { success: true }
              } catch (cause) {
                return { success: false, error: normalizeApiError(cause) }
              }
            },
            renderFields: () => (
              <>
                <Form.Item
                  name="key"
                  label={t('Role key')}
                  rules={[
                    { required: true },
                    {
                      pattern: /^[a-z][a-z0-9_]*$/,
                      message: t('Use lowercase letters, numbers, and underscores.'),
                    },
                  ]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item name="name" label={t('Role name')} rules={[{ required: true }]}>
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item name="description" label={t('Description')}>
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="permissions" label={t('Permissions')}>
                  <PermissionChecklist permitted={permitted} />
                </Form.Item>
              </>
            ),
          }}
        />
      ) : null}
    </>
  )
}

const RoleToolbar = ({
  canWrite,
  permitted,
  reload,
  capture,
}: {
  canWrite: boolean
  permitted: readonly AdminPermission[]
  reload: () => Promise<void>
  capture: React.Dispatch<React.SetStateAction<(() => Promise<void>) | null>>
}) => {
  React.useEffect(() => capture(() => reload), [capture, reload])
  return canWrite ? <CreateRoleAction permitted={permitted} reload={reload} /> : null
}

export const RolesPage = () => {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [reload, setReload] = useState<(() => Promise<void>) | null>(null)
  const { t } = useI18n()
  const { permissions, role: roleKey } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.roles.write', permissions)

  const filterFields = useMemo<TemplateListFilterField<RoleSearchValues>[]>(
    () => [
      {
        type: 'input',
        name: 'search',
        label: t('Role'),
        inputProps: {
          'aria-label': t('Search roles'),
          placeholder: t('Search by role name or key'),
        },
      },
    ],
    [t]
  )

  const spec = useMemo<
    StandardListPageSpec<RoleSearchValues, RoleListFilters, IamPage<AdminRole>, AdminRole, ApiError>
  >(
    () => ({
      pageTitle: t('Roles'),
      cardTitle: t('Roles'),
      tableId: 'iam-roles-list',
      initialFilters: {},
      toFilters,
      pagination: {
        defaultPageSize: 25,
        includeAllDataOption: false,
        maxPageSize: 100,
        pageSizeOptions: [25, 50, 100],
      },
      buildRequestFilters: buildRoleRequestFilters,
      request: fetchAdminRoles,
      selectItems: (response) => response?.items ?? [],
      mapError: normalizeApiError,
      filterFields,
      toolbarExtra: ({ reload }) => (
        <RoleToolbar
          canWrite={canWrite}
          permitted={permissions ?? []}
          reload={reload}
          capture={setReload}
        />
      ),
      toolbarExtraVisible: canWrite,
      buildColumns: () => [
        {
          key: 'role',
          title: t('Role'),
          render: (_: unknown, role) => (
            <div>
              <Space>
                <span className="font-medium">{role.name}</span>
                {role.protected ? <Tag color="gold">{t('Protected')}</Tag> : null}
                {role.system && !role.protected ? <Tag>{t('System role')}</Tag> : null}
                {!role.enabled ? <Tag color="default">{t('Archived')}</Tag> : null}
              </Space>
              <div className="text-sm text-slate-500">{role.key}</div>
            </div>
          ),
        },
        { key: 'description', title: t('Description'), dataIndex: 'description' },
        {
          key: 'permissions',
          title: t('Permissions'),
          render: (_: unknown, role) => role.permissions.length,
        },
        {
          key: 'actions',
          title: t('Actions'),
          width: 100,
          render: (_: unknown, role) => (
            <Button type="link" className="!px-0" onClick={() => setSelectedRoleId(role.id)}>
              {t('Inspect')}
            </Button>
          ),
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
        <Table<AdminRole>
          className={tableClassName}
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          size={tableSize}
          pagination={pagination}
          virtual={virtualScroll.enabled}
          scroll={virtualScroll.enabled ? virtualScroll.scroll : { x: 720 }}
        />
      ),
      stateCopy: {
        errorTitle: t('List could not be loaded'),
        emptyTitle: t('No roles match these filters.'),
        emptyDescription: t('No roles match these filters.'),
      },
    }),
    [canWrite, filterFields, permissions, t]
  )

  return (
    <>
      <StandardListPageRecipe spec={spec} />
      {selectedRoleId ? (
        <RoleDetailPage
          key={selectedRoleId}
          resourceId={selectedRoleId}
          onClose={() =>
            setSelectedRoleId((current) => (current === selectedRoleId ? null : current))
          }
          onSaved={reload ?? (async () => undefined)}
        />
      ) : null}
    </>
  )
}
