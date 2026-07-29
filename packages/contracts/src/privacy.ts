import * as z from "zod";

import { isoDateTimeSchema } from "./common";

export const privacyRequestTypeSchema = z.enum(["access", "correction", "deletion"]);

export const createPrivacyRequestSchema = z
  .object({
    confirm: z.literal(true),
    correction: z
      .object({
        field: z.enum(["email", "shipping_address"]),
        requestedValue: z.string().trim().min(1).max(500),
      })
      .strict()
      .optional(),
    email: z.email(),
    reason: z.string().trim().min(3).max(500),
    type: privacyRequestTypeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "correction" && !value.correction) {
      context.addIssue({
        code: "custom",
        message: "Correction details are required.",
        path: ["correction"],
      });
    }
    if (value.type !== "correction" && value.correction) {
      context.addIssue({
        code: "custom",
        message: "Correction details are accepted only for correction requests.",
        path: ["correction"],
      });
    }
  });

export const privacyRequestSchema = z
  .object({
    completedAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    decision: z.enum([
      "export_created",
      "retained_immutable_financial_records",
      "no_matching_records",
    ]),
    expiresAt: isoDateTimeSchema.nullable(),
    id: z.string().regex(/^prv_[a-f0-9]{32}$/),
    status: z.literal("completed"),
    subjectReference: z.string().regex(/^[a-f0-9]{12}$/),
    type: privacyRequestTypeSchema,
  })
  .strict();

export type CreatePrivacyRequest = z.infer<typeof createPrivacyRequestSchema>;
export type PrivacyRequest = z.infer<typeof privacyRequestSchema>;
