import type { NotificationType } from "../port";

type CommerceNotificationType = Exclude<
  NotificationType,
  "admin_invitation" | "admin_password_reset"
>;

export interface NotificationOrderSnapshot {
  readonly currency: string;
  readonly email: string;
  readonly grandTotal: number;
  readonly lines: ReadonlyArray<{ productName: string; quantity: number }>;
  readonly publicReference: string;
}

export interface NotificationTemplateFacts {
  readonly amount?: number;
  readonly carrier?: string;
  readonly order: NotificationOrderSnapshot;
  readonly trackingNumber?: string;
}

export interface RenderedNotification {
  readonly html: string;
  readonly subject: string;
  readonly text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(amount / 100);
}

function titleFor(type: CommerceNotificationType): string {
  switch (type) {
    case "order_receipt":
      return "Order confirmed";
    case "payment_failed":
      return "Payment was not completed";
    case "cancellation":
      return "Order canceled";
    case "refund":
      return "Refund processed";
    case "shipment":
      return "Order shipped";
  }
}

function detailFor(type: CommerceNotificationType, facts: NotificationTemplateFacts): string {
  switch (type) {
    case "order_receipt":
      return `We received your order for ${money(facts.order.grandTotal, facts.order.currency)}.`;
    case "payment_failed":
      return "Your payment did not complete. No paid-order confirmation was created.";
    case "cancellation":
      return "Your order has been canceled and any confirmed refund is shown in your order status.";
    case "refund":
      return `A refund of ${money(facts.amount ?? 0, facts.order.currency)} was processed.`;
    case "shipment":
      return `Your parcel was handed to ${facts.carrier ?? "the carrier"}. Tracking: ${
        facts.trackingNumber ?? "unavailable"
      }.`;
  }
}

export function renderNotificationTemplate(
  type: CommerceNotificationType,
  facts: NotificationTemplateFacts,
  storefrontOrigin: string,
): RenderedNotification {
  const title = titleFor(type);
  const detail = detailFor(type, facts);
  const reference = facts.order.publicReference;
  const accessUrl = `${storefrontOrigin.replace(/\/$/, "")}/orders/access`;
  const lineSummary = facts.order.lines
    .map((line) => `${line.quantity} × ${line.productName}`)
    .join(", ");
  const text = `${title}\n\nOrder ${reference}\n${detail}\n${lineSummary}\n\nView your order securely: ${accessUrl}`;
  return {
    html: `<h1>${escapeHtml(title)}</h1><p>Order <strong>${escapeHtml(
      reference,
    )}</strong></p><p>${escapeHtml(detail)}</p><p>${escapeHtml(
      lineSummary,
    )}</p><p><a href="${escapeHtml(accessUrl)}">View your order securely</a></p>`,
    subject: `${title} · ${reference}`,
    text,
  };
}

export function renderInvitationNotificationTemplate(input: {
  adminOrigin: string;
  displayName: string | null;
  token: string;
}): RenderedNotification {
  const activationUrl = `${input.adminOrigin.replace(/\/$/, "")}/activate?token=${encodeURIComponent(input.token)}`;
  const greeting = input.displayName ? `Hello ${input.displayName},` : "Hello,";
  const subject = "Your Shoppp admin invitation";
  return {
    html: `<h1>${escapeHtml(subject)}</h1><p>${escapeHtml(
      greeting,
    )}</p><p>You have been invited to Shoppp admin.</p><p><a href="${escapeHtml(
      activationUrl,
    )}">Create your password</a></p>`,
    subject,
    text: `${greeting}\n\nYou have been invited to Shoppp admin.\n\nCreate your password: ${activationUrl}`,
  };
}

export function renderAdminPasswordResetTemplate(input: {
  adminOrigin: string;
  displayName: string;
  token: string;
}): RenderedNotification {
  const resetUrl = `${input.adminOrigin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(input.token)}`;
  const subject = "Reset your Shoppp admin password";
  const greeting = `Hello ${input.displayName},`;
  return {
    html: `<h1>${escapeHtml(subject)}</h1><p>${escapeHtml(greeting)}</p><p>This link expires in 30 minutes and can be used once.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
    subject,
    text: `${greeting}\n\nThis link expires in 30 minutes and can be used once.\n\nReset password: ${resetUrl}`,
  };
}
