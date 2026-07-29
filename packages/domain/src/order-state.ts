export type PaymentStatus =
  "pending" | "authorized" | "paid" | "failed" | "canceled" | "partially_refunded" | "refunded";
export type OrderStatus =
  "checkout_pending" | "confirmed" | "processing" | "completed" | "canceled";
export type FulfillmentStatus =
  "unfulfilled" | "picking" | "packed" | "shipped" | "delivered" | "canceled";
export type ReservationStatus = "active" | "confirmed" | "expired" | "released";

const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pending: ["authorized", "failed"],
  authorized: ["paid", "canceled"],
  paid: ["partially_refunded", "refunded"],
  failed: [],
  canceled: [],
  partially_refunded: ["refunded"],
  refunded: [],
};
const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  checkout_pending: ["confirmed", "canceled"],
  confirmed: ["processing", "canceled"],
  processing: ["completed"],
  completed: [],
  canceled: [],
};
const FULFILLMENT_TRANSITIONS: Readonly<Record<FulfillmentStatus, readonly FulfillmentStatus[]>> = {
  unfulfilled: ["picking", "canceled"],
  picking: ["packed"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  canceled: [],
};
const RESERVATION_TRANSITIONS: Readonly<Record<ReservationStatus, readonly ReservationStatus[]>> = {
  active: ["confirmed", "expired", "released"],
  confirmed: [],
  expired: [],
  released: [],
};

function transition<State extends string>(
  dimension: string,
  transitions: Readonly<Record<State, readonly State[]>>,
  from: State,
  to: State,
): State {
  if (from === to) {
    return from;
  }
  if (!transitions[from].includes(to)) {
    throw new Error(`Invalid ${dimension} transition from ${from} to ${to}.`);
  }
  return to;
}

export function transitionPayment(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  return transition("payment", PAYMENT_TRANSITIONS, from, to);
}

export function transitionOrder(from: OrderStatus, to: OrderStatus): OrderStatus {
  return transition("order", ORDER_TRANSITIONS, from, to);
}

export function transitionFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): FulfillmentStatus {
  return transition("fulfillment", FULFILLMENT_TRANSITIONS, from, to);
}

export function transitionReservation(
  from: ReservationStatus,
  to: ReservationStatus,
): ReservationStatus {
  return transition("reservation", RESERVATION_TRANSITIONS, from, to);
}
