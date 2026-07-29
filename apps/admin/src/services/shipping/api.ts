import type {
  ShippingZoneConfiguration,
  UpsertShippingZoneRequest,
} from '@shoppp/contracts'

import { apiClient } from '../../infrastructure/http/api-client'

export const fetchShippingZones = async (): Promise<ShippingZoneConfiguration[]> => {
  const response = await apiClient.get<{ data: ShippingZoneConfiguration[] }>(
    '/admin/settings/shipping'
  )
  return response.data.data
}

export const saveShippingZone = async (
  input: UpsertShippingZoneRequest
): Promise<ShippingZoneConfiguration> => {
  const idempotencyKey = `shipping-zone-${input.zone.id ?? 'create'}-${crypto.randomUUID()}`
  const response = input.zone.id
    ? await apiClient.put<{ data: ShippingZoneConfiguration }>(
        `/admin/settings/shipping/zones/${encodeURIComponent(input.zone.id)}`,
        input,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
    : await apiClient.post<{ data: ShippingZoneConfiguration }>(
        '/admin/settings/shipping/zones',
        input,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
  return response.data.data
}
