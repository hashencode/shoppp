import { apiClient } from '../../../infrastructure/http/api-client'

type FormDetailResponse = {
  data: FormEntity
}

export const fetchFormDetail = async (resourceKey: string): Promise<FormEntity> => {
  const response = await apiClient.get<FormDetailResponse>(`/api/template/forms/${resourceKey}`)
  return response.data.data
}

export const createForm = async (payload: FormPayload): Promise<FormEntity> => {
  const response = await apiClient.post<FormDetailResponse>('/api/template/forms', payload)
  return response.data.data
}

export const updateForm = async (resourceKey: string, payload: FormPayload): Promise<FormEntity> => {
  const response = await apiClient.put<FormDetailResponse>(`/api/template/forms/${resourceKey}`, payload)
  return response.data.data
}

export type FormEntity = {
  resourceKey: string
  title: string
  dateRangeStart: string
  dateRangeEnd: string
  goal: string
  standard: string
  client?: string
  invites?: string
  weight?: number
  publicType: '1' | '2' | '3'
  publicUsers?: string[]
}

export type FormPayload = Omit<FormEntity, 'resourceKey'>
