import { apiClient } from '../../infrastructure/http/api-client'

export type InventoryListItem = {
  adjusted: number
  available: number
  onHand: number
  oversellLimit: number
  productName: string
  reserved: number
  sku: string
  variantId: string
  variantName: string
  warehouseId: string
  warehouseName: string
}

export type InventoryHistoryEntry = {
  actor_name: string | null
  created_at: string
  id: string
  quantity_delta: number
  reason: string
  reference_id: string | null
  reference_type: string | null
}

export type InventoryDetail = {
  history: InventoryHistoryEntry[]
  position: {
    available: number
    onHand: number
    oversellLimit: number
    reserved: number
    variantId: string
    warehouseId: string
  }
}

export const fetchInventory = async (filters: {
  page?: number
  pageSize?: number
  query?: string
}): Promise<{ data: InventoryListItem[]; total: number }> => {
  const response = await apiClient.get<{
    data: InventoryListItem[]
    meta: { total: number }
  }>('/admin/inventory', { params: filters })
  return { data: response.data.data, total: response.data.meta.total }
}

export const fetchInventoryDetail = async (
  variantId: string,
  warehouseId: string
): Promise<InventoryDetail> => {
  const response = await apiClient.get<{ data: InventoryDetail }>(
    `/admin/inventory/${encodeURIComponent(variantId)}/${encodeURIComponent(warehouseId)}`
  )
  return response.data.data
}

export const adjustInventory = async (
  variantId: string,
  warehouseId: string,
  input: { quantityDelta: number; reason: string }
): Promise<InventoryDetail> => {
  const response = await apiClient.post<{ data: InventoryDetail }>(
    `/admin/inventory/${encodeURIComponent(variantId)}/${encodeURIComponent(
      warehouseId
    )}/adjustments`,
    input,
    { headers: { 'Idempotency-Key': `inventory-adjust-${crypto.randomUUID()}` } }
  )
  return response.data.data
}
