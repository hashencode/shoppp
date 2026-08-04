const DEFAULT_PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_BYTES = 32;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { hash: "SHA-256", iterations, name: "PBKDF2", salt: new Uint8Array(salt).buffer },
    key,
    PASSWORD_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export interface PasswordHash {
  readonly hash: string;
  readonly iterations: number;
  readonly salt: string;
}

export async function hashPassword(
  password: string,
  options: { iterations?: number; salt?: string } = {},
): Promise<PasswordHash> {
  const iterations = options.iterations ?? DEFAULT_PASSWORD_ITERATIONS;
  if (iterations < 100_000) throw new Error("Password hashing iterations are too low.");
  const salt = options.salt
    ? decodeBase64Url(options.salt)
    : crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);
  return { hash: encodeBase64Url(hash), iterations, salt: encodeBase64Url(salt) };
}

export async function verifyPassword(
  password: string,
  credential: Pick<PasswordHash, "hash" | "iterations" | "salt">,
): Promise<boolean> {
  try {
    const expected = decodeBase64Url(credential.hash);
    const actual = await derivePassword(
      password,
      decodeBase64Url(credential.salt),
      credential.iterations,
    );
    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomOpaqueToken(byteLength = 32): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("AUTH_TOKEN_SECRET must contain at least 32 characters.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    usages,
  );
}

async function createSignedToken(secret: string, claims: Record<string, unknown>): Promise<string> {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySignedToken(
  secret: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, encodedSignature] = parts;
    if (!payload || !encodedSignature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      new Uint8Array(decodeBase64Url(encodedSignature)).buffer,
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const claims: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return claims !== null && typeof claims === "object" && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function createSignedResetToken(
  secret: string,
  input: { expiresAt: string; identityId: string; passwordVersion: number; resetId: string },
): Promise<string> {
  return createSignedToken(secret, {
    e: input.expiresAt,
    i: input.identityId,
    p: "password_reset",
    r: input.resetId,
    v: input.passwordVersion,
  });
}

export async function createSignedInvitationToken(
  secret: string,
  input: { expiresAt: string; invitationId: string; version: number },
): Promise<string> {
  return createSignedToken(secret, {
    e: input.expiresAt,
    n: input.invitationId,
    p: "account_activation",
    v: input.version,
  });
}
