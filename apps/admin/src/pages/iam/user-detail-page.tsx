import type { AdminRole, AdminUser } from '@shoppp/contracts'
import { Alert, Button, Card, Descriptions, Form, Input, Select, Space, Spin, Tag, App } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchAdminRoles, fetchAdminUser, updateAdminUser } from '../../services/iam/api'
import { useI18n } from '../../shared/contexts/i18n-context'

void React

type UserValues = { displayName: string; roleId: string; status: 'active' | 'disabled' }

const invariantMessage = (code: string, fallback: string, t: (message: string) => string) => {
  if (code === 'last_admin_change_denied')
    return t(
      'This is the last enabled protected administrator. Create or enable another administrator first.'
    )
  if (code === 'self_user_change_denied') return t('You cannot change your own role or status.')
  if (code === 'protected_admin_change_denied')
    return t('Only a protected administrator can change this administrator.')
  return fallback
}

export const UserDetailPage = () => {
  const { message, modal } = App.useApp()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { permissions, role: roleKey, session } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.users.write', permissions)
  const canReadRoles = hasPermission(roleKey, 'iam.roles.read', permissions)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm<UserValues>()

  const isSelf = session?.identityId === id

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextUser, rolePage] = await Promise.all([
        fetchAdminUser(id),
        canReadRoles ? fetchAdminRoles({ page: 1, pageSize: 100 }) : Promise.resolve(null),
      ])
      setUser(nextUser)
      setRoles(rolePage?.items ?? [])
    } catch (cause) {
      setError(normalizeApiError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [canReadRoles, id])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!user) return
    form.setFieldsValue({
      displayName: user.displayName,
      roleId: user.role.id,
      status: user.status,
    })
  }, [form, user])

  const assignableRoles = roles.filter(
    (candidate) =>
      candidate.enabled &&
      (!candidate.protected || session?.role.protected === true) &&
      candidate.permissions.every((permission) => permissions?.includes(permission))
  )

  const save = async (values: UserValues) => {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminUser(user.id, {
        displayName: values.displayName.trim(),
        enabled: values.status === 'active',
        expectedVersion: user.version,
        ...(values.roleId !== user.role.id ? { roleId: values.roleId } : {}),
      })
      setUser(updated)
      form.setFieldsValue({
        displayName: updated.displayName,
        roleId: updated.role.id,
        status: updated.status,
      })
      void message.success(t('User access updated.'))
    } catch (cause) {
      const apiError = normalizeApiError(cause)
      if (apiError.code === 'stale_user_version') {
        await load()
        setError(
          t(
            'This user changed by another administrator. The latest state has been loaded; review it before retrying.'
          )
        )
      } else {
        setError(invariantMessage(apiError.code, apiError.message, t))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading && !user) return <Spin description={t('Loading user')} />

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{user?.displayName ?? t('User access')}</h1>
          <p className="text-slate-500">
            {t('Inspect and update the application role for this human identity.')}
          </p>
        </div>
        <Button onClick={() => navigate('/access/users')}>{t('Back to users')}</Button>
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => void load()}>{t('Reload')}</Button>}
        />
      ) : null}
      {isSelf ? (
        <Alert type="info" showIcon title={t('You cannot change your own role or status.')} />
      ) : null}
      {canWrite && !canReadRoles ? (
        <Alert
          type="info"
          showIcon
          title={t(
            "Role visibility is not granted. You can update this user's display name or status, but not their role."
          )}
        />
      ) : null}
      {user?.status === 'active' && user.role.protected && !isSelf ? (
        <Alert
          type="warning"
          showIcon
          title={t(
            'Disabling or demoting this protected administrator will be rejected if it would leave no enabled protected administrator.'
          )}
        />
      ) : null}
      {user ? (
        <Card>
          <Descriptions className="mb-6" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label={t('Email')}>{user.email}</Descriptions.Item>
            <Descriptions.Item label={t('State')}>
              <Tag color={user.status === 'active' ? 'success' : 'default'}>
                {t(user.status === 'active' ? 'Active' : 'Disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('Version')}>{user.version}</Descriptions.Item>
            <Descriptions.Item label={t('Updated')}>
              {new Date(user.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
          <Form<UserValues>
            form={form}
            layout="vertical"
            disabled={!canWrite || isSelf}
            onFinish={(values) => {
              const isPrivilegeChange =
                values.roleId !== user.role.id || values.status !== user.status
              if (!isPrivilegeChange) {
                void save(values)
                return
              }
              modal.confirm({
                title: t('Confirm access change'),
                content: t('Role and status changes take effect on the user’s next API request.'),
                okText: t('Confirm change'),
                okButtonProps: { danger: values.status === 'disabled' },
                onOk: () => save(values),
              })
            }}
          >
            <Form.Item name="displayName" label={t('Display name')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="roleId" label={t('Role')} rules={[{ required: true }]}>
              <Select
                disabled={!canReadRoles}
                options={(canReadRoles ? assignableRoles : [user.role]).map((role) => ({
                  label: role.name,
                  value: role.id,
                }))}
              />
            </Form.Item>
            <Form.Item name="status" label={t('Status')} rules={[{ required: true }]}>
              <Select
                options={[
                  { label: t('Active'), value: 'active' },
                  { label: t('Disabled'), value: 'disabled' },
                ]}
              />
            </Form.Item>
            {canWrite ? (
              <Space>
                <Button type="primary" htmlType="submit" loading={saving} disabled={isSelf}>
                  {t('Save changes')}
                </Button>
                <Button onClick={() => form.resetFields()} disabled={isSelf}>
                  {t('Reset')}
                </Button>
              </Space>
            ) : null}
          </Form>
        </Card>
      ) : null}
    </div>
  )
}
