import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { PaymentProviderError, type PaymentProvider } from "./port";
import { reconcilePaymentEvent } from "./reconciliation";

async function recordVerificationFailure(
  context: Context<ApiEnvironment>,
  provider: PaymentProvider,
  code: string,
): Promise<void> {
  await recordAuditEvent(context.env.DB, {
    action: "payment.webhook.verify",
    actorType: "provider",
    id: `aud_${crypto.randomUUID().replaceAll("-", "")}`,
    metadata: { code },
    reason: code,
    requestId: context.get("requestId"),
    result: "denied",
    targetId: provider.name,
    targetType: "payment_provider",
  });
}

export async function processPaymentWebhook(
  context: Context<ApiEnvironment>,
  provider: PaymentProvider,
) {
  const signature = context.req.header("stripe-signature");
  if (!signature) {
    await recordVerificationFailure(context, provider, "webhook_signature_required");
    throw new ApiError(400, "webhook_signature_required", "Webhook signature is required.");
  }
  const rawPayload = await context.req.raw.text();
  let event;
  try {
    event = await provider.verifyWebhook(rawPayload, signature);
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      await recordVerificationFailure(context, provider, error.code);
      throw new ApiError(400, error.code, error.message);
    }
    throw error;
  }
  try {
    return {
      data: await reconcilePaymentEvent(context.env.DB, provider, event, rawPayload),
      meta: { requestId: context.get("requestId") },
    };
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      throw new ApiError(error.retryable ? 503 : 422, error.code, error.message);
    }
    throw error;
  }
}
