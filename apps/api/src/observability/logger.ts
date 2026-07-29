import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { redactForLog, safeRequestPath } from "../security/redaction";

export interface RequestObservation {
  readonly durationMs: number;
  readonly error?: Error;
  readonly status: number;
}

export type CommerceFunnelEvent =
  "cart_created" | "checkout_started" | "page_view" | "purchase_confirmed";

export interface CommerceObservation {
  readonly event: CommerceFunnelEvent;
  readonly route?: string;
}

export function commerceDataPoint(
  environment: ApiEnvironment["Bindings"]["ENVIRONMENT"],
  observation: CommerceObservation,
) {
  return {
    blobs: [environment, "commerce.funnel", observation.event, observation.route ?? "server"],
    doubles: [1],
    indexes: [environment],
  };
}

export function observeCommerceEvent(
  context: Context<ApiEnvironment>,
  observation: CommerceObservation,
): void {
  writeCommerceEvent(context.env.OBSERVABILITY, context.env.ENVIRONMENT, observation);
}

export function writeCommerceEvent(
  dataset: AnalyticsEngineDataset | undefined,
  environment: ApiEnvironment["Bindings"]["ENVIRONMENT"],
  observation: CommerceObservation,
): void {
  dataset?.writeDataPoint(commerceDataPoint(environment, observation));
}

export function observeRequest(
  context: Context<ApiEnvironment>,
  observation: RequestObservation,
): void {
  const route = safeRequestPath(context.req.url);
  const redacted = redactForLog({
    durationMs: observation.durationMs,
    environment: context.env.ENVIRONMENT,
    error: observation.error
      ? { message: observation.error.message, name: observation.error.name }
      : undefined,
    event: "http.request",
    method: context.req.method,
    route,
    status: observation.status,
  }) as Record<string, unknown>;
  const payload = { ...redacted, requestId: context.get("requestId") };
  const serialized = JSON.stringify(payload);
  if (observation.status >= 500) console.error(serialized);
  else console.info(serialized);
  context.env.OBSERVABILITY?.writeDataPoint({
    blobs: [context.env.ENVIRONMENT, context.req.method, route],
    doubles: [observation.status, observation.durationMs],
    indexes: [context.get("requestId")],
  });
}
