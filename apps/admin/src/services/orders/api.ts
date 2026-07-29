import type {
  AdminOrder,
  AdminOrderDetail,
  CancelOrderRequest,
  FulfillmentTransitionRequest,
  RefundRequest,
} from '@shoppp/contracts'
import { apiClient } from '../../infrastructure/http/api-client'

export type OrderFilters = {
  fulfillmentStatus?: AdminOrder['fulfillmentStatus']
  orderStatus?: AdminOrder['orderStatus']
  page?: number
  pageSize?: number
  paymentStatus?: AdminOrder['paymentStatus']
  query?: string
}

export const fetchOrders = async (
  filters: OrderFilters
): Promise<{ data: AdminOrder[]; page: number; pageSize: number; total: number }> => {
  const response = await apiClient.get<{
    data: AdminOrder[]
    meta: { page: number; pageSize: number; total: number }
  }>('/admin/orders', { params: filters })
  return { data: response.data.data, ...response.data.meta }
}

export const fetchOrderDetail = async (reference: string): Promise<AdminOrderDetail> => {
  const response = await apiClient.get<{ data: AdminOrderDetail }>(
    `/admin/orders/${encodeURIComponent(reference)}`
  )
  return response.data.data
}

const mutationHeaders = (scope: string) => ({
  'Idempotency-Key': `${scope}-${crypto.randomUUID()}`,
})

export const transitionFulfillment = async (
  reference: string,
  input: FulfillmentTransitionRequest
): Promise<AdminOrderDetail> => {
  const response = await apiClient.post<{ data: AdminOrderDetail }>(
    `/admin/orders/${encodeURIComponent(reference)}/fulfillment`,
    input,
    { headers: mutationHeaders('fulfillment') }
  )
  return response.data.data
}

export const refundOrder = async (
  reference: string,
  input: RefundRequest
): Promise<AdminOrderDetail> => {
  const response = await apiClient.post<{ data: AdminOrderDetail }>(
    `/admin/orders/${encodeURIComponent(reference)}/refunds`,
    input,
    { headers: mutationHeaders('refund') }
  )
  return response.data.data
}

export const cancelOrder = async (
  reference: string,
  input: CancelOrderRequest
): Promise<AdminOrderDetail> => {
  const response = await apiClient.post<{ data: AdminOrderDetail }>(
    `/admin/orders/${encodeURIComponent(reference)}/cancel`,
    input,
    { headers: mutationHeaders('cancel') }
  )
  return response.data.data
}
