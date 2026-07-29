import type { OrderAccess } from "@shoppp/contracts";

const ORDER_ACCESS_KEY = "shoppp.current-order-access";

export interface StoredOrderAccess {
  readonly attemptId: string;
  readonly token: string;
}

export function storeOrderAccess(value: StoredOrderAccess): void {
  sessionStorage.setItem(ORDER_ACCESS_KEY, JSON.stringify(value));
}

export function readOrderAccess(): StoredOrderAccess | null {
  const value = sessionStorage.getItem(ORDER_ACCESS_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredOrderAccess>;
    if (
      typeof parsed.attemptId !== "string" ||
      typeof parsed.token !== "string" ||
      !/^[A-Za-z0-9_-]{40,160}$/.test(parsed.token)
    ) {
      return null;
    }
    return { attemptId: parsed.attemptId, token: parsed.token };
  } catch {
    return null;
  }
}

export function orderAccessMessage(access: OrderAccess): string {
  if (access.status === "paid") return "Payment confirmed";
  if (access.status === "failed") return "Payment was not completed";
  if (access.status === "expired") return "Payment session expired";
  return "Payment confirmation is pending";
}
