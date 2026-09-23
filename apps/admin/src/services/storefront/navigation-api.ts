import type {
  NavigationMenu,
  NavigationMenuWriteRequest,
  NavigationTransitionRequest,
} from '@shoppp/contracts'
import type { StorefrontCatalogResource } from './api'

import { apiClient } from '../../infrastructure/http/api-client'

export type NavigationPlacement = 'header' | 'footer'
export type NavigationInclusion = {
  candidate: boolean
  candidateStale: boolean
  live: boolean
  liveStale: boolean
  staleCauses: string[]
}
export type NavigationMenuRecord = NavigationMenu & { inclusion: NavigationInclusion }

const base = (placement: NavigationPlacement) => `/admin/storefront/navigation/${placement}`

export async function fetchNavigationMenu(placement: NavigationPlacement) {
  const response = await apiClient.get<{ data: NavigationMenuRecord | null }>(base(placement))
  return response.data.data
}

export async function fetchNavigationResources(input: {
  kind: StorefrontCatalogResource['kind']
  page: number
  pageSize: number
  query: string
}) {
  const response = await apiClient.get<{
    data: StorefrontCatalogResource[]
    page: number
    pageSize: number
    total: number
  }>('/admin/storefront/navigation/resources', {
    params: { ...input, query: input.query || undefined },
  })
  return response.data
}

export async function saveNavigationMenu(
  placement: NavigationPlacement,
  input: NavigationMenuWriteRequest
) {
  const response = await apiClient.put<{ data: NavigationMenuRecord }>(base(placement), input, {
    headers: { 'Idempotency-Key': `navigation-${placement}-save-${crypto.randomUUID()}` },
  })
  return response.data.data
}

export async function transitionNavigationMenu(
  placement: NavigationPlacement,
  action: 'archive' | 'publish',
  input: NavigationTransitionRequest
) {
  const response = await apiClient.post<{ data: NavigationMenuRecord }>(
    `${base(placement)}/${action}`,
    input,
    { headers: { 'Idempotency-Key': `navigation-${placement}-${action}-${crypto.randomUUID()}` } }
  )
  return response.data.data
}
