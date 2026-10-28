import { ADMIN_PERMISSION_CATALOG, type AdminPermission, type AdminRole } from '@shoppp/contracts'
import { Alert, Button, Form, Input, Popconfirm, Space, Tag, App, Typography, theme } from 'antd'
import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import { fetchAdminRole, updateAdminRole } from '../../services/iam/api'
import { PermissionTree } from './permission-tree'
import { useI18n } from '../../shared/contexts/i18n-context'
import { getFormModeViewModel } from '../../routes/form-route-contract'
import { BasicCrudFormRecipe } from '../../shared/template-kit/recipes/basic-crud-form-recipe'
import { CrudFormDrawerRecipe } from '../../shared/template-kit/recipes/crud-form-drawer-recipe'
import './role-detail-page.css'

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
  const { token } = theme.useToken()
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
  const [detailError, setDetailError] = useState<ApiError | null>(null)
  const [form] = Form.useForm<RoleValues>()

  const isOwnRole = session?.role.id === id
  const isWithinAuthority =
    role?.permissions.every((permission) => permissions?.includes(permission)) ?? false
  const canEdit = canWrite && !role?.protected && !isOwnRole && isWithinAuthority
  const canArchive = canEdit && role?.system === false && role.enabled

  const load = useCallback(async () => {
    const requestGeneration = ++generation.current
    if (!id) return
    setLoading(true)
    setDetailError(null)
    setError(null)
    try {
      const nextRole = await fetchAdminRole(id)
      if (!alive.current || requestGeneration !== generation.current) return
      setRole(nextRole)
    } catch (cause) {
      if (!alive.current || requestGeneration !== generation.current) return
      setDetailError(normalizeApiError(cause))
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
      permissions: role.permissions,
    })
  }, [form, role])

  const explainError = useCallback(
    async (cause: unknown) => {
      if (!alive.current) return
      const apiError = normalizeApiError(cause)
      if (apiError.code === 'stale_role_version') {
        await load()
        if (!alive.current) return
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
      if (!alive.current) return { cancelled: true as const }
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

  const submit = async (values: RoleValues) => {
    if (!alive.current || !canEdit || saveLock.current || confirming || confirmationModal.current)
      return {
        success: false as const,
        error: normalizeApiError(new Error('This role cannot be edited.')),
      }
    const removesPermissions =
      role?.permissions.some((permission) => !values.permissions.includes(permission)) ?? false
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
  const roleValues: RoleValues = {
    description: role?.description ?? '',
    name: role?.name ?? '',
    permissions: role?.permissions ?? [],
  }
  const mode = canEdit ? 'modify' : 'readonly'
  const visiblePermissions = canEdit
    ? (permissions ?? [])
    : role?.protected
      ? ADMIN_PERMISSION_CATALOG.map((entry) => entry.key)
      : [...new Set([...(permissions ?? []), ...(role?.permissions ?? [])])]

  const baseline = role
    ? {
        description: role.description?.trim() || null,
        name: role.name.trim(),
        permissions: [...role.permissions].sort(),
      }
    : null
  const submission = (values: RoleValues) => ({
    description: values.description?.trim() || null,
    name: values.name?.trim() || '',
    permissions: [...(values.permissions ?? [])].sort(),
  })

  const reset = () => {
    form.resetFields()
    form.setFieldsValue(roleValues)
    setError(null)
  }
  const fields = (
    <div
      className="role-detail-layout-container"
      style={{ '--role-divider-color': token.colorBorderSecondary } as CSSProperties}
    >
      <div className="role-detail-layout">
        <section className="min-w-0 space-y-4">
          <Space wrap>
            <Typography.Title level={5} className="!mb-0">
              {t('Basic information')}
            </Typography.Title>
            {role?.protected ? (
              <Tag color="gold" disabled={false}>
                {t('Protected')}
              </Tag>
            ) : null}
            {role?.system && !role.protected ? (
              <Tag disabled={false}>{t('System role')}</Tag>
            ) : null}
            {role && !role.enabled ? <Tag disabled={false}>{t('Archived')}</Tag> : null}
          </Space>
          <div>
            <Form.Item label={t('Role key')}>
              <Input value={role?.key} aria-label={t('Role key')} disabled />
            </Form.Item>
            <Form.Item name="name" label={t('Role name')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label={t('Description')}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </div>
          {!role?.protected && isOwnRole ? (
            <Typography.Paragraph type="secondary">
              {t('You cannot edit the role that authorizes your current session.')}
            </Typography.Paragraph>
          ) : role && !role.protected && !isWithinAuthority ? (
            <Alert
              type="warning"
              showIcon
              title={t(
                'This role contains permissions outside your current authority and cannot be edited by this session.'
              )}
            />
          ) : null}
        </section>
        <section className="role-detail-permissions space-y-4">
          <Space wrap>
            <Typography.Title level={5} className="!mb-0">
              {t('Role permissions')}
            </Typography.Title>
            {role?.protected ? <Tag disabled={false}>{t('Read only')}</Tag> : null}
          </Space>
          {role?.protected ? (
            <Typography.Paragraph type="secondary">
              {t('Admin has all permissions. This role cannot be edited.')}
            </Typography.Paragraph>
          ) : null}
          <Form.Item name="permissions" className="!mb-0">
            <PermissionTree
              permitted={visiblePermissions}
              disabled={!canEdit || saving || confirming}
            />
          </Form.Item>
        </section>
      </div>
    </div>
  )
  const renderFeedback = (complete?: () => void) => (
    <>
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
              if (!alive.current) return
              void message.success(t('Role archived.'))
              if (complete) complete()
              else await load()
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
          className="mt-4"
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => void load()}>{t('Reload')}</Button>}
        />
      ) : null}
    </>
  )
  if (onClose)
    return (
      <CrudFormDrawerRecipe<RoleValues>
        spec={{
          title: role?.name ?? t('Role'),
          successTitle: t('Role updated. New permissions apply on the next API request.'),
          parsedMode: { ok: true, mode: canEdit ? 'modify' : 'readonly', resourceKey: id },
          permissionDenied: false,
          detailLoading: loading,
          detailError,
          saveLoading: saving,
          nestedModalOpen: confirming,
          isReadonly: !canEdit,
          form,
          initialValues: roleValues,
          onRetryDetail: () => void load(),
          onResetAll: reset,
          hasUnsavedChanges: () =>
            JSON.stringify(submission(form.getFieldsValue(true))) !== JSON.stringify(baseline),
          onClose,
          onSaved: onSaved ?? (async () => undefined),
          onSubmit: submit,
          renderFields: () => fields,
          renderAfterForm: ({ complete }) => renderFeedback(complete),
        }}
      />
    )

  return (
    <div className="role-detail-page">
      <BasicCrudFormRecipe<RoleValues>
        spec={{
          parsedMode: id
            ? { ok: true, mode, resourceKey: id }
            : {
                ok: false,
                errorCode: 'ROUTE_PARAM_MISSING_ID',
                message: 'Modify and readonly modes require an id or resourceKey.',
              },
          modeView: getFormModeViewModel(mode),
          permissionDenied: false,
          detailLoading: loading,
          detailError,
          saveLoading: saving || confirming,
          isReadonly: !canEdit,
          form,
          initialValues: roleValues,
          title: role?.name ?? t('Role'),
          contentWidthPreset: 'wide',
          stateCopy: {
            submitSuccessMessage: t('Role updated. New permissions apply on the next API request.'),
          },
          onBackToList: () => navigate('/access/roles'),
          onRetryDetail: () => void load(),
          onResetAll: reset,
          onSubmit: async (values) => {
            const result = await submit(values)
            if ('success' in result && result.success && alive.current)
              void message.success(
                t('Role updated. New permissions apply on the next API request.')
              )
          },
          renderFields: () => fields,
          renderAfterForm:
            canArchive || error ? (
              <div className="p-6" style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                {renderFeedback()}
              </div>
            ) : null,
        }}
      />
    </div>
  )
}
