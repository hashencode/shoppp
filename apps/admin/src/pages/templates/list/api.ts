import { apiClient } from '../../../infrastructure/http/api-client'

export const fetchRuleList = async (filters: RuleListFilters): Promise<RuleListResponse> => {
  const response = await apiClient.get<RuleListResponse>('/api/template/rules', {
    params: {
      name: filters.name,
      status: filters.status,
      statusDetail: filters.statusDetail,
      updatedAt: filters.updatedAt,
    },
  })

  return response.data
}

export type RuleStatus = 0 | 1 | 2 | 3

export type RuleItem = {
  key: string
  name: string
  desc: string
  callNo: number
  status: RuleStatus
  updatedAt: string
}

export type RuleListFilters = {
  name?: string
  status?: RuleStatus
  statusDetail?: string
  updatedAt?: string
}

export type RuleListResponse = {
  data: RuleItem[]
  partial?: boolean
  partialMessage?: string
}
