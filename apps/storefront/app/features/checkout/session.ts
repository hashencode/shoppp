import type { OrderAccess } from "@shoppp/contracts";
import type { InjectionKey } from "vue";

const ORDER_ACCESS_KEY = "shoppp.current-order-access";
const ORDER_RETURN_VISIT_PREFIX = "shoppp.order-return-visit.";

export const PAYMENT_RETURN_POLL_DELAYS_MS = [0, 700, 1_500, 3_000, 5_000] as const;

export type PaymentReturnKind =
  "canceled" | "confirmed" | "duplicate" | "expired" | "failed" | "invalid" | "pending" | "retry";

export interface PaymentReturnState {
  readonly announcement: string;
  readonly cartDisposition: "preserve" | "refresh";
  readonly focusTarget: "heading";
  readonly kind: PaymentReturnKind;
}

export interface ResolvePaymentReturnStateInput {
  readonly access?: OrderAccess;
  readonly duplicateReturn?: boolean;
  readonly requestFailed?: boolean;
  readonly returnIntent?: "canceled" | "success";
}

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

export function markPaymentReturnVisit(attemptId: string): boolean {
  const key = `${ORDER_RETURN_VISIT_PREFIX}${attemptId}`;
  const duplicate = sessionStorage.getItem(key) === "1";
  if (!duplicate) sessionStorage.setItem(key, "1");
  return duplicate;
}

export function resolvePaymentReturnState(
  input: ResolvePaymentReturnStateInput,
): PaymentReturnState {
  if (input.requestFailed) {
    return {
      announcement: "Payment status could not be checked. Retry the secure status check.",
      cartDisposition: "preserve",
      focusTarget: "heading",
      kind: "retry",
    };
  }
  if (!input.access) {
    return {
      announcement: "This return cannot be matched to a secure checkout session.",
      cartDisposition: "preserve",
      focusTarget: "heading",
      kind: "invalid",
    };
  }
  if (input.duplicateReturn) {
    return {
      announcement:
        input.access.status === "paid"
          ? "This payment return was already received. The order remains confirmed."
          : "This payment return was already received. The latest Commerce status is shown.",
      cartDisposition: input.access.status === "paid" ? "refresh" : "preserve",
      focusTarget: "heading",
      kind: "duplicate",
    };
  }
  if (input.access.status === "paid") {
    return {
      announcement: "Payment confirmed. Your order is ready to view.",
      cartDisposition: "refresh",
      focusTarget: "heading",
      kind: "confirmed",
    };
  }
  if (input.access.status === "expired") {
    return {
      announcement: "The payment session expired. Your cart has been preserved.",
      cartDisposition: "preserve",
      focusTarget: "heading",
      kind: "expired",
    };
  }
  if (input.access.status === "failed") {
    return {
      announcement: "Payment was not completed. Your cart has been preserved.",
      cartDisposition: "preserve",
      focusTarget: "heading",
      kind: "failed",
    };
  }
  if (input.returnIntent === "canceled") {
    return {
      announcement: "You returned from payment without confirmation. Your cart has been preserved.",
      cartDisposition: "preserve",
      focusTarget: "heading",
      kind: "canceled",
    };
  }
  return {
    announcement: "Payment confirmation is still pending. Your cart remains unchanged.",
    cartDisposition: "preserve",
    focusTarget: "heading",
    kind: "pending",
  };
}

export function orderAccessMessage(access: OrderAccess): string {
  if (access.status === "paid") return "Payment confirmed";
  if (access.status === "failed") return "Payment was not completed";
  if (access.status === "expired") return "Payment session expired";
  return "Payment confirmation is pending";
}

export const checkoutReturnCartRefreshKey = Symbol("checkout-return-cart-refresh") as InjectionKey<
  () => Promise<void>
>;
