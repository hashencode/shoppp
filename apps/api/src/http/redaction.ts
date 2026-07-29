const SENSITIVE_KEYS = new Set([
  "address",
  "authorization",
  "card",
  "cardnumber",
  "cookie",
  "email",
  "password",
  "phone",
  "secret",
  "stripesecretkey",
  "token",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("token") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("password")
  );
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : redact(nestedValue),
      ]),
    );
  }
  return value;
}
