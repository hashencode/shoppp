import type { OrderTimelineEntry } from '@shoppp/contracts'

type Translate = (message: string) => string
type Messages = Readonly<Record<string, string>>

const kindMessages: Messages = {
  payment: 'Payment',
  order: 'Order',
  fulfillment: 'Fulfillment',
  refund: 'Refund',
  notification: 'Notification',
  audit: 'Audit',
}

const orderMessages: Messages = {
  checkout_pending: 'Awaiting checkout',
  confirmed: 'Order confirmed',
  processing: 'Order processing',
  completed: 'Order completed',
  canceled: 'Order canceled',
}

const fulfillmentMessages: Messages = {
  unfulfilled: 'Awaiting fulfillment',
  picking: 'Picking items',
  packed: 'Items packed',
  shipped: 'Shipment dispatched',
  delivered: 'Shipment delivered',
  canceled: 'Fulfillment canceled',
}

// Only codes produced for this timeline's domain belong here. In particular,
// checkout-attempt audits and account notifications are not order events.
const labelMessages: Readonly<Record<string, Messages>> = {
  payment: {
    'checkout.completed': 'Checkout completed',
    'checkout.expired': 'Checkout expired',
    'checkout.payment_failed': 'Checkout payment failed',
    'checkout.payment_succeeded': 'Checkout payment succeeded',
    ignored: 'Ignored provider event',
  },
  order: orderMessages,
  fulfillment: fulfillmentMessages,
  refund: { refund: 'Refund' },
  notification: {
    order_receipt: 'Order receipt',
    payment_failed: 'Payment failure notification',
    cancellation: 'Cancellation notification',
    refund: 'Refund notification',
    shipment: 'Shipment notification',
  },
  audit: {
    'orders.cancel': 'Cancel order',
    'orders.refund': 'Issue refund',
    'orders.fulfill': 'Update fulfillment',
  },
}

const statusMessages: Readonly<Record<string, Messages>> = {
  payment: {
    applied: 'Payment event applied',
    ignored: 'Payment event ignored',
    failed: 'Payment event failed',
  },
  order: orderMessages,
  fulfillment: fulfillmentMessages,
  refund: {
    pending: 'Refund pending',
    succeeded: 'Refund succeeded',
    failed: 'Refund failed',
    canceled: 'Refund canceled',
  },
  notification: {
    pending: 'Notification pending',
    processing: 'Notification processing',
    sent: 'Notification sent',
    failed: 'Notification failed',
    dead_letter: 'Notification exhausted retries',
  },
  audit: {
    succeeded: 'Operation succeeded',
    failed: 'Operation failed',
    denied: 'Operation denied',
  },
}

const translateKnown = (messages: Messages | undefined, value: string, t: Translate) =>
  messages && Object.hasOwn(messages, value) ? t(messages[value]!) : value

const domainMessages = (catalog: Readonly<Record<string, Messages>>, kind: string) =>
  Object.hasOwn(catalog, kind) ? catalog[kind] : undefined

export const hasShipmentDetails = (entry: OrderTimelineEntry) =>
  entry.kind === 'fulfillment' &&
  (entry.carrier !== undefined || entry.trackingNumber !== undefined)

export const timelineKind = (kind: string, t: Translate) => translateKnown(kindMessages, kind, t)

export const timelineLabel = (entry: OrderTimelineEntry, t: Translate) => {
  if (entry.kind === 'fulfillment' && entry.status === 'shipped') {
    // Historical mixed labels are opaque: never split a carrier or tracking number.
    return hasShipmentDetails(entry)
      ? translateKnown(fulfillmentMessages, entry.status, t)
      : entry.label
  }
  return translateKnown(domainMessages(labelMessages, entry.kind), entry.label, t)
}

export const timelineStatus = (entry: OrderTimelineEntry, t: Translate) =>
  entry.status == null
    ? '—'
    : translateKnown(domainMessages(statusMessages, entry.kind), entry.status, t)
