import type {
  AdminInvitation,
  AdminInvitationStatus,
  AdminRole,
  AdminUser,
  AdminUserStatus,
  CreateAdminInvitationRequest,
  CreateAdminRoleRequest,
  ResendAdminInvitationRequest,
  RevokeAdminInvitationRequest,
  UpdateAdminRoleRequest,
  UpdateAdminUserRequest,
} from '@shoppp/contracts'

import { apiClient } from '../../infrastructure/http/api-client'

export type IamPage<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

type PageQuery<TStatus extends string = never> = {
  page?: number
  pageSize?: number
  search?: string
  status?: TStatus
}

const data = <T>(response: { data: { data: T } }): T => response.data.data

export const fetchAdminUsers = async (query: PageQuery<AdminUserStatus> = {}) =>
  data(await apiClient.get<{ data: IamPage<AdminUser> }>('/admin/iam/users', { params: query }))

export const fetchAdminUser = async (id: string) =>
  data(await apiClient.get<{ data: AdminUser }>(`/admin/iam/users/${id}`))

export const updateAdminUser = async (id: string, input: UpdateAdminUserRequest) =>
  data(await apiClient.patch<{ data: AdminUser }>(`/admin/iam/users/${id}`, input))

export const fetchAdminInvitations = async (
  query: PageQuery<AdminInvitationStatus> = {}
) =>
  data(
    await apiClient.get<{ data: IamPage<AdminInvitation> }>('/admin/iam/invitations', {
      params: query,
    })
  )

export const createAdminInvitation = async (input: CreateAdminInvitationRequest) =>
  data(
    await apiClient.post<{ data: AdminInvitation }>('/admin/iam/invitations', input)
  )

export const resendAdminInvitation = async (
  id: string,
  input: ResendAdminInvitationRequest
) =>
  data(
    await apiClient.post<{ data: AdminInvitation }>(
      `/admin/iam/invitations/${id}/resend`,
      input
    )
  )

export const revokeAdminInvitation = async (
  id: string,
  input: RevokeAdminInvitationRequest
) =>
  data(
    await apiClient.post<{ data: AdminInvitation }>(
      `/admin/iam/invitations/${id}/revoke`,
      input
    )
  )

export const fetchAdminRoles = async (query: PageQuery = {}) =>
  data(await apiClient.get<{ data: IamPage<AdminRole> }>('/admin/iam/roles', { params: query }))

export const fetchAdminRole = async (id: string) =>
  data(await apiClient.get<{ data: AdminRole }>(`/admin/iam/roles/${id}`))

export const createAdminRole = async (input: CreateAdminRoleRequest) =>
  data(await apiClient.post<{ data: AdminRole }>('/admin/iam/roles', input))

export const updateAdminRole = async (id: string, input: UpdateAdminRoleRequest) =>
  data(await apiClient.patch<{ data: AdminRole }>(`/admin/iam/roles/${id}`, input))
