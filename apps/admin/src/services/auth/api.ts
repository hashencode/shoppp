import {
  adminSessionSchema,
  type AdminAccountActivationRequest,
  type AdminPasswordChangeRequest,
  type AdminPasswordLoginRequest,
  type AdminPasswordResetConfirmRequest,
  type AdminPasswordResetRequest,
  type AdminSession,
} from '@shoppp/contracts'

import { apiClient } from '../../infrastructure/http/api-client'

export const fetchAdminSession = async (): Promise<AdminSession> => {
  const response = await apiClient.get<{ data: AdminSession }>('/admin/session')
  return adminSessionSchema.parse(response.data.data)
}

export const loginAdmin = async (input: AdminPasswordLoginRequest): Promise<AdminSession> => {
  const response = await apiClient.post<{ data: AdminSession }>('/admin/auth/login', input)
  return adminSessionSchema.parse(response.data.data)
}

export const activateAdminAccount = async (
  input: AdminAccountActivationRequest
): Promise<AdminSession> => {
  const response = await apiClient.post<{ data: AdminSession }>('/admin/auth/activate', input)
  return adminSessionSchema.parse(response.data.data)
}

export const logoutAdmin = async (): Promise<void> => {
  await apiClient.post('/admin/auth/logout')
}

export const changeAdminPassword = async (input: AdminPasswordChangeRequest): Promise<void> => {
  await apiClient.post('/admin/auth/password/change', input)
}

export const requestAdminPasswordReset = async (
  input: AdminPasswordResetRequest
): Promise<void> => {
  await apiClient.post('/admin/auth/password-reset/request', input)
}

export const confirmAdminPasswordReset = async (
  input: AdminPasswordResetConfirmRequest
): Promise<void> => {
  await apiClient.post('/admin/auth/password-reset/confirm', input)
}
