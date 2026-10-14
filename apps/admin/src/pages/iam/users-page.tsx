import {
  adminInvitationStatusSchema,
  adminUserStatusSchema,
  type AdminInvitation,
  type AdminInvitationStatus,
  type AdminRole,
  type AdminUser,
  type AdminUserStatus,
} from '@shoppp/contracts'
import { Alert, App, Button, Card, Form, Input, Modal, Select, Table, Tag } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { hasPermission } from '../../infrastructure/auth/permissions'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { normalizeApiError, type ApiError } from '../../infrastructure/http/api-client'
import {
  createAdminInvitation,
  fetchAdminInvitations,
  fetchAdminRoles,
  fetchAdminUsers,
  resendAdminInvitation,
  revokeAdminInvitation,
  type IamPage,
} from '../../services/iam/api'
import {
  buildListToolbarColumnSettingOptions,
  ListToolbarActions,
} from '../../shared/components/list-toolbar-actions'
import { ListRowActions } from '../../shared/components/list-row-actions'
import { useI18n } from '../../shared/contexts/i18n-context'
import { useTheme } from '../../shared/contexts/theme-context'
import { useListViewPreferences } from '../../shared/hooks/use-list-view-preferences'
import { useStandardPagination } from '../../shared/hooks/use-standard-pagination'
import { CustomPageRecipe } from '../../shared/template-kit/recipes/custom-page-recipe'
import {
  buildSearchGridProps,
  buildStandardListPagination,
  resolveActionColumnLayout,
  STANDARD_LIST_TABLE_CLASS_NAME,
  TemplateListContent,
  TemplateListFilterForm,
  type TemplateListFilterField,
  useTemplateListController,
} from '../../shared/template-kit/list'
import { UserDetailPage } from './user-detail-page'
import { useFormDialog } from '../../shared/hooks/use-form-dialog'
import './users-page.css'

void React

type InviteValues = { displayName?: string; email: string; roleId: string }
type Translate = (message: string) => string
type ActiveTab = 'users' | 'invitations'
type FilterValues = {
  search?: string
  userStatus?: AdminUserStatus
  invitationStatus?: AdminInvitationStatus
}
type UserFilters = {
  page: number
  pageSize: number
  search?: string
  status?: AdminUserStatus
}
type InvitationFilters = {
  page: number
  pageSize: number
  search?: string
  status?: AdminInvitationStatus
}

const PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const ROLE_FILTERS = { page: 1, pageSize: 100 } as const
const INVITATION_ACTION_CONTENT_WIDTHS = { resend: 56, revoke: 56 } as const
const INVITATION_ACTION_LAYOUT = resolveActionColumnLayout(
  [[INVITATION_ACTION_CONTENT_WIDTHS.resend, INVITATION_ACTION_CONTENT_WIDTHS.revoke]],
  'large'
)

const newIdempotencyKey = (prefix: string) =>
  `${prefix}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-request`}`

const statusTag = (status: AdminUserStatus | AdminInvitationStatus, t: Translate) => {
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
  return <Tag color={colors[status]}>{t(labels[status])}</Tag>
}

const deliveryTag = (invitation: AdminInvitation, t: Translate) => {
  if (!invitation.delivery) return <Tag>{t('Not queued')}</Tag>
  const labels = {
    dead_letter: 'Delivery failed',
    failed: 'Retry scheduled',
    pending: 'Queued',
    processing: 'Sending',
    sent: 'Sent',
  } as const
  const colors = {
    dead_letter: 'error',
    failed: 'warning',
    pending: 'processing',
    processing: 'processing',
    sent: 'success',
  } as const
  return (
    <Tag color={colors[invitation.delivery.status]}>{t(labels[invitation.delivery.status])}</Tag>
  )
}

type IndependentListCardProps<TItem> = {
  activeTabKey: ActiveTab
  tabList: Array<{ key: ActiveTab; tab: React.ReactNode }>
  onTabChange: (key: ActiveTab) => void
  tableId: string
  columns: ColumnsType<TItem>
  rowKey: string
  queryState: {
    data: TItem[]
    loading: boolean
    error: ApiError | null
    showInitialLoading: boolean
    showError: boolean
    showEmpty: boolean
    showPartial: boolean
  }
  pagination: TablePaginationConfig
  scrollX: number
  emptyTitle: string
  onReload: () => void
  onResetEmpty: () => void
}

const IndependentListCard = <TItem extends object>({
  activeTabKey,
  tabList,
  onTabChange,
  tableId,
  columns,
  rowKey,
  queryState,
  pagination,
  scrollX,
  emptyTitle,
  onReload,
  onResetEmpty,
}: IndependentListCardProps<TItem>) => {
  const { data, error, loading, showEmpty, showError, showInitialLoading, showPartial } = queryState
  const defaultColumnKeys = useMemo(
    () =>
      columns
        .filter((column) => typeof column.key === 'string')
        .map((column) => String(column.key)),
    [columns]
  )
  const {
    tableSize,
    selectedColumnKeys,
    columnOrder,
    hasCustomColumnOrder,
    setTableSize,
    setSelectedColumnKeys,
    setColumnOrder,
    clearColumnOrder,
  } = useListViewPreferences({
    tableId,
    defaultColumnKeys,
    defaultDensity: 'middle',
  })
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return columns
    const byKey = new Map(
      columns
        .filter((column) => typeof column.key === 'string')
        .map((column) => [String(column.key), column])
    )
    const ordered = columnOrder
      .map((key) => byKey.get(key))
      .filter((column): column is ColumnsType<TItem>[number] => Boolean(column))
    const orderedKeys = new Set(ordered.map((column) => String(column.key)))
    return [
      ...ordered,
      ...columns.filter(
        (column) => typeof column.key !== 'string' || !orderedKeys.has(String(column.key))
      ),
    ]
  }, [columnOrder, columns])
  const visibleColumns = useMemo(
    () =>
      orderedColumns.filter(
        (column) =>
          typeof column.key !== 'string' || selectedColumnKeys.includes(String(column.key))
      ),
    [orderedColumns, selectedColumnKeys]
  )
  const tableNode = (
    <Table<TItem>
      className={STANDARD_LIST_TABLE_CLASS_NAME}
      rowKey={rowKey}
      columns={visibleColumns}
      dataSource={data}
      loading={loading}
      size={tableSize}
      pagination={pagination}
      scroll={{ x: scrollX }}
    />
  )

  return (
    <Card
      className="iam-users-list-card"
      tabList={tabList}
      activeTabKey={activeTabKey}
      onTabChange={(key) => onTabChange(key as ActiveTab)}
      tabProps={{ size: 'middle' }}
      variant="borderless"
      tabBarExtraContent={
        <ListToolbarActions
          tableSize={tableSize}
          onTableSizeChange={setTableSize}
          onClearColumnSort={clearColumnOrder}
          clearColumnSortDisabled={!hasCustomColumnOrder}
          reloadLoading={loading}
          onReload={onReload}
          columnSettingOptions={buildListToolbarColumnSettingOptions(orderedColumns)}
          selectedColumnKeys={selectedColumnKeys}
          onSelectedColumnKeysChange={setSelectedColumnKeys}
          onColumnSettingOrderChange={setColumnOrder}
        />
      }
    >
      <TemplateListContent
        showInitialLoading={showInitialLoading}
        showError={showError}
        showPartial={showPartial}
        showEmpty={showEmpty}
        errorMessage={error?.message}
        partialMessage={error?.message}
        onRetry={onReload}
        onReloadPartial={onReload}
        onResetEmpty={onResetEmpty}
        copy={{
          errorTitle: 'List could not be loaded',
          emptyTitle,
          emptyDescription: emptyTitle,
        }}
        tableNode={tableNode}
      />
    </Card>
  )
}

export const UsersPage = () => {
  const { message } = App.useApp()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const { locale, t } = useI18n()
  const { searchCompactLayout } = useTheme()
  const { permissions, role: roleKey, session } = useAuth()
  const canWrite = hasPermission(roleKey, 'iam.users.write', permissions)
  const canReadRoles = hasPermission(roleKey, 'iam.roles.read', permissions)
  const canInvite = canWrite && canReadRoles
  const [activeTab, setActiveTab] = useState<ActiveTab>('users')
  const [filterForm] = Form.useForm<FilterValues>()
  const [committedSearch, setCommittedSearch] = useState<string | undefined>()
  const [committedUserStatus, setCommittedUserStatus] = useState<AdminUserStatus | undefined>()
  const [committedInvitationStatus, setCommittedInvitationStatus] = useState<
    AdminInvitationStatus | undefined
  >()
  const [userRequestVersion, setUserRequestVersion] = useState(0)
  const [invitationRequestVersion, setInvitationRequestVersion] = useState(0)
  const [userTotal, setUserTotal] = useState(0)
  const [invitationTotal, setInvitationTotal] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [form] = Form.useForm<InviteValues>()
  const invitationDialog = useFormDialog({
    open: inviteOpen,
    form,
    onClose: () => setInviteOpen(false),
    toSubmission: (values) => ({
      ...values,
      email: values.email?.trim() || '',
      displayName: values.displayName?.trim() || undefined,
    }),
  })
  const inviteKey = useRef(newIdempotencyKey('admin-invite'))

  const {
    current: userPage,
    pageSize: userPageSize,
    pagination: userPagination,
    resetPage: resetUserPage,
  } = useStandardPagination({
    total: userTotal,
    defaultPageSize: PAGE_SIZE,
    includeAllDataOption: false,
    maxPageSize: 100,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  })
  const {
    current: invitationPage,
    pageSize: invitationPageSize,
    pagination: invitationPagination,
    resetPage: resetInvitationPage,
  } = useStandardPagination({
    total: invitationTotal,
    defaultPageSize: PAGE_SIZE,
    includeAllDataOption: false,
    maxPageSize: 100,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  })
  const userFilters = useMemo<UserFilters>(
    () => ({
      page: userPage,
      pageSize: userPageSize,
      search: committedSearch,
      status: committedUserStatus,
    }),
    [committedSearch, committedUserStatus, userPage, userPageSize]
  )
  const invitationFilters = useMemo<InvitationFilters>(
    () => ({
      page: invitationPage,
      pageSize: invitationPageSize,
      search: committedSearch,
      status: committedInvitationStatus,
    }),
    [committedInvitationStatus, committedSearch, invitationPage, invitationPageSize]
  )

  const usersController = useTemplateListController<
    UserFilters,
    IamPage<AdminUser>,
    AdminUser,
    ApiError
  >({
    filters: userFilters,
    request: fetchAdminUsers,
    selectItems: (response) => response?.items ?? [],
    mapError: normalizeApiError,
    transformResponse: (response) => {
      setUserTotal(response.total)
      return response
    },
  })
  const invitationsController = useTemplateListController<
    InvitationFilters,
    IamPage<AdminInvitation>,
    AdminInvitation,
    ApiError
  >({
    filters: invitationFilters,
    request: fetchAdminInvitations,
    selectItems: (response) => response?.items ?? [],
    mapError: normalizeApiError,
    transformResponse: (response) => {
      setInvitationTotal(response.total)
      return response
    },
  })
  const rolesController = useTemplateListController<
    typeof ROLE_FILTERS,
    IamPage<AdminRole>,
    AdminRole,
    ApiError
  >({
    filters: ROLE_FILTERS,
    request: fetchAdminRoles,
    selectItems: (response) => response?.items ?? [],
    mapError: normalizeApiError,
    enableAutoRefresh: false,
  })
  const loadUsers = usersController.load
  const loadInvitations = invitationsController.load
  const loadRoles = rolesController.load

  useEffect(() => {
    void loadUsers()
  }, [loadUsers, userRequestVersion])
  useEffect(() => {
    void loadInvitations()
  }, [invitationRequestVersion, loadInvitations])
  useEffect(() => {
    if (canReadRoles) void loadRoles()
  }, [canReadRoles, loadRoles])

  const latestInvitationLoadRef = useRef(loadInvitations)
  useEffect(() => {
    latestInvitationLoadRef.current = loadInvitations
  }, [loadInvitations])
  const reloadLatestInvitations = useCallback(async () => {
    await latestInvitationLoadRef.current()
  }, [])

  const assignableRoles = rolesController.data.filter(
    (candidate) =>
      candidate.enabled &&
      (!candidate.protected || session?.role.protected === true) &&
      candidate.permissions.every((permission) => permissions?.includes(permission))
  )
  const filterFields = useMemo<TemplateListFilterField<FilterValues>[]>(
    () => [
      {
        type: 'input',
        name: 'search',
        label: t('Search'),
        inputProps: {
          'aria-label': t('Search users and invitations'),
          placeholder: t('Search by name or email'),
        },
      },
      activeTab === 'users'
        ? {
            type: 'select' as const,
            name: 'userStatus' as const,
            label: t('Status'),
            options: adminUserStatusSchema.options.map((value) => ({
              label: t(value[0].toUpperCase() + value.slice(1)),
              value,
            })),
            selectProps: {
              'aria-label': t('User status'),
              placeholder: t('All user states'),
            },
          }
        : {
            type: 'select' as const,
            name: 'invitationStatus' as const,
            label: t('Status'),
            options: adminInvitationStatusSchema.options.map((value) => ({
              label: t(value[0].toUpperCase() + value.slice(1)),
              value,
            })),
            selectProps: {
              'aria-label': t('Invitation status'),
              placeholder: t('All invitation states'),
            },
          },
    ],
    [activeTab, t]
  )
  const searchGridProps = useMemo(() => buildSearchGridProps(filterFields), [filterFields])

  const applyVisibleFilters = useCallback(
    (values: FilterValues) => {
      const search = values.search?.trim() || undefined
      const searchChanged = search !== committedSearch
      setCommittedSearch(search)

      if (activeTab === 'users') {
        setCommittedUserStatus(values.userStatus)
        resetUserPage()
        setUserRequestVersion((version) => version + 1)
        if (searchChanged) {
          resetInvitationPage()
          setInvitationRequestVersion((version) => version + 1)
        }
        return
      }

      setCommittedInvitationStatus(values.invitationStatus)
      resetInvitationPage()
      setInvitationRequestVersion((version) => version + 1)
      if (searchChanged) {
        resetUserPage()
        setUserRequestVersion((version) => version + 1)
      }
    },
    [activeTab, committedSearch, resetInvitationPage, resetUserPage]
  )
  const resetVisibleFilters = useCallback(() => {
    const nextValues = filterForm.getFieldsValue(true)
    nextValues.search = undefined
    if (activeTab === 'users') nextValues.userStatus = undefined
    else nextValues.invitationStatus = undefined
    filterForm.setFieldsValue(nextValues)
    applyVisibleFilters(nextValues)
  }, [activeTab, applyVisibleFilters, filterForm])

  const userColumns = useMemo<ColumnsType<AdminUser>>(
    () => [
      {
        key: 'user',
        title: t('User'),
        render: (_: unknown, user) => (
          <div>
            <div className="font-medium">{user.displayName}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
          </div>
        ),
      },
      { key: 'role', title: t('Role'), render: (_: unknown, user) => user.role.name },
      {
        key: 'status',
        title: t('Status'),
        render: (_: unknown, user) => statusTag(user.status, t),
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: 100,
        render: (_: unknown, user) => (
          <Button type="link" className="!px-0" onClick={() => setSelectedUserId(user.id)}>
            {t('Inspect')}
          </Button>
        ),
      },
    ],
    [t]
  )
  const invitationColumns = useMemo<ColumnsType<AdminInvitation>>(
    () => [
      {
        key: 'invitee',
        title: t('Invitee'),
        render: (_: unknown, invitation) => (
          <div>
            <div className="font-medium">{invitation.displayName ?? t('Pending user')}</div>
            <div className="text-sm text-slate-500">{invitation.email}</div>
          </div>
        ),
      },
      {
        key: 'role',
        title: t('Role'),
        render: (_: unknown, invitation) => invitation.role.name,
      },
      {
        key: 'expires',
        title: t('Expires'),
        render: (_: unknown, invitation) =>
          new Date(invitation.expiresAt).toLocaleDateString(locale),
      },
      {
        key: 'status',
        title: t('Status'),
        render: (_: unknown, invitation) => statusTag(invitation.status, t),
      },
      {
        key: 'delivery',
        title: t('Email delivery'),
        render: (_: unknown, invitation) => deliveryTag(invitation, t),
      },
      {
        key: 'actions',
        title: t('Actions'),
        width: INVITATION_ACTION_LAYOUT.columnWidth,
        render: (_: unknown, invitation) =>
          canWrite && invitation.status === 'pending' ? (
            <ListRowActions
              layoutMode={INVITATION_ACTION_LAYOUT.mode}
              maxRowContentWidth={INVITATION_ACTION_LAYOUT.maxRowContentWidth}
              actions={[
                {
                  key: 'resend',
                  label: t('Resend'),
                  contentWidth: INVITATION_ACTION_CONTENT_WIDTHS.resend,
                  onClick: async () => {
                    try {
                      await resendAdminInvitation(invitation.id, {
                        expectedVersion: invitation.version,
                        idempotencyKey: newIdempotencyKey(`admin-invite-resend-${invitation.id}`),
                      })
                      void message.success(t('Invitation queued for resend.'))
                      await reloadLatestInvitations()
                    } catch (error) {
                      void message.error(normalizeApiError(error).message)
                    }
                  },
                },
                {
                  key: 'revoke',
                  label: t('Revoke'),
                  contentWidth: INVITATION_ACTION_CONTENT_WIDTHS.revoke,
                  danger: true,
                  confirm: {
                    title: t('Revoke this invitation?'),
                    description: t('The invitee will no longer be able to activate it.'),
                    okText: t('Confirm revoke'),
                  },
                  onClick: async () => {
                    try {
                      await revokeAdminInvitation(invitation.id, {
                        expectedVersion: invitation.version,
                      })
                      void message.success(t('Invitation revoked.'))
                      await reloadLatestInvitations()
                    } catch (error) {
                      void message.error(normalizeApiError(error).message)
                    }
                  },
                },
              ]}
            />
          ) : null,
      },
    ],
    [canWrite, locale, message, reloadLatestInvitations, t]
  )

  const pageExtra = canInvite ? (
    <Button
      type="primary"
      disabled={rolesController.loading || Boolean(rolesController.error)}
      onClick={() => {
        inviteKey.current = newIdempotencyKey('admin-invite')
        setInviteError(null)
        form.resetFields()
        setInviteOpen(true)
      }}
    >
      {t('Invite user')}
    </Button>
  ) : null
  const listTabs: Array<{ key: ActiveTab; tab: React.ReactNode }> = [
    { key: 'users', tab: t('Users') },
    { key: 'invitations', tab: t('Invitations') },
  ]

  return (
    <CustomPageRecipe title={t('Users and invitations')} extra={pageExtra}>
      {canWrite && !canReadRoles ? (
        <Alert
          type="info"
          showIcon
          title={t(
            'Invitation creation requires role visibility. You can still resend or revoke existing invitations.'
          )}
        />
      ) : null}
      {canInvite && rolesController.error ? (
        <Alert
          type="error"
          showIcon
          title={rolesController.error.message}
          action={<Button onClick={() => void loadRoles()}>{t('Retry')}</Button>}
        />
      ) : null}

      <Card variant="borderless" styles={{ body: { paddingRight: 8 } }}>
        <TemplateListFilterForm<FilterValues>
          form={filterForm}
          formProps={{ initialValues: {} }}
          fields={filterFields}
          fieldColProps={searchGridProps.formItem}
          labelCol={searchGridProps.labelItem}
          wrapperCol={searchGridProps.inputItem}
          actionsColProps={searchGridProps.actions}
          compactLayout={searchCompactLayout}
          submitLoading={
            activeTab === 'users' ? usersController.loading : invitationsController.loading
          }
          onSubmit={applyVisibleFilters}
          onReset={resetVisibleFilters}
        />
      </Card>

      {activeTab === 'users' ? (
        <IndependentListCard<AdminUser>
          key="iam-users-list"
          activeTabKey={activeTab}
          tabList={listTabs}
          onTabChange={setActiveTab}
          tableId="iam-users-list"
          columns={userColumns}
          rowKey="id"
          queryState={usersController}
          pagination={buildStandardListPagination(userPagination, locale)}
          scrollX={720}
          emptyTitle={t('No users match these filters.')}
          onReload={() => void loadUsers()}
          onResetEmpty={resetVisibleFilters}
        />
      ) : (
        <IndependentListCard<AdminInvitation>
          key="iam-invitations-list"
          activeTabKey={activeTab}
          tabList={listTabs}
          onTabChange={setActiveTab}
          tableId="iam-invitations-list"
          columns={invitationColumns}
          rowKey="id"
          queryState={invitationsController}
          pagination={buildStandardListPagination(invitationPagination, locale)}
          scrollX={670 + INVITATION_ACTION_LAYOUT.columnWidth}
          emptyTitle={t('No invitations match these filters.')}
          onReload={() => void loadInvitations()}
          onResetEmpty={resetVisibleFilters}
        />
      )}

      {selectedUserId ? (
        <UserDetailPage
          key={selectedUserId}
          resourceId={selectedUserId}
          onClose={() =>
            setSelectedUserId((current) => (current === selectedUserId ? null : current))
          }
          onSaved={loadUsers}
        />
      ) : null}
      <Modal
        title={t('Invite user')}
        open={canInvite && inviteOpen}
        okText={t('Send invitation')}
        confirmLoading={invitationDialog.busy}
        onCancel={invitationDialog.requestClose}
        footer={(_, { OkBtn }) => <OkBtn />}
        mask={{ closable: !invitationDialog.busy }}
        keyboard={!invitationDialog.busy}
        onOk={() => form.submit()}
        destroyOnHidden
        forceRender
      >
        {inviteError ? <Alert className="mb-4" type="error" showIcon title={inviteError} /> : null}
        <Form<InviteValues>
          form={form}
          layout="vertical"
          onFinish={() =>
            void invitationDialog.submit(async (values) => {
              if (!canInvite) return

              setInviteError(null)
              try {
                await createAdminInvitation({
                  ...values,
                  displayName: values.displayName?.trim() || undefined,
                  email: values.email.trim(),
                  idempotencyKey: inviteKey.current,
                })
                if (!invitationDialog.isCurrent()) return
                void message.success(t('Invitation created.'))
                invitationDialog.complete()
                void reloadLatestInvitations().catch(() => undefined)
              } catch (error) {
                setInviteError(normalizeApiError(error).message)
              }
            })
          }
          disabled={invitationDialog.busy}
        >
          <Form.Item name="email" label={t('Email')} rules={[{ required: true, type: 'email' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="displayName" label={t('Display name')}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="roleId" label={t('Role')} rules={[{ required: true }]}>
            <Select
              options={assignableRoles.map((candidate) => ({
                label: candidate.name,
                value: candidate.id,
              }))}
              placeholder={t(assignableRoles.length ? 'Select a role' : 'No assignable roles')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </CustomPageRecipe>
  )
}
