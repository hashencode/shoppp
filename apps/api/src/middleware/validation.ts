import type { Context } from "hono";
import type { z } from "zod";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

export async function parseJson<Schema extends z.ZodType>(
  context: Context<ApiEnvironment>,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const input = await context.req.json().catch(() => {
    throw new ApiError(400, "invalid_json", "Request body must contain valid JSON.");
  });
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(422, "validation_failed", "Request validation failed.", result.error.issues);
  }
  return result.data;
}
