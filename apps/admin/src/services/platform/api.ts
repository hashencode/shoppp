import type {
  AuditEvent,
  AuditQuery,
  ContactSettings,
  UpdateContactSettingsRequest,
  LaunchConfiguration,
  LaunchConfigurationStatus,
  OperationalHealth,
  SetupGuideDestinations,
  PrivacyRequest,
  CreatePrivacyRequest,
  CreatePolicyRequest,
  PolicyAuthority,
  PolicyTransitionRequest,
  StoreIdentity,
  UpdatePolicyRequest,
  UpdateStoreIdentityRequest,
} from '@shoppp/contracts'
import { contactSettingsSchema, setupGuideDestinationsSchema } from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'
import { saveBlob, toBlobFileName } from '../../shared/utils/download'

export const fetchSetupGuide = async (signal: AbortSignal): Promise<SetupGuideDestinations> => {
  const response = await apiClient.get<{ data: SetupGuideDestinations }>(
    '/admin/settings/setup-guide/destinations',
    { signal }
  )
  return setupGuideDestinationsSchema.parse(response.data.data)
}

export const fetchContactSettings = async (): Promise<ContactSettings> => {
  const response = await apiClient.get<{ data: ContactSettings }>('/admin/settings/contact')
  return contactSettingsSchema.parse(response.data.data)
}

export const updateContactSettings = async (
  input: UpdateContactSettingsRequest
): Promise<ContactSettings> => {
  const response = await apiClient.put<{ data: ContactSettings }>(
    '/admin/settings/contact',
    input,
    { headers: { 'Idempotency-Key': `contact-settings-${crypto.randomUUID()}` } }
  )
  return contactSettingsSchema.parse(response.data.data)
}

export type ReleaseInclusion = { candidate: boolean; live: boolean }
export type StoreIdentityView = StoreIdentity & { inclusion?: ReleaseInclusion }
export type PolicyAuthorityView = PolicyAuthority & { inclusion?: ReleaseInclusion }

export const fetchStoreIdentity = async (): Promise<StoreIdentityView | null> => {
  const response = await apiClient.get<{ data: StoreIdentityView | null }>(
    '/admin/settings/store-identity'
  )
  return response.data.data
}

export const updateStoreIdentity = async (
  input: UpdateStoreIdentityRequest
): Promise<StoreIdentityView> => {
  const response = await apiClient.put<{ data: StoreIdentityView }>(
    '/admin/settings/store-identity',
    input,
    { headers: { 'Idempotency-Key': `store-identity-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export type PolicyReview = {
  current: PolicyAuthorityView
  digest: string
  previous: PolicyAuthorityView | null
  previousRenderedText: string | null
  renderedText: string
}

export type PolicyListPage = { items: PolicyAuthorityView[]; nextCursor: string | null }

export const fetchPolicies = async (cursor?: string): Promise<PolicyListPage> => {
  const response = await apiClient.get<{
    data: PolicyAuthorityView[]
    meta?: { nextCursor?: string | null }
  }>('/admin/settings/policies', { params: { cursor, limit: 50 } })
  return {
    items: response.data.data,
    nextCursor: response.data.meta?.nextCursor ?? null,
  }
}

export const createPolicy = async (input: CreatePolicyRequest): Promise<PolicyAuthority> => {
  const response = await apiClient.post<{ data: PolicyAuthority }>(
    '/admin/settings/policies',
    input,
    { headers: { 'Idempotency-Key': `policy-create-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export const updatePolicy = async (
  id: string,
  input: UpdatePolicyRequest
): Promise<PolicyAuthority> => {
  const response = await apiClient.put<{ data: PolicyAuthority }>(
    `/admin/settings/policies/${encodeURIComponent(id)}`,
    input,
    { headers: { 'Idempotency-Key': `policy-update-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export const reviewPolicy = async (id: string, version?: number): Promise<PolicyReview> => {
  const response = await apiClient.get<{ data: PolicyReview }>(
    `/admin/settings/policies/${encodeURIComponent(id)}/review`,
    { params: { version } }
  )
  return response.data.data
}

export const transitionPolicy = async (
  id: string,
  action: 'approve' | 'publish' | 'archive',
  input: PolicyTransitionRequest
): Promise<PolicyAuthority> => {
  const response = await apiClient.post<{ data: PolicyAuthority }>(
    `/admin/settings/policies/${encodeURIComponent(id)}/${action}`,
    input,
    { headers: { 'Idempotency-Key': `policy-${action}-${crypto.randomUUID()}` } }
  )
  return response.data.data
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
    { configuration, confirm: true, preserveContactEmails: true, reason },
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
