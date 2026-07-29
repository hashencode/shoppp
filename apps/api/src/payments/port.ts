import type { CheckoutRequest } from "@shoppp/contracts";

export interface CheckoutSnapshotLine {
  readonly currency: string;
  readonly discountAmount: number;
  readonly lineTotalAmount: number;
  readonly optionValues: Record<string, string>;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly sku: string;
  readonly taxAmount: number;
  readonly unitPriceAmount: number;
  readonly variantId: string;
  readonly variantName: string;
}

export interface CheckoutSnapshot {
  readonly currency: string;
  readonly email: string;
  readonly lines: readonly CheckoutSnapshotLine[];
  readonly shippingAddress: CheckoutRequest["shippingAddress"];
  readonly shippingMethod: {
    readonly amount: number;
    readonly id: string;
    readonly name: string;
  };
  readonly totals: {
    readonly discountTotal: number;
    readonly grandTotal: number;
    readonly shippingTotal: number;
    readonly subtotal: number;
    readonly taxTotal: number;
  };
}

export type ProviderPaymentState = "approved" | "expired" | "failed" | "pending";

export interface ProviderSession {
  readonly amountTotal: number;
  readonly attemptId: string;
  readonly createdAt: string;
  readonly currency: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly paymentId?: string;
  readonly paymentState: ProviderPaymentState;
  readonly url?: string;
}

export interface CreateHostedSessionInput {
  readonly attemptId: string;
  readonly cancelUrl: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly snapshot: CheckoutSnapshot;
  readonly successUrl: string;
}

export interface VerifiedProviderEvent {
  readonly createdAt: string;
  readonly id: string;
  readonly session?: ProviderSession;
  readonly type:
    | "checkout.completed"
    | "checkout.expired"
    | "checkout.payment_failed"
    | "checkout.payment_succeeded"
    | "ignored";
}

export type ProviderRefundStatus = "pending" | "succeeded" | "failed" | "canceled";

export interface ProviderRefund {
  readonly amount: number;
  readonly createdAt: string;
  readonly currency: string;
  readonly id: string;
  readonly paymentId: string;
  readonly status: ProviderRefundStatus;
}

export interface CreateRefundInput {
  readonly amount: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly refundId: string;
}

export interface PaymentProvider {
  readonly name: "stripe";
  createHostedSession(input: CreateHostedSessionInput): Promise<ProviderSession>;
  createRefund(input: CreateRefundInput): Promise<ProviderRefund>;
  retrieveRefund(id: string): Promise<ProviderRefund>;
  retrieveSession(id: string): Promise<ProviderSession>;
  verifyWebhook(rawPayload: string, signature: string): Promise<VerifiedProviderEvent>;
}

export class PaymentProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
