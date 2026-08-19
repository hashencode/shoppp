import * as z from "zod";

import { publicIdSchema } from "./common";

function safeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.port;
  } catch {
    return false;
  }
}

export const credentialFreeHttpsUrlSchema = z
  .string()
  .url()
  .refine(safeHttpsUrl, "URL must be credential-free HTTPS without a hash or custom port.");

export const storefrontRoutePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[^\s]*$/)
  .refine((path) => !path.includes(".."), "Route targets cannot traverse paths.");

export const storefrontResourceKindSchema = z.enum([
  "product",
  "collection",
  "page",
  "article",
  "policy",
]);

const contentReferenceId = (namespace: "article" | "page" | "policy") =>
  z
    .string()
    .min(3)
    .max(160)
    .regex(new RegExp(`^${namespace}\\.[a-z0-9]+(?:[._-][a-z0-9]+)*$`));

export const storefrontResourceReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ id: publicIdSchema, kind: z.literal("product") }).strict(),
  z.object({ id: publicIdSchema, kind: z.literal("collection") }).strict(),
  z.object({ id: contentReferenceId("page"), kind: z.literal("page") }).strict(),
  z.object({ id: contentReferenceId("article"), kind: z.literal("article") }).strict(),
  z.object({ id: contentReferenceId("policy"), kind: z.literal("policy") }).strict(),
]);

export const linkTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("route"),
      path: storefrontRoutePathSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("external"),
      url: credentialFreeHttpsUrlSchema,
    })
    .strict(),
]);

export const storefrontLinkTargetBehaviorSchema = z.enum(["same-window", "new-window"]);

export const storefrontLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    target: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("internal"),
          reference: storefrontResourceReferenceSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal("external"),
          url: credentialFreeHttpsUrlSchema,
        })
        .strict(),
    ]),
    targetBehavior: storefrontLinkTargetBehaviorSchema,
  })
  .strict();

export type StorefrontLink = z.infer<typeof storefrontLinkSchema>;
export type StorefrontResourceReference = z.infer<typeof storefrontResourceReferenceSchema>;
