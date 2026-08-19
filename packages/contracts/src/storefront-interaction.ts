import * as z from "zod";

import { storefrontIdentifierSchema } from "./storefront-experience";
import { credentialFreeHttpsUrlSchema, storefrontRoutePathSchema } from "./storefront-links";

export const storefrontInteractionInputModeSchema = z.enum([
  "pointer",
  "keyboard",
  "touch",
  "reduced-motion",
  "no-js",
]);

export const storefrontInteractionParitySchema = z.enum(["structural", "behavioral", "absence"]);

const interactionRouteTargetSchema = z
  .object({
    kind: z.literal("route"),
    path: storefrontRoutePathSchema.refine(
      (path) => !path.includes("#"),
      "Interaction route targets must declare fragments separately.",
    ),
  })
  .strict();
const interactionFragmentTargetSchema = z
  .object({
    kind: z.literal("fragment"),
    target: z.string().regex(/^#[A-Za-z][A-Za-z0-9_:.-]*$/),
  })
  .strict();
const interactionResourceTargetSchema = z.discriminatedUnion("resourceKind", [
  z
    .object({
      idSource: z.string().trim().min(1).max(120),
      kind: z.literal("resource"),
      resourceKind: z.literal("collection"),
      routeFamily: z.literal("catalog-collection"),
    })
    .strict(),
  z
    .object({
      idSource: z.string().trim().min(1).max(120),
      kind: z.literal("resource"),
      resourceKind: z.literal("product"),
      routeFamily: z.literal("catalog-product"),
    })
    .strict(),
]);
const interactionExternalTargetSchema = z
  .object({
    kind: z.literal("external"),
    url: credentialFreeHttpsUrlSchema,
  })
  .strict();
const interactionContactTargetSchema = z
  .object({
    kind: z.literal("contact"),
    uri: z
      .string()
      .max(500)
      .refine(
        (value) =>
          /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
          /^tel:\+?[0-9][0-9 ()-]{2,30}$/.test(value),
        "Contact targets must use a valid mailto: or tel: URI.",
      ),
  })
  .strict();

export const storefrontInteractionDispositionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("internal-navigation"),
      target: z.discriminatedUnion("kind", [
        interactionRouteTargetSchema,
        interactionFragmentTargetSchema,
        interactionResourceTargetSchema,
      ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("external-navigation"),
      target: interactionExternalTargetSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("contact-navigation"),
      target: interactionContactTargetSchema,
    })
    .strict(),
  z
    .object({
      idSources: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
      intent: z.enum([
        "cart.add",
        "cart.remove",
        "cart.quantity",
        "checkout.start",
        "collection.open",
        "product.open",
        "variant.select",
      ]),
      kind: z.literal("commerce-intent"),
    })
    .strict(),
  z
    .object({
      control: storefrontIdentifierSchema,
      kind: z.literal("local-state"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unavailable"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal("deferred"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
]);

export const storefrontInteractionContractRowSchema = z
  .object({
    behaviorId: storefrontIdentifierSchema,
    breakpoints: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    candidate: z.string().trim().min(1).max(1_000),
    disposition: storefrontInteractionDispositionSchema,
    evidence: z.array(storefrontIdentifierSchema).min(1).max(20),
    fallback: z.string().trim().min(1).max(1_000),
    id: storefrontIdentifierSchema,
    inputModes: z.array(storefrontInteractionInputModeSchema).min(1).max(5),
    inputOutcomes: z
      .object({
        keyboard: z.string().trim().min(1).max(1_000),
        noJs: z.string().trim().min(1).max(1_000),
        pointer: z.string().trim().min(1).max(1_000),
        reducedMotion: z.string().trim().min(1).max(1_000),
        touch: z.string().trim().min(1).max(1_000),
      })
      .strict(),
    outcome: z.string().trim().min(1).max(1_000),
    owner: z.string().trim().min(1).max(120),
    parity: z.array(storefrontInteractionParitySchema).min(1).max(3),
    role: z.enum([
      "commerce",
      "contact",
      "external-navigation",
      "local-state",
      "navigation",
      "unavailable",
    ]),
    routeId: storefrontIdentifierSchema,
  })
  .strict()
  .superRefine((row, context) => {
    const requiredInputModes = ["pointer", "keyboard", "touch", "reduced-motion", "no-js"] as const;
    if (
      row.inputModes.length !== requiredInputModes.length ||
      requiredInputModes.some((mode) => !row.inputModes.includes(mode))
    ) {
      context.addIssue({
        code: "custom",
        message: "Interaction rows must declare every governed input mode exactly once.",
        path: ["inputModes"],
      });
    }
    if (!row.parity.includes("behavioral")) {
      context.addIssue({
        code: "custom",
        message: "Interaction rows must declare behavioral parity evidence.",
        path: ["parity"],
      });
    }
    const expectedRole =
      row.disposition.kind === "commerce-intent"
        ? "commerce"
        : row.disposition.kind === "contact-navigation"
          ? "contact"
          : row.disposition.kind === "external-navigation"
            ? "external-navigation"
            : row.disposition.kind === "internal-navigation"
              ? "navigation"
              : row.disposition.kind === "unavailable" || row.disposition.kind === "deferred"
                ? "unavailable"
                : "local-state";
    if (row.role !== expectedRole) {
      context.addIssue({
        code: "custom",
        message: `Interaction role must be ${expectedRole} for ${row.disposition.kind}.`,
        path: ["role"],
      });
    }
  });

export type StorefrontInteractionContractRow = z.infer<
  typeof storefrontInteractionContractRowSchema
>;
export type StorefrontInteractionDisposition = z.infer<
  typeof storefrontInteractionDispositionSchema
>;
