import { redactForLog } from "./redaction";
import { ApiError } from "../http/errors";

const INLINE_SECRET =
  /\b(?:Bearer|CartToken)\s+\S+|\b(?:sk|rk)_(?:test|live)_\S+|\b[A-Za-z][A-Za-z0-9_-]{2,20}_(?:test|live)_[A-Za-z0-9_-]{6,}|\bwhsec_\S+|\border_access_[A-Za-z0-9_-]+|\b(?:api[-_ ]?key|password|token|secret)\s*[:=]\s*\S+/giu;

function redactInlineSecrets(value: string): string {
  return value.replaceAll(INLINE_SECRET, "[REDACTED:credential]");
}

function hasForbiddenAuditCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x061c ||
      codePoint === 0x200e ||
      codePoint === 0x200f ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    );
  });
}

function stripForbiddenAuditCharacters(value: string): string {
  return [...value]
    .map((character) => (hasForbiddenAuditCharacter(character) ? " " : character))
    .join("");
}

export function normalizeAuditReason(reason: string): string {
  if (hasForbiddenAuditCharacter(reason)) {
    throw new ApiError(
      422,
      "invalid_audit_reason",
      "Audit reason contains forbidden control or bidirectional characters.",
    );
  }
  const normalized = reason.trim().replaceAll(/[\t ]+/g, " ");
  return redactInlineSecrets(normalized);
}

export function sanitizeStoredAuditReason(reason: string): string {
  return redactInlineSecrets(
    stripForbiddenAuditCharacters(reason)
      .trim()
      .replaceAll(/[\t ]+/g, " "),
  );
}

function redactMetadataStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetadataStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactMetadataStrings(nested)]),
    );
  }
  return typeof value === "string" ? redactInlineSecrets(value) : value;
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return redactMetadataStrings(redactForLog(metadata)) as Record<string, unknown>;
}
