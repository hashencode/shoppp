import { Hono } from "hono";
import * as z from "zod";

import { createProduct, getProduct, listProducts, updateProduct } from "../catalog/products";
import { productDraftSchema, publicationSchema } from "../catalog/schemas";
import { recordAuditEvent } from "../iam/audit";
import { requirePermission } from "../iam/permissions";
import { uploadCatalogMedia } from "../media/uploads";
import {
  adminAuthentication,
  defaultAccessVerifier,
  type AccessVerifier,
} from "../middleware/auth";
import { idempotency } from "../middleware/idempotency";
import { parseJson } from "../middleware/validation";
import {
  createPreviewToken,
  defaultBuildTrigger,
  publishProduct,
  type BuildTrigger,
} from "../publishing/releases";
import type { ApiEnvironment } from "./context";
import { ApiError, errorEnvelope } from "./errors";
import { assertEnvironmentIsolation } from "./environment";
import { redact } from "./redaction";

export interface CreateAppOptions {
  readonly accessVerifier?: AccessVerifier;
  readonly buildManifestToken?: string;
  readonly buildTrigger?: BuildTrigger;
  readonly previewTokenSecret?: string;
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
  app.get("/build/catalog/releases/:id", async (context) => {
    const expectedToken = options.buildManifestToken ?? context.env.BUILD_MANIFEST_TOKEN;
    if (!expectedToken || expectedToken.length < 32) {
      throw new ApiError(
        500,
        "build_manifest_not_configured",
        "The build manifest credential is not configured.",
      );
    }
    if (context.req.header("authorization") !== `Bearer ${expectedToken}`) {
      throw new ApiError(401, "build_manifest_unauthorized", "Build credential required.");
    }
    const release = await context.env.DB.prepare(
      `SELECT manifest_json
         FROM catalog_releases
        WHERE id = ? AND status IN ('approved', 'building', 'deployed')`,
    )
      .bind(context.req.param("id"))
      .first<{ manifest_json: string }>();
    if (!release) {
      throw new ApiError(404, "catalog_release_not_found", "The catalog release was not found.");
    }
    context.header("Cache-Control", "private, no-store");
    return context.json(JSON.parse(release.manifest_json));
  });

  app.use("/admin/*", adminAuthentication(options.accessVerifier ?? defaultAccessVerifier));
  app.get("/admin/catalog/products", async (context) => {
    await requirePermission(context, "catalog.read", { type: "product" });
    return context.json(await listProducts(context));
  });
  app.get("/admin/catalog/products/:id", async (context) => {
    await requirePermission(context, "catalog.read", {
      id: context.req.param("id"),
      type: "product",
    });
    return context.json({
      data: await getProduct(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/catalog/products", async (context) => {
    await requirePermission(context, "catalog.write", { type: "product" });
    const input = await parseJson(context, productDraftSchema);
    return context.json(
      {
        data: await createProduct(context, input),
        meta: { requestId: context.get("requestId") },
      },
      201,
    );
  });
  app.put("/admin/catalog/products/:id", async (context) => {
    const productId = context.req.param("id");
    await requirePermission(context, "catalog.write", { id: productId, type: "product" });
    const input = await parseJson(context, productDraftSchema);
    return context.json({
      data: await updateProduct(context, productId, input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.put("/admin/media/*", async (context) =>
    context.json(
      {
        data: await uploadCatalogMedia(context),
        meta: { requestId: context.get("requestId") },
      },
      201,
    ),
  );
  app.post("/admin/catalog/products/:id/preview", async (context) => {
    const productId = context.req.param("id");
    await requirePermission(context, "catalog.read", { id: productId, type: "product" });
    await getProduct(context.env.DB, productId);
    const secret = options.previewTokenSecret ?? context.env.PREVIEW_TOKEN_SECRET;
    if (!secret || secret.length < 32) {
      throw new ApiError(
        500,
        "preview_token_not_configured",
        "The preview token secret is not configured.",
      );
    }
    return context.json({
      data: await createPreviewToken(productId, secret),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/admin/catalog/products/:id/publish",
    idempotency("catalog.publish"),
    async (context) => {
      const productId = context.req.param("id");
      await requirePermission(context, "catalog.publish", { id: productId, type: "product" });
      const input = await parseJson(context, publicationSchema);
      return context.json(
        {
          data: await publishProduct(
            context,
            productId,
            options.buildTrigger ?? defaultBuildTrigger(context.env),
            input.reason,
          ),
          meta: { requestId: context.get("requestId") },
        },
        202,
      );
    },
  );
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
