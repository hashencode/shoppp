import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { ApiBindings } from "../http/context";
import {
  createCloudflareEmailProvider,
  createHttpEmailProvider,
} from "../notifications/email-adapter";
import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
  type NotificationType,
} from "../notifications/port";
import {
  renderAdminPasswordResetTemplate,
  renderInvitationNotificationTemplate,
  renderNotificationTemplate,
  type NotificationOrderSnapshot,
  type NotificationTemplateFacts,
} from "../notifications/templates";
import { createSignedInvitationToken, createSignedResetToken } from "../iam/passwords";
import type { PaymentProvider } from "../payments/port";
import { createStripePaymentProvider } from "../payments/stripe-adapter";
import { writeCommerceEvent } from "../observability/logger";
import { deliverProviderRecoveryJob } from "../recovery/provider-events";
import {
  completedAtAfter,
  recordAutomationFailure,
  recordAutomationSuccess,
  type NotificationDeliveryResult,
} from "./attempts";
import { claimNotificationJob, type ClaimedNotificationJob } from "./deduplication";

export interface NotificationWorkflowPayload {
  readonly jobId: string;
}

interface OrderFactsRow {
  currency: string;
  email: string;
  grand_total_amount: number;
  public_reference: string;
}

type CommerceNotificationType = Exclude<
  NotificationType,
  "admin_invitation" | "admin_password_reset"
>;

function isNotificationType(value: string): value is CommerceNotificationType {
  return ["order_receipt", "payment_failed", "cancellation", "refund", "shipment"].includes(value);
}

async function invitationMessage(
  db: D1Database,
  job: ClaimedNotificationJob,
  adminOrigin: string,
  from: string,
  now: string,
  authTokenSecret: string | undefined,
): Promise<EmailMessage> {
  if (!authTokenSecret || authTokenSecret.length < 32) {
    throw new EmailProviderError(
      "account_activation_secret_missing",
      "Account activation delivery is not configured.",
      false,
    );
  }
  const payload = JSON.parse(job.payloadJson) as { invitationId?: unknown };
  if (typeof payload.invitationId !== "string") {
    throw new EmailProviderError(
      "invitation_payload_invalid",
      "Invitation payload invalid.",
      false,
    );
  }
  const invitation = await db
    .prepare(
      `SELECT id, normalized_email, display_name, version, expires_at FROM admin_invitations
        WHERE id = ? AND status = 'pending' AND expires_at > ?`,
    )
    .bind(payload.invitationId, now)
    .first<{
      display_name: string | null;
      expires_at: string;
      id: string;
      normalized_email: string;
      version: number;
    }>();
  if (!invitation) {
    throw new EmailProviderError("invitation_inactive", "Invitation is no longer active.", false);
  }
  const rendered = renderInvitationNotificationTemplate({
    adminOrigin,
    displayName: invitation.display_name,
    token: await createSignedInvitationToken(authTokenSecret, {
      expiresAt: invitation.expires_at,
      invitationId: invitation.id,
      version: invitation.version,
    }),
  });
  return {
    from,
    html: rendered.html,
    idempotencyKey: job.deduplicationKey,
    subject: rendered.subject,
    text: rendered.text,
    to: invitation.normalized_email,
  };
}

async function passwordResetMessage(
  db: D1Database,
  job: ClaimedNotificationJob,
  adminOrigin: string,
  from: string,
  now: string,
  authTokenSecret: string | undefined,
): Promise<EmailMessage> {
  if (!authTokenSecret || authTokenSecret.length < 32) {
    throw new EmailProviderError(
      "password_reset_secret_missing",
      "Password reset delivery is not configured.",
      false,
    );
  }
  const payload = JSON.parse(job.payloadJson) as { resetId?: unknown };
  if (typeof payload.resetId !== "string") {
    throw new EmailProviderError("password_reset_payload_invalid", "Reset payload invalid.", false);
  }
  const reset = await db
    .prepare(
      `SELECT reset.id, reset.identity_id, reset.password_version, reset.expires_at,
              identity.normalized_email, identity.display_name
         FROM admin_password_reset_tokens reset
         JOIN admin_identities identity ON identity.id = reset.identity_id
         JOIN admin_password_credentials credential ON credential.identity_id = identity.id
         JOIN admin_roles role ON role.id = identity.role_id
        WHERE reset.id = ? AND reset.used_at IS NULL AND reset.expires_at > ?
          AND reset.password_version = credential.password_version
          AND identity.enabled = 1 AND role.enabled = 1 AND role.protected = 0`,
    )
    .bind(payload.resetId, now)
    .first<{
      display_name: string;
      expires_at: string;
      id: string;
      identity_id: string;
      normalized_email: string;
      password_version: number;
    }>();
  if (!reset) {
    throw new EmailProviderError(
      "password_reset_inactive",
      "Reset link is no longer active.",
      false,
    );
  }
  const token = await createSignedResetToken(authTokenSecret, {
    expiresAt: reset.expires_at,
    identityId: reset.identity_id,
    passwordVersion: reset.password_version,
    resetId: reset.id,
  });
  const rendered = renderAdminPasswordResetTemplate({
    adminOrigin,
    displayName: reset.display_name,
    token,
  });
  return {
    from,
    html: rendered.html,
    idempotencyKey: job.deduplicationKey,
    subject: rendered.subject,
    text: rendered.text,
    to: reset.normalized_email,
  };
}

function parsePayload(value: string): {
  amount?: number;
  carrier?: string;
  trackingNumber?: string;
} {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return {
    ...(Number.isInteger(parsed.amount) && Number(parsed.amount) >= 0
      ? { amount: Number(parsed.amount) }
      : {}),
    ...(typeof parsed.carrier === "string" ? { carrier: parsed.carrier } : {}),
    ...(typeof parsed.trackingNumber === "string" ? { trackingNumber: parsed.trackingNumber } : {}),
  };
}

async function orderSnapshot(
  db: D1Database,
  job: ClaimedNotificationJob,
): Promise<NotificationOrderSnapshot> {
  const row = job.orderId
    ? await db
        .prepare(
          `SELECT public_reference, email, currency, grand_total_amount
             FROM orders WHERE id = ?`,
        )
        .bind(job.orderId)
        .first<OrderFactsRow>()
    : await db
        .prepare(
          `SELECT 'CHECKOUT-' || UPPER(SUBSTR(REPLACE(id, '_', ''), -12)) AS public_reference,
                  email, currency, grand_total_amount
             FROM checkout_attempts WHERE id = ?`,
        )
        .bind(job.checkoutAttemptId)
        .first<OrderFactsRow>();
  if (!row?.email)
    throw new EmailProviderError("notification_snapshot_missing", "Snapshot missing.", false);

  let lines: Array<{ productName: string; quantity: number }> = [];
  if (job.orderId) {
    const result = await db
      .prepare(`SELECT product_name, quantity FROM order_lines WHERE order_id = ? ORDER BY id`)
      .bind(job.orderId)
      .all<{ product_name: string; quantity: number }>();
    lines = result.results.map((line) => ({
      productName: line.product_name,
      quantity: line.quantity,
    }));
  } else if (job.checkoutAttemptId) {
    const checkout = await db
      .prepare("SELECT snapshot_json FROM checkout_attempts WHERE id = ?")
      .bind(job.checkoutAttemptId)
      .first<{ snapshot_json: string | null }>();
    const snapshot = checkout?.snapshot_json
      ? (JSON.parse(checkout.snapshot_json) as {
          lines?: Array<{ productName?: unknown; quantity?: unknown }>;
        })
      : null;
    lines =
      snapshot?.lines
        ?.filter(
          (line): line is { productName: string; quantity: number } =>
            typeof line.productName === "string" &&
            Number.isInteger(line.quantity) &&
            Number(line.quantity) > 0,
        )
        .map((line) => ({ productName: line.productName, quantity: line.quantity })) ?? [];
  }
  return {
    currency: row.currency,
    email: row.email,
    grandTotal: row.grand_total_amount,
    lines,
    publicReference: row.public_reference,
  };
}

async function currentStatus(db: D1Database, jobId: string): Promise<"dead_letter" | "duplicate"> {
  const row = await db
    .prepare("SELECT status FROM notification_jobs WHERE id = ?")
    .bind(jobId)
    .first<{ status: string }>();
  return row?.status === "dead_letter" ? "dead_letter" : "duplicate";
}

export async function deliverNotificationJob(
  db: D1Database,
  provider: EmailProvider,
  storefrontOrigin: string,
  jobId: string,
  now = new Date().toISOString(),
  from = "orders@shoppp.example",
  adminOrigin = storefrontOrigin,
  authTokenSecret?: string,
): Promise<NotificationDeliveryResult> {
  const job = await claimNotificationJob(db, jobId, now);
  if (!job) return { status: await currentStatus(db, jobId) };
  const startedAt = now;
  try {
    if (job.type === "admin_invitation") {
      const result = await provider.send(
        await invitationMessage(db, job, adminOrigin, from, now, authTokenSecret),
      );
      const completedAt = completedAtAfter(startedAt);
      await recordAutomationSuccess(db, job, result.id, startedAt, completedAt);
      return { status: "sent" };
    }
    if (job.type === "admin_password_reset") {
      const result = await provider.send(
        await passwordResetMessage(db, job, adminOrigin, from, now, authTokenSecret),
      );
      const completedAt = completedAtAfter(startedAt);
      await recordAutomationSuccess(db, job, result.id, startedAt, completedAt);
      return { status: "sent" };
    }
    if (!isNotificationType(job.type)) {
      throw new EmailProviderError(
        "notification_type_invalid",
        "Notification type is invalid.",
        false,
      );
    }
    const order = await orderSnapshot(db, job);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) {
      throw new EmailProviderError("invalid_recipient", "Recipient address is invalid.", false);
    }
    const payload = parsePayload(job.payloadJson);
    const facts: NotificationTemplateFacts = { ...payload, order };
    const rendered = renderNotificationTemplate(job.type, facts, storefrontOrigin);
    const message: EmailMessage = {
      from,
      html: rendered.html,
      idempotencyKey: job.deduplicationKey,
      subject: rendered.subject,
      text: rendered.text,
      to: order.email,
    };
    const result = await provider.send(message);
    const completedAt = completedAtAfter(startedAt);
    await recordAutomationSuccess(db, job, result.id, startedAt, completedAt);
    return { status: "sent" };
  } catch (error) {
    const providerError =
      error instanceof EmailProviderError
        ? error
        : new EmailProviderError(
            "notification_delivery_failed",
            "Notification delivery failed.",
            true,
          );
    return recordAutomationFailure(db, job, providerError, startedAt, completedAtAfter(startedAt));
  }
}

export async function deliverAutomationJob(
  db: D1Database,
  emailProvider: EmailProvider,
  paymentProvider: PaymentProvider,
  storefrontOrigin: string,
  jobId: string,
  now = new Date().toISOString(),
  from = "orders@shoppp.example",
  onPurchaseConfirmed?: () => void,
  adminOrigin = storefrontOrigin,
  authTokenSecret?: string,
): Promise<NotificationDeliveryResult> {
  const job = await db
    .prepare("SELECT kind FROM notification_jobs WHERE id = ?")
    .bind(jobId)
    .first<{ kind: "notification" | "provider_recovery" }>();
  if (job?.kind === "provider_recovery") {
    return deliverProviderRecoveryJob(db, paymentProvider, jobId, now, onPurchaseConfirmed);
  }
  return deliverNotificationJob(
    db,
    emailProvider,
    storefrontOrigin,
    jobId,
    now,
    from,
    adminOrigin,
    authTokenSecret,
  );
}

export class NotificationDeliveryWorkflow extends WorkflowEntrypoint<
  ApiBindings,
  NotificationWorkflowPayload
> {
  override async run(
    event: Readonly<WorkflowEvent<NotificationWorkflowPayload>>,
    step: WorkflowStep,
  ): Promise<NotificationDeliveryResult> {
    const provider = this.env.EMAIL
      ? createCloudflareEmailProvider(this.env.EMAIL)
      : createHttpEmailProvider({
          ...(this.env.EMAIL_PROVIDER_API_KEY ? { apiKey: this.env.EMAIL_PROVIDER_API_KEY } : {}),
          ...(this.env.EMAIL_PROVIDER_URL ? { endpoint: this.env.EMAIL_PROVIDER_URL } : {}),
        });
    const paymentProvider = createStripePaymentProvider(this.env);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const result = await step.do(
        `deliver-${attempt}`,
        { retries: { backoff: "exponential", delay: "10 seconds", limit: 2 } },
        async () =>
          deliverAutomationJob(
            this.env.DB,
            provider,
            paymentProvider,
            this.env.STOREFRONT_ORIGIN,
            event.payload.jobId,
            new Date().toISOString(),
            this.env.EMAIL_FROM,
            () =>
              writeCommerceEvent(this.env.OBSERVABILITY, this.env.ENVIRONMENT, {
                event: "purchase_confirmed",
              }),
            this.env.ADMIN_ORIGIN,
            this.env.AUTH_TOKEN_SECRET,
          ),
      );
      if (result.status !== "retry") return result;
      await step.sleep(`retry-delay-${attempt}`, result.delaySeconds * 1000);
    }
    return { status: "dead_letter" };
  }
}
