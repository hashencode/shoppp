import { apiClient } from '../../infrastructure/http/api-client'

export type ProductStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export type CatalogProductListItem = {
  id: string
  name: string
  slug: string
  status: ProductStatus
  updated_at: string
  build_status?: string | null
  build_correlation_id?: string | null
}

export type ProductDraftPayload = {
  categories?: Array<{ name: string; slug: string }>
  collections?: Array<{ name: string; slug: string }>
  description: string
  media: Array<{
    altText: string
    height: number
    r2Key: string
    width: number
  }>
  name: string
  seoDescription: string
  seoTitle: string
  slug: string
  variants: Array<{
    dimensionsMm?: { height: number; length: number; width: number }
    optionValues: Record<string, string>
    prices: Array<{ amount: number; currency: string; priceListCode: string }>
    sku: string
    title: string
    weightGrams: number
  }>
  publicationStatus?: 'draft' | 'scheduled'
  scheduledAt?: string | null
}

export type ProductDetail = {
  categories?: Array<{ id: string; name: string; slug: string }>
  collections?: Array<{ id: string; name: string; slug: string }>
  product: {
    id: string
    slug: string
    name: string
    description: string
    status: ProductStatus
    seo_title: string
    seo_description: string
    scheduled_at?: string | null
  }
  variants: Array<{
    id: string
    sku: string
    title: string
    option_values_json: string
    weight_grams: number
    length_mm?: number
    width_mm?: number
    height_mm?: number
  }>
  prices: Array<{
    amount: number
    currency: string
    price_list_code: string
    variant_id: string
  }>
  media: Array<{
    alt_text: string
    height: number
    r2_key: string
    width: number
  }>
}

export type CatalogListFilters = {
  query?: string
  status?: ProductStatus
  page?: number
  pageSize?: number
}

export type CatalogListResponse = {
  data: CatalogProductListItem[]
  total: number
}

export const fetchCatalogProducts = async (
  filters: CatalogListFilters
): Promise<CatalogListResponse> => {
  const response = await apiClient.get<{
    data: CatalogProductListItem[]
    meta: { total: number }
  }>('/admin/catalog/products', { params: filters })
  return { data: response.data.data, total: response.data.meta.total }
}

export const fetchCatalogProduct = async (id: string): Promise<ProductDetail> => {
  const response = await apiClient.get<{ data: ProductDetail }>(`/admin/catalog/products/${id}`)
  return response.data.data
}

export const createCatalogProduct = async (
  payload: ProductDraftPayload
): Promise<{ id: string; status: ProductStatus }> => {
  const response = await apiClient.post<{ data: { id: string; status: ProductStatus } }>(
    '/admin/catalog/products',
    payload
  )
  return response.data.data
}

export const updateCatalogProduct = async (
  id: string,
  payload: ProductDraftPayload
): Promise<{ id: string; status: ProductStatus }> => {
  const response = await apiClient.put<{ data: { id: string; status: ProductStatus } }>(
    `/admin/catalog/products/${id}`,
    payload
  )
  return response.data.data
}

export const uploadCatalogMedia = async (
  key: string,
  file: File
): Promise<{ key: string; size: number }> => {
  const response = await apiClient.put<{ data: { key: string; size: number } }>(
    `/admin/media/${key}`,
    file,
    {
      headers: { 'Content-Type': file.type },
    }
  )
  return response.data.data
}

export const previewCatalogProduct = async (
  id: string
): Promise<{ token: string; expiresAt: string }> => {
  const response = await apiClient.post<{ data: { token: string; expiresAt: string } }>(
    `/admin/catalog/products/${id}/preview`
  )
  return response.data.data
}

export const publishCatalogProduct = async (
  id: string,
  reason: string
): Promise<{ buildCorrelationId: string; releaseId: string; status: string }> => {
  const response = await apiClient.post<{
    data: { buildCorrelationId: string; releaseId: string; status: string }
  }>(
    `/admin/catalog/products/${id}/publish`,
    { reason },
    { headers: { 'Idempotency-Key': `catalog-publish-${id}-${Date.now()}` } }
  )
  return response.data.data
}
