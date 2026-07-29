import { Hono } from "hono";
import * as z from "zod";

import { recordAuditEvent } from "../iam/audit";
import { requirePermission } from "../iam/permissions";
import {
  adminAuthentication,
  defaultAccessVerifier,
  type AccessVerifier,
} from "../middleware/auth";
import { idempotency } from "../middleware/idempotency";
import { parseJson } from "../middleware/validation";
import type { ApiEnvironment } from "./context";
import { ApiError, errorEnvelope } from "./errors";
import { assertEnvironmentIsolation } from "./environment";
import { redact } from "./redaction";

export interface CreateAppOptions {
  readonly accessVerifier?: AccessVerifier;
}

const refundSchema = z
  .object({
    amount: z.int().positive(),
    reason: z.string().min(3).max(500),
  })
  .strict();
const idempotentTestSchema = z.object({ value: z.string().min(1) }).strict();

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ApiEnvironment>();

  app.use("*", async (context, next) => {
    const requestId = context.req.header("x-request-id") || crypto.randomUUID();
    context.set("requestId", requestId);
    assertEnvironmentIsolation({
      environment: context.env.ENVIRONMENT,
      publicOrigin: context.env.PUBLIC_ORIGIN,
      resourceNamespace: context.env.RESOURCE_NAMESPACE,
    });
    await next();
    context.header("x-request-id", requestId);
  });
  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "internal_error", "An unexpected error occurred.");
    if (!(error instanceof ApiError)) {
      console.error(
        JSON.stringify({
          error: redact({ message: error.message, name: error.name }),
          requestId: context.get("requestId"),
        }),
      );
    }
    return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
  });
  app.notFound((context) =>
    context.json(
      errorEnvelope(
        new ApiError(404, "not_found", "The requested resource was not found."),
        context.get("requestId"),
      ),
      404,
    ),
  );

  app.get("/health", (context) =>
    context.json({ data: { status: "ok" }, meta: { requestId: context.get("requestId") } }),
  );

  app.use("/admin/*", adminAuthentication(options.accessVerifier ?? defaultAccessVerifier));
  app.get("/admin/orders", async (context) => {
    await requirePermission(context, "orders.read", { type: "order" });
    return context.json({ data: [], meta: { requestId: context.get("requestId") } });
  });
  app.post("/admin/orders/:reference/refunds", async (context) => {
    await requirePermission(context, "orders.refund", {
      id: context.req.param("reference"),
      type: "order",
    });
    await parseJson(context, refundSchema);
    throw new ApiError(404, "order_not_found", "The order was not found.");
  });
  app.post("/admin/test/idempotent", idempotency("test.idempotent"), async (context) => {
    await requirePermission(context, "operations.replay", { type: "test" });
    const input = await parseJson(context, idempotentTestSchema);
    const principal = context.get("principal");
    await recordAuditEvent(context.env.DB, {
      action: "test.idempotent",
      actorId: principal.id,
      actorType: "admin",
      id: crypto.randomUUID(),
      requestId: context.get("requestId"),
      result: "succeeded",
      targetType: "test",
    });
    return context.json({ data: input, meta: { requestId: context.get("requestId") } });
  });

  return app;
}
