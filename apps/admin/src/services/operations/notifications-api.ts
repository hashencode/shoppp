import type {
  NotificationJob,
  NotificationJobStatus,
  ReplayNotificationJobRequest,
} from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'

export type NotificationJobFilters = {
  page?: number
  pageSize?: number
  query?: string
  status?: NotificationJobStatus
  type?: NotificationJob['type']
}

export const fetchNotificationJobs = async (
  filters: NotificationJobFilters
): Promise<{ data: NotificationJob[]; page: number; pageSize: number; total: number }> => {
  const response = await apiClient.get<{
    data: NotificationJob[]
    meta: { page: number; pageSize: number; total: number }
  }>('/admin/operations/jobs', { params: filters })
  return { data: response.data.data, ...response.data.meta }
}

export const replayNotification = async (
  id: string,
  input: ReplayNotificationJobRequest
): Promise<NotificationJob> => {
  const response = await apiClient.post<{ data: NotificationJob }>(
    `/admin/operations/jobs/${encodeURIComponent(id)}/replay`,
    input,
    {
      headers: {
        'Idempotency-Key': `notification-replay-${crypto.randomUUID()}`,
      },
    }
  )
  return response.data.data
}
