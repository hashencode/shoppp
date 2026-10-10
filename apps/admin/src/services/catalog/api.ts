import { apiClient } from '../../infrastructure/http/api-client'

export type ProductStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export type CatalogPreviewCandidate = {
  environment: 'development' | 'staging' | 'production'
  id: string
  manifestDigest: string
  purpose: 'private-preview'
  sourceDigest: string
  sources: Array<{
    digest: string
    id: string
    kind: 'store-identity' | 'policy' | 'product' | 'collection' | 'page' | 'article' | 'navigation'
    version: number
  }>
  status: 'pending' | 'succeeded' | 'failed' | 'abandoned' | 'expired'
}

export const buildCatalogPreviewCandidate = async (
  reason: string
): Promise<CatalogPreviewCandidate> => {
  const response = await apiClient.post<{ data: CatalogPreviewCandidate }>(
    '/admin/catalog/releases/preview-candidates',
    { reason },
    { headers: { 'Idempotency-Key': `catalog-candidate-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export type ProductReview = {
  body: string
  displayName: string
  id: string
  moderatedAt: string | null
  moderatedBy: string | null
  moderationReason: string | null
  productId: string
  rating: number
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
}

export const fetchPendingProductReviews = async (after?: string) => {
  const response = await apiClient.get<{
    data: { items: ProductReview[]; nextCursor: string | null }
  }>('/admin/catalog/reviews', { params: after ? { after } : {} })
  return response.data.data
}

export const fetchProductReview = async (id: string) => {
  const response = await apiClient.get<{ data: ProductReview }>(`/admin/catalog/reviews/${id}`)
  return response.data.data
}

export const moderateProductReview = async (
  id: string,
  decision: 'approved' | 'rejected',
  reason: string
) => {
  const response = await apiClient.post<{ data: ProductReview }>(
    `/admin/catalog/reviews/${id}/moderate`,
    { decision, reason },
    { headers: { 'Idempotency-Key': `review-moderation-${crypto.randomUUID()}` } }
  )
  return response.data.data
}

export type ProductOptionDefinition = {
  name: string
  presentation: 'text' | 'color'
  values: Array<{ label: string; swatch?: string }>
}

export type ProductPresentation = {
  brand?: string
  purchaseStatus?: 'unverified'
  defaultVariantId?: string
  detail?: {
    body?: string
    bullets: string[]
    eyebrow?: string
    heading?: string
  }
  detailMediaId?: string
  reviewDisplay?: {
    averageRating: number
    count: number
    entries: Array<{ author: string; date: string; id?: string; rating?: number; text: string }>
    provenance: string
    ratingBands?: [number, number, number, number, number]
    updatedAt: string
  }
  specifications: Array<{ label: string; value: string }>
}

export type CatalogProductListItem = {
  id: string
  name: string
  slug: string
  status: ProductStatus
  updated_at: string
  version: number
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
  expectedVersion?: number
  optionDefinitions?: ProductOptionDefinition[]
  seoDescription: string
  seoTitle: string
  slug: string
  variants: Array<{
    dimensionsMm?: { height: number; length: number; width: number }
    optionValues: Record<string, string>
    prices: Array<{
      amount: number
      compareAtAmount?: number
      currency: string
      priceListCode: string
    }>
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
    option_definitions_json: string
    presentation_json?: string | null
    description: string
    status: ProductStatus
    seo_title: string
    seo_description: string
    scheduled_at?: string | null
    updated_at: string
    version: number
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
    compare_at_amount?: number | null
    currency: string
    price_list_code: string
    variant_id: string
  }>
  media: Array<{
    alt_text: string
    height: number
    id: string
    r2_key: string
    width: number
  }>
}

export type PublishedProductRevisionContent = {
  description: string
  media: Array<{ altText: string; height: number; id: string; r2Key: string; width: number }>
  name: string
  optionDefinitions?: Array<{
    name: string
    presentation: 'text' | 'color'
    values: Array<{ label: string; swatch?: string }>
  }>
  presentation: ProductPresentation | null
  seoDescription: string
  seoTitle: string
  variantOptions?: Array<{ id: string; optionValues: Record<string, string>; title: string }>
}

export type PublishedProductRevision = {
  baseProductVersion: number
  basePublishedRevisionId: string | null
  content: PublishedProductRevisionContent
  id: string
  status: 'draft' | 'building' | 'published' | 'failed'
  version: number
}

export type PublishedProductRevisionState = {
  draft: PublishedProductRevision | null
  productVersion: number
  published: PublishedProductRevision | null
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

export type CatalogCollection = {
  candidate: {
    candidateDigest: string | null
    candidateReleaseId: string | null
    candidateStaleCause: 'saved_version_newer' | null
    liveDigest: string | null
    liveReleaseId: string | null
    liveStaleCause: 'saved_version_newer' | null
  }
  coverAssetId: string | null
  createdAt: string
  description: string
  id: string
  name: string
  productIds: string[]
  products: Array<{ id: string; name: string; position: number; slug: string }>
  publishedAt: string | null
  redirectFromOldSlug: boolean
  seo: { description: string; title: string }
  slug: string
  status: 'draft' | 'published' | 'archived'
  updatedAt: string
  version: number
}

export type CollectionWritePayload = {
  coverAssetId?: string | null
  description: string
  expectedVersion?: number
  name: string
  productIds: string[]
  reason: string
  redirectFromOldSlug?: boolean
  seoDescription: string
  seoTitle: string
  slug: string
  status: CatalogCollection['status']
}

export const fetchCatalogCollections = async (filters: {
  page?: number
  pageSize?: number
  productId?: string
  query?: string
  status?: CatalogCollection['status']
}): Promise<{ data: CatalogCollection[]; total: number }> => {
  const response = await apiClient.get<{ data: CatalogCollection[]; meta: { total: number } }>(
    '/admin/catalog/collections',
    { params: filters }
  )
  return { data: response.data.data, total: response.data.meta.total }
}

export const fetchCatalogCollection = async (id: string): Promise<CatalogCollection> => {
  const response = await apiClient.get<{ data: CatalogCollection }>(
    `/admin/catalog/collections/${id}`
  )
  return response.data.data
}

export const createCatalogCollection = async (
  payload: CollectionWritePayload
): Promise<CatalogCollection> => {
  const response = await apiClient.post<{ data: CatalogCollection }>(
    '/admin/catalog/collections',
    payload
  )
  return response.data.data
}

export const updateCatalogCollection = async (
  id: string,
  payload: CollectionWritePayload
): Promise<CatalogCollection> => {
  const response = await apiClient.put<{ data: CatalogCollection }>(
    `/admin/catalog/collections/${id}`,
    payload
  )
  return response.data.data
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

export const fetchPublishedProductRevisions = async (
  id: string
): Promise<PublishedProductRevisionState> => {
  const response = await apiClient.get<{ data: PublishedProductRevisionState }>(
    `/admin/catalog/products/${id}/revisions`
  )
  return response.data.data
}

export const stagePublishedProductRevision = async (
  id: string,
  input: {
    content: PublishedProductRevisionContent
    expectedDraftVersion: number | null
    expectedProductVersion: number
    expectedPublishedRevisionId: string | null
  }
): Promise<PublishedProductRevision> => {
  const response = await apiClient.put<{ data: PublishedProductRevision }>(
    `/admin/catalog/products/${id}/revisions/draft`,
    input
  )
  return response.data.data
}

export const previewPublishedProductRevision = async (
  id: string,
  revisionId: string
): Promise<{
  product: {
    description: string
    id: string
    media: Array<{ alt: string; id: string; src: string }>
    name: string
    slug: string
  }
  revisionId: string
  sourceProductVersion: number
}> => {
  const response = await apiClient.get<{
    data: {
      product: {
        description: string
        id: string
        media: Array<{ alt: string; id: string; src: string }>
        name: string
        slug: string
      }
      revisionId: string
      sourceProductVersion: number
    }
  }>(`/admin/catalog/products/${id}/revisions/preview`, { params: { revisionId } })
  return response.data.data
}

export const publishPublishedProductRevision = async (
  id: string,
  input: {
    expectedDraftVersion: number | null
    expectedProductVersion: number
    expectedPublishedRevisionId: string | null
    reason: string
    revisionId: string | null
  }
): Promise<{ buildCorrelationId: string; releaseId: string; status: string }> => {
  const response = await apiClient.post<{
    data: { buildCorrelationId: string; releaseId: string; status: string }
  }>(`/admin/catalog/products/${id}/revisions/publish`, input, {
    headers: { 'Idempotency-Key': `catalog-revision-${id}-${crypto.randomUUID()}` },
  })
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

export const updateCatalogProductOptionDefinitions = async (
  id: string,
  optionDefinitions: ProductOptionDefinition[],
  expectedVersion: number
): Promise<{
  id: string
  optionDefinitions: ProductOptionDefinition[]
  status: ProductStatus
  version: number
}> => {
  const response = await apiClient.patch<{
    data: {
      id: string
      optionDefinitions: ProductOptionDefinition[]
      status: ProductStatus
      version: number
    }
  }>(`/admin/catalog/products/${id}/option-definitions`, { expectedVersion, optionDefinitions })
  return response.data.data
}

export const updateCatalogProductPresentation = async (
  id: string,
  presentation: ProductPresentation,
  expectedVersion: number
): Promise<{ presentation: ProductPresentation; version: number }> => {
  const response = await apiClient.patch<{
    data: { presentation: ProductPresentation; version: number }
  }>(`/admin/catalog/products/${id}/presentation`, { expectedVersion, presentation })
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

export const publishCatalogProduct = async (
  id: string,
  reason: string,
  expectedVersion: number
): Promise<{ buildCorrelationId: string; releaseId: string; status: string }> => {
  const response = await apiClient.post<{
    data: { buildCorrelationId: string; releaseId: string; status: string }
  }>(
    `/admin/catalog/products/${id}/publish`,
    { expectedVersion, reason },
    { headers: { 'Idempotency-Key': `catalog-publish-${id}-${Date.now()}` } }
  )
  return response.data.data
}
