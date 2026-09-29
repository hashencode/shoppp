import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { ApiBindings, ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

export const TRAFFIC_COOKIE = "__Host-shoppp-traffic";
const IDENTITY_LIFETIME = 365 * 24 * 60 * 60 * 1000;
export const TICKET_LIFETIME = 60 * 60 * 1000;
const encoder = new TextEncoder();

type Identity = {
  kind: "identity";
  id: string;
  environment: string;
  issuedAt: number;
  expiresAt: number;
};
type Ticket = {
  kind: "ticket";
  visitorDigest: string;
  releaseId: string;
  environment: string;
  issuedAt: number;
  expiresAt: number;
};
type Claims = Identity | Ticket;

function unavailable(): never {
  throw new ApiError(503, "traffic_unavailable", "Traffic collection is unavailable.");
}
function keyring(env: ApiBindings): { keys: Record<string, string>; active: string } {
  try {
    const keys: unknown = JSON.parse(env.TRAFFIC_KEYS_JSON ?? "");
    const active = env.TRAFFIC_ACTIVE_KEY_ID ?? "";
    if (
      !keys ||
      typeof keys !== "object" ||
      Array.isArray(keys) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(active)
    )
      return unavailable();
    for (const [id, key] of Object.entries(keys)) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || typeof key !== "string" || key.length < 32)
        return unavailable();
    }
    if (!Object.hasOwn(keys, active)) return unavailable();
    return { keys: keys as Record<string, string>, active };
  } catch {
    return unavailable();
  }
}
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
}
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function sign(env: ApiBindings, claims: Claims): Promise<string> {
  const { keys, active } = keyring(env);
  const payload = `${active}.${encode(encoder.encode(JSON.stringify(claims)))}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(keys[active]!),
    encoder.encode(payload),
  );
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
async function verify(
  env: ApiBindings,
  token: string,
  now: number,
): Promise<{ claims: Claims; keyId: string } | null> {
  const { keys } = keyring(env);
  try {
    if (token.length > 2048) return null;
    const [keyId, payload, signature, extra] = token.split(".");
    if (!keyId || !payload || !signature || extra !== undefined || !Object.hasOwn(keys, keyId))
      return null;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await hmacKey(keys[keyId]!),
        new Uint8Array(decode(signature)).buffer,
        encoder.encode(`${keyId}.${payload}`),
      ))
    )
      return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload))) as Claims;
    if (
      !claims ||
      claims.environment !== env.ENVIRONMENT ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.issuedAt > now ||
      claims.expiresAt <= now ||
      claims.expiresAt <= claims.issuedAt
    )
      return null;
    if (claims.kind === "identity") {
      if (
        typeof claims.id !== "string" ||
        !/^[0-9a-f-]{36}$/.test(claims.id) ||
        claims.expiresAt - claims.issuedAt > IDENTITY_LIFETIME
      )
        return null;
    } else if (claims.kind === "ticket") {
      if (
        typeof claims.visitorDigest !== "string" ||
        typeof claims.releaseId !== "string" ||
        claims.expiresAt - claims.issuedAt > TICKET_LIFETIME
      )
        return null;
    } else return null;
    return { claims, keyId };
  } catch {
    return null;
  }
}
async function digest(env: ApiBindings, identity: Identity, keyId: string): Promise<string> {
  // Derive with the identity's original key, so rotation never changes its UV.
  const { keys } = keyring(env);
  const bytes = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(keys[keyId]!),
    encoder.encode(`traffic-visitor:${env.ENVIRONMENT}:${identity.id}`),
  );
  return encode(new Uint8Array(bytes));
}
export async function readTrafficIdentity(
  context: Context<ApiEnvironment>,
  now = Date.now(),
): Promise<string | null> {
  const token = getCookie(context, TRAFFIC_COOKIE);
  if (!token) return null;
  const verified = await verify(context.env, token, now);
  return verified?.claims.kind === "identity"
    ? digest(context.env, verified.claims, verified.keyId)
    : null;
}
export async function issueTrafficTicket(
  context: Context<ApiEnvironment>,
  releaseId: string,
  now = Date.now(),
) {
  let visitorDigest = await readTrafficIdentity(context, now);
  if (!visitorDigest) {
    const claims: Identity = {
      kind: "identity",
      id: crypto.randomUUID(),
      environment: context.env.ENVIRONMENT,
      issuedAt: now,
      expiresAt: now + IDENTITY_LIFETIME,
    };
    const { active } = keyring(context.env);
    const token = await sign(context.env, claims);
    setCookie(context, TRAFFIC_COOKIE, token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: IDENTITY_LIFETIME / 1000,
    });
    visitorDigest = await digest(context.env, claims, active);
  }
  const expiresAt = now + TICKET_LIFETIME;
  const ticket = await sign(context.env, {
    kind: "ticket",
    visitorDigest,
    releaseId,
    environment: context.env.ENVIRONMENT,
    issuedAt: now,
    expiresAt,
  });
  return { ticket, expiresAt: new Date(expiresAt).toISOString() };
}
export async function authorizeTrafficEvent(
  context: Context<ApiEnvironment>,
  ticket: string,
  releaseId: string,
  now = Date.now(),
): Promise<string> {
  const verified = await verify(context.env, ticket, now);
  const visitorDigest = await readTrafficIdentity(context, now);
  if (
    !visitorDigest ||
    verified?.claims.kind !== "ticket" ||
    verified.claims.releaseId !== releaseId ||
    verified.claims.visitorDigest !== visitorDigest
  ) {
    throw new ApiError(
      403,
      "traffic_identity_invalid",
      "A valid traffic identity and ticket are required.",
    );
  }
  return visitorDigest;
}
