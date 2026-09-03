import type { OrderTimelineEntry } from '@shoppp/contracts'
import { describe, expect, it } from '@rstest/core'
import { translateMessage } from '../../shared/contexts/i18n-context'
import {
  timelineKind,
  timelineLabel,
  timelineStatus,
  hasShipmentDetails,
} from './order-timeline-messages'

const zh = (message: string) => translateMessage('zh-CN', message)
const entry = (
  kind: OrderTimelineEntry['kind'],
  label: string,
  status?: string | null
): OrderTimelineEntry => ({
  id: 'event',
  createdAt: '2026-09-03T00:00:00.000Z',
  kind,
  label,
  status,
})

describe('order timeline messages', () => {
  it.each([
    ['payment', 'checkout.payment_succeeded', 'applied', '支付', '结账支付成功', '支付事件已应用'],
    ['order', 'confirmed', 'confirmed', '订单', '订单已确认', '订单已确认'],
    ['fulfillment', 'picking', 'picking', '履约', '拣货中', '拣货中'],
    ['refund', 'refund', 'succeeded', '退款', '退款', '退款成功'],
    ['notification', 'order_receipt', 'sent', '通知', '订单收据', '通知已发送'],
    ['audit', 'orders.cancel', 'denied', '审计', '取消订单', '操作被拒绝'],
  ] as const)(
    'should translate %s within its own domain',
    (kind, label, status, dimension, event, result) => {
      const value = entry(kind, label, status)
      expect(timelineKind(kind, zh)).toBe(dimension)
      expect(timelineLabel(value, zh)).toBe(event)
      expect(timelineStatus(value, zh)).toBe(result)
    }
  )

  it('should preserve unknown codes and never translate values from another domain or dictionary', () => {
    for (const kind of [
      'payment',
      'order',
      'fulfillment',
      'refund',
      'notification',
      'audit',
    ] as const) {
      for (const raw of ['future_code', 'Refund', 'Order', 'constructor', '__proto__']) {
        expect(timelineLabel(entry(kind, raw, raw), zh)).toBe(raw)
        expect(timelineStatus(entry(kind, raw, raw), zh)).toBe(raw)
      }
      expect(timelineStatus(entry(kind, 'future', null), zh)).toBe('—')
      expect(timelineStatus(entry(kind, 'future'), zh)).toBe('—')
    }
    expect(timelineKind('Refund', zh)).toBe('Refund')
    expect(timelineLabel(entry('audit', 'payment.session.create'), zh)).toBe(
      'payment.session.create'
    )
    expect(timelineStatus(entry('notification', 'refund', 'applied'), zh)).toBe('applied')
  })

  it('should treat missing shipment fields as legacy but null and empty fields as structured', () => {
    const legacy = entry('fulfillment', 'shipped · Refund  # / ·  ', 'shipped')
    expect(hasShipmentDetails(legacy)).toBe(false)
    expect(timelineLabel(legacy, zh)).toBe(legacy.label)
    expect(timelineStatus(legacy, zh)).toBe('已发货')
    for (const raw of [null, '', '  ', 'Order / # 42']) {
      const structured = { ...legacy, carrier: raw, trackingNumber: raw }
      expect(hasShipmentDetails(structured)).toBe(true)
      expect(timelineLabel(structured, zh)).toBe('已发货')
      expect(structured.carrier).toBe(raw)
      expect(structured.trackingNumber).toBe(raw)
    }
    expect(hasShipmentDetails({ ...legacy, carrier: null })).toBe(true)
    expect(hasShipmentDetails({ ...legacy, trackingNumber: '' })).toBe(true)
    expect(timelineLabel({ ...legacy, status: 'future_state', carrier: null }, zh)).toBe(
      legacy.label
    )
  })
})
