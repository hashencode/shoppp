const SENSITIVE_KEY_PARTS = [
  "address",
  "authorization",
  "card",
  "cookie",
  "email",
  "password",
  "phone",
  "secret",
  "token",
];
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CREDENTIAL_PATTERN =
  /\b(?:Bearer|CartToken)\s+\S+|\b(?:sk|rk)_(?:test|live)_\S+|\bwhsec_\S+|\border_access_[A-Za-z0-9_-]+/i;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function redactString(value: string): string {
  if (EMAIL_PATTERN.test(value)) return "[REDACTED:email]";
  if (CREDENTIAL_PATTERN.test(value)) return "[REDACTED:credential]";
  const digits = value.replaceAll(/\D/g, "");
  if (luhnValid(digits)) return "[REDACTED:payment-data]";
  return value;
}

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : redactForLog(nestedValue),
      ]),
    );
  }
  return typeof value === "string" ? redactString(value) : value;
}

export function safeRequestPath(url: string): string {
  const path = new URL(url).pathname;
  if (/^\/orders\/[^/]+\/?$/.test(path)) return "/orders/:guestToken";
  return path;
}

export function safeRequestId(
  candidate: string | undefined,
  generate: () => string = () => crypto.randomUUID(),
): string {
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : generate();
}
