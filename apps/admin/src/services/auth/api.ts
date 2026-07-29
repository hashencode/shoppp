import { adminSessionSchema, type AdminSession } from '@shoppp/contracts'

import { apiClient } from '../../infrastructure/http/api-client'

export const fetchAdminSession = async (): Promise<AdminSession> => {
  const response = await apiClient.get<{ data: AdminSession }>('/admin/session')
  return adminSessionSchema.parse(response.data.data)
}
