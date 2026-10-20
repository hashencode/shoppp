import type { AdminPermission, AdminRole } from '@shoppp/contracts'
import { Alert, Button, Card, Form, Input, Popconfirm, Space, Spin, Tag, App } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError } from '../../infrastructure/http/api-client'
import { fetchAdminRole, updateAdminRole } from '../../services/iam/api'
import { PermissionChecklist } from './permission-checklist'
import { useI18n } from '../../shared/contexts/i18n-context'

import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'

void React

type RoleValues = { description?: string; name: string; permissions: AdminPermission[] }
type DependencyDetails = { identities?: number; pendingInvitations?: number }

export const RoleDetailPage = ({
  resourceId,
  onClose,
  onSaved,
}: { resourceId?: string; onClose?: () => void; onSaved?: () => Promise<void> } = {}) => {
  const { message, modal } = App.useApp()
  const { id: routeId = '' } = useParams()
  const id = resourceId ?? routeId
  const navigate = useNavigate()
  const { t } = useI18n()
  const { permissions, role: roleKey, session } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.roles.write', permissions)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const confirmationModal = useRef<ReturnType<typeof modal.confirm> | null>(null)
  const [confirming, setConfirming] = useState(false)
  const alive = useRef(true)
  const generation = useRef(0)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      generation.current += 1
      confirmationModal.current?.destroy()
    }
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm<RoleValues>()

  const isOwnRole = session?.role.id === id
  const isWithinAuthority =
    role?.permissions.every((permission) => permissions?.includes(permission)) ?? false
  const canEdit = canWrite && !role?.protected && !isOwnRole && isWithinAuthority
  const canArchive = canEdit && role?.system === false && role.enabled

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current
    setLoading(true)
    try {
      const nextRole = await fetchAdminRole(id)
      if (!alive.current || requestGeneration !== generation.current) return
      setRole(nextRole)
    } catch (cause) {
      if (!alive.current || requestGeneration !== generation.current) return
      setError(normalizeApiError(cause).message)
    } finally {
      if (alive.current && requestGeneration === generation.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!role) return
    form.setFieldsValue({
      description: role.description ?? '',
      name: role.name,
      permissions: role.permissions.filter((permission) => permissions?.includes(permission)),
    })
  }, [form, permissions, role])

  const explainError = useCallback(
    async (cause: unknown) => {
      const apiError = normalizeApiError(cause)
      if (apiError.code === 'stale_role_version') {
        await load()
        setError(
          t(
            'This role changed by another administrator. The latest state has been loaded; review it before retrying.'
          )
        )
        return
      }
      if (apiError.code === 'role_has_dependencies') {
        const details = (apiError.details ?? {}) as DependencyDetails
        setError(
          t(
            'This role cannot be archived because it has {identities} assigned identities and {invitations} pending invitations. Reassign or revoke them first.',
            {
              identities: details.identities ?? 0,
              invitations: details.pendingInvitations ?? 0,
            }
          )
        )
        return
      }
      if (apiError.code === 'self_role_edit_denied') {
        setError(t('You cannot edit the role that authorizes your current session.'))
        return
      }
      if (apiError.code === 'system_role_archive_denied') {
        setError(t('System roles can be edited but cannot be archived.'))
        return
      }
      setError(apiError.message)
    },
    [load, t]
  )

  const save = async (values: RoleValues) => {
    if (!alive.current || !role || !canEdit || saveLock.current)
      return {
        success: false as const,
        error: normalizeApiError(new Error('This role cannot be edited.')),
      }
    saveLock.current = true
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminRole(role.id, {
        description: values.description?.trim() || null,
        expectedVersion: role.version,
        name: values.name.trim(),
        permissions: values.permissions,
      })
      setRole(updated)
      form.setFieldsValue({
        description: updated.description ?? '',
        name: updated.name,
        permissions: updated.permissions,
      })
      return { success: true as const }
    } catch (cause) {
      await explainError(cause)
      return { success: false as const, error: normalizeApiError(cause) }
    } finally {
      saveLock.current = false
      if (alive.current) setSaving(false)
    }
  }

  const selectedPermissions = Form.useWatch('permissions', form)
  const removesPermissions =
    role?.permissions.some((permission) => !(selectedPermissions ?? []).includes(permission)) ??
    false

  const fields = (
    <>
      <Form.Item label={t('Role key')}>
        <Input value={role?.key} disabled />
      </Form.Item>
      <Form.Item name="name" label={t('Role name')} rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label={t('Description')}>
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="permissions" label={t('Permissions')}>
        <PermissionChecklist permitted={permissions ?? []} disabled={!canEdit} />
      </Form.Item>
    </>
  )
  const submit = async (values: RoleValues) => {
    if (!alive.current || !canEdit || saveLock.current || confirming)
      return {
        success: false as const,
        error: normalizeApiError(new Error('This role cannot be edited.')),
      }
    if (!removesPermissions) return save(values)
    setConfirming(true)
    return new Promise<Awaited<ReturnType<typeof save>> | { cancelled: true }>((resolve) => {
      let result: Awaited<ReturnType<typeof save>> | { cancelled: true } = { cancelled: true }
      const confirmationGeneration = generation.current
      confirmationModal.current = modal.confirm({
        title: t('Confirm permission reduction'),
        content: t(
          'Removed permissions take effect for assigned principals on their next API request.'
        ),
        okText: t('Confirm reduction'),
        okButtonProps: { danger: true },
        onOk: async () => {
          if (confirmationGeneration !== generation.current || !alive.current) return
          confirmationModal.current?.update({
            cancelButtonProps: { disabled: true },
            keyboard: false,
            mask: { closable: false },
          })
          result = await save(values)
        },
        afterClose: () => {
          confirmationModal.current = null
          if (alive.current) setConfirming(false)
          resolve(result)
        },
      })
    })
  }
  const baseline = role
    ? {
        description: role.description?.trim() || null,
        name: role.name.trim(),
        permissions: [...role.permissions.filter((p) => permissions?.includes(p))].sort(),
      }
    : null
  const submission = (values: RoleValues) => ({
    description: values.description?.trim() || null,
    name: values.name?.trim() || '',
    permissions: [...(values.permissions ?? [])].sort(),
  })

  if (onClose)
    return (
      <CrudFormDrawerRecipe<RoleValues>
        spec={{
          title: role?.name ?? t('Role'),
          successTitle: t('Role updated. New permissions apply on the next API request.'),
          parsedMode: { ok: true, mode: canEdit ? 'modify' : 'readonly', resourceKey: id },
          permissionDenied: false,
          detailLoading: loading,
          detailError: !role && error ? normalizeApiError(new Error(error)) : null,
          saveLoading: saving,
          nestedModalOpen: confirming,
          isReadonly: !canEdit,
          form,
          initialValues: { name: '', description: '', permissions: [] },
          onRetryDetail: () => void load(),
          onResetAll: () => {
            form.resetFields()
            if (baseline) form.setFieldsValue(baseline as RoleValues)
            setError(null)
          },
          hasUnsavedChanges: () =>
            JSON.stringify(submission(form.getFieldsValue(true))) !== JSON.stringify(baseline),
          onClose,
          onSaved: onSaved ?? (async () => undefined),
          onSubmit: submit,
          renderFields: () => fields,
          renderAfterForm: ({ complete }) => (
            <>
              {role ? (
                <Space className="mb-4">
                  {role.protected ? <Tag color="gold">{t('Protected')}</Tag> : null}
                  {role.system && !role.protected ? <Tag>{t('System role')}</Tag> : null}
                  {!role.enabled ? <Tag>{t('Archived')}</Tag> : null}
                </Space>
              ) : null}
              {role?.protected ? (
                <Alert
                  type="info"
                  showIcon
                  title={t(
                    'The protected administrator role always contains the complete permission catalog and cannot be changed.'
                  )}
                />
              ) : null}
              {isOwnRole ? (
                <Alert
                  type="info"
                  showIcon
                  title={t('You cannot edit the role that authorizes your current session.')}
                />
              ) : null}
              {role && !isWithinAuthority ? (
                <Alert
                  type="warning"
                  showIcon
                  title={t(
                    'This role contains permissions outside your current authority and cannot be edited by this session.'
                  )}
                />
              ) : null}
              {canArchive ? (
                <Popconfirm
                  title={t('Archive this role?')}
                  description={t('It must have no assigned identities or active invitations.')}
                  okText={t('Confirm archive')}
                  onConfirm={async () => {
                    if (!alive.current || !role || !canArchive || saveLock.current) return
                    saveLock.current = true
                    setSaving(true)
                    setError(null)
                    try {
                      await updateAdminRole(role.id, {
                        enabled: false,
                        expectedVersion: role.version,
                      })
                      void message.success(t('Role archived.'))
                      complete()
                    } catch (cause) {
                      await explainError(cause)
                    } finally {
                      saveLock.current = false
                      if (alive.current) setSaving(false)
                    }
                  }}
                >
                  <Button danger disabled={saving || confirming}>
                    {t('Archive role')}
                  </Button>
                </Popconfirm>
              ) : null}
              {error ? (
                <Alert
                  type="error"
                  showIcon
                  title={error}
                  action={<Button onClick={() => void load()}>{t('Reload')}</Button>}
                />
              ) : null}
            </>
          ),
        }}
      />
    )

  if (loading && !role) return <Spin description={t('Loading role')} />

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Space>
            <h1 className="m-0 text-2xl font-semibold">{role?.name ?? t('Role')}</h1>
            {role?.protected ? <Tag color="gold">{t('Protected')}</Tag> : null}
            {role?.system && !role.protected ? <Tag>{t('System role')}</Tag> : null}
            {role && !role.enabled ? <Tag>{t('Archived')}</Tag> : null}
          </Space>
        </div>
        <Button onClick={() => navigate('/access/roles')}>{t('Back to roles')}</Button>
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => void load()}>{t('Reload')}</Button>}
        />
      ) : null}
      {role?.protected ? (
        <Alert
          type="info"
          showIcon
          title={t(
            'The protected administrator role always contains the complete permission catalog and cannot be changed.'
          )}
        />
      ) : null}
      {isOwnRole ? (
        <Alert
          type="info"
          showIcon
          title={t('You cannot edit the role that authorizes your current session.')}
        />
      ) : null}
      {role && !isWithinAuthority ? (
        <Alert
          type="warning"
          showIcon
          title={t(
            'This role contains permissions outside your current authority and cannot be edited by this session.'
          )}
        />
      ) : null}
      {role ? (
        <Card>
          <Form<RoleValues>
            form={form}
            layout="vertical"
            disabled={!canEdit || saving || confirming}
            onFinish={(values) =>
              void submit(values).then((result) => {
                if ('success' in result && result.success)
                  void message.success(
                    t('Role updated. New permissions apply on the next API request.')
                  )
              })
            }
          >
            {fields}
            {canWrite ? (
              <Space wrap>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  disabled={!canEdit || saving || confirming}
                >
                  {t('Save changes')}
                </Button>
                {canArchive ? (
                  <Popconfirm
                    title={t('Archive this role?')}
                    description={t('It must have no assigned identities or active invitations.')}
                    okText={t('Confirm archive')}
                    onConfirm={async () => {
                      if (!alive.current || !role || !canArchive || saveLock.current) return
                      saveLock.current = true
                      setSaving(true)
                      setError(null)
                      try {
                        await updateAdminRole(role.id, {
                          enabled: false,
                          expectedVersion: role.version,
                        })
                        void message.success(t('Role archived.'))
                        await load()
                      } catch (cause) {
                        await explainError(cause)
                      } finally {
                        saveLock.current = false
                        setSaving(false)
                      }
                    }}
                  >
                    <Button danger disabled={saving}>
                      {t('Archive role')}
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            ) : null}
          </Form>
        </Card>
      ) : null}
    </div>
  )
}
