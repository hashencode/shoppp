import type { AdminPermission, AdminRole } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Modal, Space, Table, Tag, App } from 'antd'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { createAdminRole, fetchAdminRoles } from '../../services/iam/api'
import { PermissionChecklist } from './permission-checklist'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

type RoleValues = {
  description?: string
  key: string
  name: string
  permissions: AdminPermission[]
}

export const RolesPage = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { permissions, role: roleKey } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.roles.write', permissions)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<RoleValues>()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminRoles({ page, pageSize: 25, search: search || undefined })
      setRoles(result.items)
      setTotal(result.total)
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const columns = useMemo(
    () => [
      {
        key: 'role',
        title: t('Role'),
        render: (_: unknown, role: AdminRole) => (
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
        render: (_: unknown, role: AdminRole) => role.permissions.length,
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: 100,
        render: (_: unknown, role: AdminRole) => (
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
    [navigate, t]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('Roles')}</h1>
          <p className="text-slate-500">
            {t('Role permissions are authoritative on each protected API request.')}
          </p>
        </div>
        {canWrite ? (
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
        ) : null}
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => void load()}>{t('Retry')}</Button>}
        />
      ) : null}
      <Input.Search
        allowClear
        aria-label={t('Search roles')}
        placeholder={t('Search by role name or key')}
        onSearch={(value) => {
          setSearch(value.trim())
          setPage(1)
        }}
      />
      <Table<AdminRole>
        rowKey="id"
        columns={columns}
        dataSource={roles}
        loading={loading}
        locale={{ emptyText: t('No roles match these filters.') }}
        pagination={{ current: page, pageSize: 25, total, onChange: setPage }}
        scroll={{ x: 720 }}
      />

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
              await load()
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
            <PermissionChecklist permitted={permissions ?? []} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
