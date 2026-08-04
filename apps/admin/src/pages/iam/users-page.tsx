import type { AdminInvitation, AdminInvitationStatus, AdminRole, AdminUser, AdminUserStatus } from '@shoppp/contracts'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import {
  createAdminInvitation,
  fetchAdminInvitations,
  fetchAdminRoles,
  fetchAdminUsers,
  resendAdminInvitation,
  revokeAdminInvitation,
} from '../../services/iam/api'

void React

type InviteValues = { displayName?: string; email: string; roleId: string }

const newIdempotencyKey = (prefix: string) =>
  `${prefix}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-request`}`

const statusTag = (status: AdminUserStatus | AdminInvitationStatus) => {
  const labels = {
    accepted: 'Accepted',
    active: 'Active',
    disabled: 'Disabled',
    expired: 'Expired',
    pending: 'Pending',
    revoked: 'Revoked',
  } as const
  const colors = {
    accepted: 'success',
    active: 'success',
    disabled: 'default',
    expired: 'warning',
    pending: 'processing',
    revoked: 'error',
  } as const
  return <Tag color={colors[status]}>{labels[status]}</Tag>
}

export const UsersPage = () => {
  const navigate = useNavigate()
  const { permissions, role: roleKey, session } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.users.write', permissions)
  const canReadRoles = hasPermission(roleKey, 'iam.roles.read', permissions)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [invitationTotal, setInvitationTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [invitationPage, setInvitationPage] = useState(1)
  const [userStatus, setUserStatus] = useState<AdminUserStatus | undefined>()
  const [invitationStatus, setInvitationStatus] = useState<AdminInvitationStatus | undefined>()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<InviteValues>()
  const inviteKey = useRef(newIdempotencyKey('admin-invite'))

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [userResult, invitationResult, roleResult] = await Promise.all([
        fetchAdminUsers({ page: userPage, pageSize: 25, search: search || undefined, status: userStatus }),
        fetchAdminInvitations({
          page: invitationPage,
          pageSize: 25,
          search: search || undefined,
          status: invitationStatus,
        }),
        canReadRoles ? fetchAdminRoles({ page: 1, pageSize: 100 }) : Promise.resolve(null),
      ])
      setUsers(userResult.items)
      setUserTotal(userResult.total)
      setInvitations(invitationResult.items)
      setInvitationTotal(invitationResult.total)
      setRoles(roleResult?.items ?? [])
    } catch (error) {
      setLoadError(normalizeApiError(error).message)
    } finally {
      setLoading(false)
    }
  }, [canReadRoles, invitationPage, invitationStatus, search, userPage, userStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const assignableRoles = roles.filter(
    (candidate) =>
      candidate.enabled &&
      (!candidate.protected || session?.role.protected === true) &&
      candidate.permissions.every((permission) => permissions?.includes(permission))
  )

  const userColumns = [
    {
      key: 'user',
      title: 'User',
      render: (_: unknown, user: AdminUser) => (
        <div>
          <div className="font-medium">{user.displayName}</div>
          <div className="text-sm text-slate-500">{user.email}</div>
        </div>
      ),
    },
    { key: 'role', title: 'Role', render: (_: unknown, user: AdminUser) => user.role.name },
    { key: 'status', title: 'Status', render: (_: unknown, user: AdminUser) => statusTag(user.status) },
    {
      key: 'actions',
      title: 'Actions',
      width: 100,
      render: (_: unknown, user: AdminUser) => (
        <Button type="link" className="!px-0" onClick={() => navigate(`/access/users/${user.id}`)}>
          Inspect
        </Button>
      ),
    },
  ]

  const invitationColumns = [
    {
      key: 'invitee',
      title: 'Invitee',
      render: (_: unknown, invitation: AdminInvitation) => (
        <div>
          <div className="font-medium">{invitation.displayName ?? 'Pending user'}</div>
          <div className="text-sm text-slate-500">{invitation.email}</div>
        </div>
      ),
    },
    { key: 'role', title: 'Role', render: (_: unknown, invitation: AdminInvitation) => invitation.role.name },
    {
      key: 'expires',
      title: 'Expires',
      render: (_: unknown, invitation: AdminInvitation) => new Date(invitation.expiresAt).toLocaleDateString(),
    },
    {
      key: 'status',
      title: 'Status',
      render: (_: unknown, invitation: AdminInvitation) => statusTag(invitation.status),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 190,
      render: (_: unknown, invitation: AdminInvitation) =>
        canWrite && invitation.status === 'pending' ? (
          <Space>
            <Button
              type="link"
              className="!px-0"
              onClick={async () => {
                try {
                  await resendAdminInvitation(invitation.id, {
                    expectedVersion: invitation.version,
                    idempotencyKey: newIdempotencyKey(`admin-invite-resend-${invitation.id}`),
                  })
                  void message.success('Invitation queued for resend.')
                  await load()
                } catch (error) {
                  void message.error(normalizeApiError(error).message)
                }
              }}
            >
              Resend
            </Button>
            <Popconfirm
              title="Revoke this invitation?"
              description="The invitee will no longer be able to activate it."
              okText="Confirm revoke"
              onConfirm={async () => {
                try {
                  await revokeAdminInvitation(invitation.id, { expectedVersion: invitation.version })
                  void message.success('Invitation revoked.')
                  await load()
                } catch (error) {
                  void message.error(normalizeApiError(error).message)
                }
              }}
            >
              <Button danger type="link" className="!px-0">Revoke</Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users and invitations</h1>
          <p className="text-slate-500">Manage human access. Authentication and passwords remain with the IdP.</p>
        </div>
        {canWrite ? (
          <Button
            type="primary"
            onClick={() => {
              inviteKey.current = newIdempotencyKey('admin-invite')
              setInviteError(null)
              form.resetFields()
              setInviteOpen(true)
            }}
          >
            Invite user
          </Button>
        ) : null}
      </div>

      {loadError ? <Alert type="error" showIcon title={loadError} action={<Button onClick={() => void load()}>Retry</Button>} /> : null}
      <Input.Search
        allowClear
        aria-label="Search users and invitations"
        placeholder="Search by name or email"
        onSearch={(value) => {
          setSearch(value.trim())
          setUserPage(1)
          setInvitationPage(1)
        }}
      />
      <Tabs
        items={[
          {
            key: 'users',
            label: 'Users',
            children: (
              <Space orientation="vertical" className="w-full" size="middle">
                <Select
                  allowClear
                  aria-label="User status"
                  className="min-w-40"
                  placeholder="All user states"
                  options={[{ label: 'Active', value: 'active' }, { label: 'Disabled', value: 'disabled' }]}
                  onChange={(value) => { setUserStatus(value); setUserPage(1) }}
                />
                <Table<AdminUser>
                  rowKey="id"
                  columns={userColumns}
                  dataSource={users}
                  loading={loading}
                  locale={{ emptyText: 'No users match these filters.' }}
                  pagination={{ current: userPage, pageSize: 25, total: userTotal, onChange: setUserPage }}
                  scroll={{ x: 720 }}
                />
              </Space>
            ),
          },
          {
            key: 'invitations',
            label: 'Invitations',
            children: (
              <Space orientation="vertical" className="w-full" size="middle">
                <Select
                  allowClear
                  aria-label="Invitation status"
                  className="min-w-40"
                  placeholder="All invitation states"
                  options={['pending', 'accepted', 'revoked', 'expired'].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value }))}
                  onChange={(value) => { setInvitationStatus(value); setInvitationPage(1) }}
                />
                <Table<AdminInvitation>
                  rowKey="id"
                  columns={invitationColumns}
                  dataSource={invitations}
                  loading={loading}
                  locale={{ emptyText: 'No invitations match these filters.' }}
                  pagination={{ current: invitationPage, pageSize: 25, total: invitationTotal, onChange: setInvitationPage }}
                  scroll={{ x: 860 }}
                />
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Invite user"
        open={inviteOpen}
        okText="Send invitation"
        confirmLoading={saving}
        onCancel={() => setInviteOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        forceRender
      >
        {inviteError ? <Alert className="mb-4" type="error" showIcon title={inviteError} /> : null}
        <Form<InviteValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSaving(true)
            setInviteError(null)
            try {
              await createAdminInvitation({
                ...values,
                displayName: values.displayName?.trim() || undefined,
                email: values.email.trim(),
                idempotencyKey: inviteKey.current,
              })
              void message.success('Invitation created.')
              setInviteOpen(false)
              await load()
            } catch (error) {
              setInviteError(normalizeApiError(error).message)
            } finally {
              setSaving(false)
            }
          }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="displayName" label="Display name">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
            <Select
              options={assignableRoles.map((candidate) => ({ label: candidate.name, value: candidate.id }))}
              placeholder={assignableRoles.length ? 'Select a role' : 'No assignable roles'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
