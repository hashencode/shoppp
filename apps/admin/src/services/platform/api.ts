import type {
  AuditEvent,
  AuditQuery,
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
  SetupGuideSummary,
  PrivacyRequest,
  CreatePrivacyRequest,
} from '@shoppp/contracts'
import { setupGuideSummarySchema } from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'
import { saveBlob, toBlobFileName } from '../../shared/utils/download'

export const fetchSetupGuide = async (): Promise<SetupGuideSummary> => {
  const response = await apiClient.get<{ data: SetupGuideSummary }>('/admin/settings/setup-guide')
  return setupGuideSummarySchema.parse(response.data.data)
}

export const fetchLaunchConfiguration = async (): Promise<LaunchConfigurationStatus> => {
  const response = await apiClient.get<{ data: LaunchConfigurationStatus }>(
    '/admin/settings/launch'
  )
  return response.data.data
}

export const updateLaunchConfiguration = async (
  configuration: LaunchConfiguration,
  reason: string
): Promise<LaunchConfigurationStatus> => {
  const response = await apiClient.put<{ data: LaunchConfigurationStatus }>(
    '/admin/settings/launch',
    { configuration, confirm: true, reason },
    { headers: { 'Idempotency-Key': `launch-settings-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export const fetchOperationalHealth = async (): Promise<OperationalHealth> => {
  const response = await apiClient.get<{ data: OperationalHealth }>('/admin/operations/health')
  return response.data.data
}

export const fetchAuditEvents = async (
  query: AuditQuery
): Promise<{ data: AuditEvent[]; nextCursor: string | null }> => {
  const response = await apiClient.get<{
    data: AuditEvent[]
    meta: { nextCursor: string | null }
  }>('/admin/audit', { params: query })
  return { data: response.data.data, nextCursor: response.data.meta.nextCursor }
}

export const fetchPrivacyRequests = async (): Promise<PrivacyRequest[]> => {
  const response = await apiClient.get<{ data: PrivacyRequest[] }>('/admin/privacy/requests')
  return response.data.data
}

export const createPrivacyRequest = async (
  input: CreatePrivacyRequest
): Promise<PrivacyRequest> => {
  const response = await apiClient.post<{ data: PrivacyRequest }>(
    '/admin/privacy/requests',
    input,
    { headers: { 'Idempotency-Key': `privacy-request-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export const downloadPrivacyExport = async (request: PrivacyRequest): Promise<void> => {
  const response = await apiClient.get<Blob>(
    `/admin/privacy/requests/${encodeURIComponent(request.id)}/download`,
    { responseType: 'blob' }
  )
  saveBlob(
    response.data,
    toBlobFileName(response.headers['content-disposition'], `privacy-${request.id}.json`)
  )
}
