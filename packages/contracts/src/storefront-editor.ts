import * as z from "zod";
import { experienceResourceBindingSchema, pageTemplateSchema } from "./storefront-experience";

export const editorDocumentSchema = z
  .object({
    templates: z.array(pageTemplateSchema).min(1).max(10),
    bindings: z.array(experienceResourceBindingSchema).max(100),
  })
  .strict();
const identity = { protocol: z.literal(1), sessionId: z.string().uuid(), nonce: z.string().uuid() };
export const editorParentMessageSchema = z.discriminatedUnion("kind", [
  z.object({ ...identity, kind: z.literal("initialize") }).strict(),
  z
    .object({
      ...identity,
      kind: z.literal("update"),
      revision: z.int().nonnegative(),
      selectedId: z.string().max(100).optional(),
      templateId: z.string().min(1).max(100),
      path: z
        .string()
        .max(500)
        .regex(/^\/(?!\/)/),
      mode: z.enum(["inspect", "browse"]),
      document: editorDocumentSchema,
    })
    .strict(),
]);
export const editorChildMessageSchema = z.discriminatedUnion("kind", [
  z.object({ protocol: z.literal(1), kind: z.literal("ready") }).strict(),
  z.object({ ...identity, kind: z.literal("applied"), revision: z.int().nonnegative() }).strict(),
  z
    .object({
      ...identity,
      kind: z.literal("select"),
      revision: z.int().nonnegative(),
      instanceId: z.string().max(100),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("navigate"),
      revision: z.int().nonnegative(),
      path: z
        .string()
        .max(500)
        .regex(/^\/(?!\/)/),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("error"),
      revision: z.int().nonnegative(),
      message: z.string().max(2000),
    })
    .strict(),
]);
export type EditorDocument = z.infer<typeof editorDocumentSchema>;
export type EditorParentMessage = z.infer<typeof editorParentMessageSchema>;
export type EditorChildMessage = z.infer<typeof editorChildMessageSchema>;

const libraryVersion = {
  expectedVersion: z.int().positive(),
  reason: z.string().trim().max(500).optional(),
};
export const storefrontDraftLibraryActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...libraryVersion,
      kind: z.literal("rename"),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({ ...libraryVersion, kind: z.literal("copy"), name: z.string().trim().min(1).max(120) })
    .strict(),
  z.object({ ...libraryVersion, kind: z.literal("remove"), confirm: z.literal(true) }).strict(),
]);
export type StorefrontDraftLibraryAction = z.infer<typeof storefrontDraftLibraryActionSchema>;

export function isEditorMessageSource(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedOrigin: string,
  expectedWindow: MessageEventSource | null,
): boolean {
  return (
    expectedWindow !== null && event.origin === expectedOrigin && event.source === expectedWindow
  );
}
