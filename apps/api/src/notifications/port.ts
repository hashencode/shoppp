export type NotificationType =
  | "order_receipt"
  | "payment_failed"
  | "cancellation"
  | "refund"
  | "shipment"
  | "admin_invitation"
  | "admin_password_reset";

export interface EmailMessage {
  readonly from: string;
  readonly html: string;
  readonly idempotencyKey: string;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
}

export interface EmailSendResult {
  readonly id: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class EmailProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "EmailProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
