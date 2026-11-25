import { expect, test } from "bun:test";
import { editorParentMessageSchema, isEditorMessageSource } from "../src/storefront-editor";

test("editor messages require the exact origin, frame and protocol identity", () => {
  const frame = {} as Window;
  expect(isEditorMessageSource({ origin: "https://admin.test", source: frame }, "https://admin.test", frame)).toBe(true);
  expect(isEditorMessageSource({ origin: "https://evil.test", source: frame }, "https://admin.test", frame)).toBe(false);
  expect(isEditorMessageSource({ origin: "https://admin.test", source: {} as Window }, "https://admin.test", frame)).toBe(false);
  expect(editorParentMessageSchema.safeParse({ kind: "initialize", protocol: 2, sessionId: crypto.randomUUID(), nonce: crypto.randomUUID() }).success).toBe(false);
});
