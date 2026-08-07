import * as z from "zod";
import type { AddCartLineRequest } from "@shoppp/contracts";
import type { InjectionKey } from "vue";

export const previewActionIntentSchema = z.enum([
  "navigation",
  "variant.select",
  "cart.add-preview",
  "cart.quantity-preview",
  "checkout.start-preview",
  "wishlist.toggle-preview",
  "product.quick-view-preview",
]);

export const previewActionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    intent: previewActionIntentSchema,
    label: z.string().trim().min(1).max(120),
    target: z
      .string()
      .max(500)
      .regex(/^\/(?!\/)[^\s]*$/)
      .optional(),
    value: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .superRefine((action, context) => {
    if (action.intent === "navigation" && !action.target) {
      context.addIssue({
        code: "custom",
        message: "Navigation preview actions require a local target.",
        path: ["target"],
      });
    }
    if (
      (action.intent === "variant.select" || action.intent === "cart.quantity-preview") &&
      !action.value
    ) {
      context.addIssue({
        code: "custom",
        message: `${action.intent} preview actions require a value.`,
        path: ["value"],
      });
    }
    if (action.intent !== "navigation" && action.target) {
      context.addIssue({
        code: "custom",
        message: "Only navigation preview actions may declare a target.",
        path: ["target"],
      });
    }
  });

export type PreviewAction = z.infer<typeof previewActionSchema>;
export type PreviewActionIntent = z.infer<typeof previewActionIntentSchema>;

export interface PreviewCartAddDispatch {
  action: PreviewAction;
  context: string;
  currency: string;
  input: AddCartLineRequest;
  kind: "cart.add";
}

export type PreviewActionDispatch = PreviewCartAddDispatch;
export type PreviewActionAdapter = (dispatch: PreviewActionDispatch) => Promise<void>;
export const previewActionAdapterKey = Symbol(
  "preview-action-adapter",
) as InjectionKey<PreviewActionAdapter>;

export interface RecordedPreviewIntent extends PreviewAction {
  context: string;
  recordedAt: null;
}

export class PreviewIntentRecorder {
  readonly #records: RecordedPreviewIntent[] = [];

  record(action: PreviewAction, context: string): RecordedPreviewIntent {
    const validated = previewActionSchema.parse(action);
    const record = Object.freeze({
      ...validated,
      context,
      recordedAt: null,
    }) satisfies RecordedPreviewIntent;
    this.#records.push(record);
    return record;
  }

  all(): readonly RecordedPreviewIntent[] {
    return this.#records.map((record) => ({ ...record }));
  }

  clear(): void {
    this.#records.splice(0);
  }
}

export const previewIntentRecorder = new PreviewIntentRecorder();

export function recordPreviewIntent(action: PreviewAction, context: string): RecordedPreviewIntent {
  return previewIntentRecorder.record(action, context);
}
