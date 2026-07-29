import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { redactForLog, safeRequestPath } from "../security/redaction";

export interface RequestObservation {
  readonly durationMs: number;
  readonly error?: Error;
  readonly status: number;
}

export function observeRequest(
  context: Context<ApiEnvironment>,
  observation: RequestObservation,
): void {
  const route = safeRequestPath(context.req.url);
  const payload = redactForLog({
    durationMs: observation.durationMs,
    environment: context.env.ENVIRONMENT,
    error: observation.error
      ? { message: observation.error.message, name: observation.error.name }
      : undefined,
    event: "http.request",
    method: context.req.method,
    requestId: context.get("requestId"),
    route,
    status: observation.status,
  });
  const serialized = JSON.stringify(payload);
  if (observation.status >= 500) console.error(serialized);
  else console.info(serialized);
  context.env.OBSERVABILITY?.writeDataPoint({
    blobs: [context.env.ENVIRONMENT, context.req.method, route],
    doubles: [observation.status, observation.durationMs],
    indexes: [context.get("requestId")],
  });
}
