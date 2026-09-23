import type {
  ContentArticle,
  ContentArticleWriteRequest,
  ContentPage,
  ContentPageWriteRequest,
  ContentTransitionRequest,
} from '@shoppp/contracts'

import { apiClient } from '../../infrastructure/http/api-client'

export type ContentInclusion = {
  candidate: boolean
  candidateStale: boolean
  live: boolean
  liveStale: boolean
}
export type ContentPageRecord = ContentPage & { inclusion: ContentInclusion; route: string }
export type ContentArticleRecord = ContentArticle & { inclusion: ContentInclusion; route: string }
export type ContentKind = 'page' | 'article'
export type ContentMediaAsset = {
  alt: string
  height: number
  id: string
  productName: string
  src: string
  width: number
}

export async function fetchContentMedia(query = ''): Promise<ContentMediaAsset[]> {
  const response = await apiClient.get<{ data: ContentMediaAsset[] }>('/admin/content/media', {
    params: { page: 1, pageSize: 100, query: query || undefined },
  })
  return response.data.data
}

const base = (kind: ContentKind) => `/admin/content/${kind === 'page' ? 'pages' : 'articles'}`

export async function fetchContentList(
  kind: ContentKind,
  params: {
    page?: number
    pageSize?: number
    query?: string
    status?: 'draft' | 'published' | 'archived'
  }
) {
  const response = await apiClient.get<{
    data: Array<ContentPageRecord | ContentArticleRecord>
    meta: { total: number }
  }>(base(kind), { params })
  return { data: response.data.data, total: response.data.meta.total }
}

export async function fetchContentRecord(kind: 'page', id: string): Promise<ContentPageRecord>
export async function fetchContentRecord(kind: 'article', id: string): Promise<ContentArticleRecord>
export async function fetchContentRecord(kind: ContentKind, id: string) {
  const response = await apiClient.get<{ data: ContentPageRecord | ContentArticleRecord }>(
    `${base(kind)}/${encodeURIComponent(id)}`
  )
  return response.data.data
}

export async function createContentRecord(
  kind: 'page',
  input: ContentPageWriteRequest
): Promise<ContentPageRecord>
export async function createContentRecord(
  kind: 'article',
  input: ContentArticleWriteRequest
): Promise<ContentArticleRecord>
export async function createContentRecord(
  kind: ContentKind,
  input: ContentPageWriteRequest | ContentArticleWriteRequest
) {
  const response = await apiClient.post<{ data: ContentPageRecord | ContentArticleRecord }>(
    base(kind),
    input,
    { headers: { 'Idempotency-Key': `content-${kind}-create-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export async function updateContentRecord(
  kind: 'page',
  id: string,
  input: ContentPageWriteRequest
): Promise<ContentPageRecord>
export async function updateContentRecord(
  kind: 'article',
  id: string,
  input: ContentArticleWriteRequest
): Promise<ContentArticleRecord>
export async function updateContentRecord(
  kind: ContentKind,
  id: string,
  input: ContentPageWriteRequest | ContentArticleWriteRequest
) {
  const response = await apiClient.put<{ data: ContentPageRecord | ContentArticleRecord }>(
    `${base(kind)}/${encodeURIComponent(id)}`,
    input,
    { headers: { 'Idempotency-Key': `content-${kind}-update-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export async function transitionContentRecord(
  kind: ContentKind,
  id: string,
  action: 'archive' | 'publish',
  input: ContentTransitionRequest
) {
  const response = await apiClient.post<{ data: ContentPageRecord | ContentArticleRecord }>(
    `${base(kind)}/${encodeURIComponent(id)}/${action}`,
    input,
    { headers: { 'Idempotency-Key': `content-${kind}-${action}-${crypto.randomUUID()}` } }
  )
  return response.data.data
}
