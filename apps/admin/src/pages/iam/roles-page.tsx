import type { AdminPermission, AdminRole } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Modal, Space, Table, Tag, App } from 'antd'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

type RoleListFilters = {
  page?: number
  pageSize?: number
  search?: string
}

const toFilters = (values: RoleSearchValues): RoleListFilters => ({
  search: values.search?.trim() || undefined,
})

const CreateRoleAction = ({
  permitted,
  reload,
}: {
  permitted: readonly AdminPermission[]
  reload: () => Promise<void>
}) => {
  const { message } = App.useApp()
  const { t } = useI18n()
  const [createError, setCreateError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<RoleValues>()

  return (
    <>
      <Button
        type="primary"
        onClick={() => {
          form.resetFields()
          form.setFieldValue('permissions', [])
          setCreateError(null)
          setOpen(true)
        }}
      >
        {t('New role')}
      </Button>
      <Modal
        title={t('New role')}
        open={open}
        okText={t('Create role')}
        confirmLoading={saving}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        width={820}
        destroyOnHidden
        forceRender
      >
        {createError ? <Alert className="mb-4" type="error" showIcon title={createError} /> : null}
        <Form<RoleValues>
          form={form}
          layout="vertical"
          initialValues={{ permissions: [] }}
          onFinish={async (values) => {
            setSaving(true)
            setCreateError(null)
            try {
              await createAdminRole({
                description: values.description?.trim() || null,
                key: values.key.trim(),
                name: values.name.trim(),
                permissions: values.permissions,
              })
              void message.success(t('Role created.'))
              setOpen(false)
              await reload()
            } catch (cause) {
              setCreateError(normalizeApiError(cause).message)
            } finally {
              setSaving(false)
            }
          }}
        >
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
        </Form>
      </Modal>
    </>
  )
}

export const RolesPage = () => {
  const navigate = useNavigate()
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
      buildRequestFilters: ({ filters, current, pageSize }) => ({
        ...filters,
        page: current,
        pageSize,
      }),
      request: fetchAdminRoles,
      selectItems: (response) => response?.items ?? [],
      mapError: normalizeApiError,
      filterFields,
      renderBeforeFilter: (
        <p className="text-slate-500">
          {t('Role permissions are authoritative on each protected API request.')}
        </p>
      ),
      toolbarExtra: ({ reload }) =>
        canWrite ? <CreateRoleAction permitted={permissions ?? []} reload={reload} /> : null,
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
            <Button
              type="link"
              className="!px-0"
              onClick={() => navigate(`/access/roles/${role.id}`)}
            >
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
    [canWrite, filterFields, navigate, permissions, t]
  )

  return <StandardListPageRecipe spec={spec} />
}
