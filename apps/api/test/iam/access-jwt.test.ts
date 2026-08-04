import { customFetch, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, test } from "vitest";

import { createAccessKeySet, verifyAccessJwt } from "../../src/iam/access-jwt";

async function signingKey(kid = "test-key") {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  return { kid, privateKey, publicJwk };
}

type SigningKey = Awaited<ReturnType<typeof signingKey>>;

async function accessToken(
  overrides: {
    audience?: string | string[];
    expiresAt?: string;
    issuer?: string;
    key?: SigningKey;
    payload?: Record<string, unknown>;
    subject?: string;
  } = {},
) {
  const key = overrides.key ?? (await signingKey());
  let token = new SignJWT(overrides.payload ?? { email: "operator@example.test" })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setIssuer(overrides.issuer ?? "https://shoppp.cloudflareaccess.com")
    .setAudience(overrides.audience ?? "test-audience")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? "5m");
  if (overrides.subject !== undefined) {
    token = token.setSubject(overrides.subject);
  }
  return {
    jwks: { keys: [key.publicJwk] },
    token: await token.sign(key.privateKey),
  };
}

describe("Cloudflare Access JWT verification", () => {
  test("accepts a valid token and returns the mapped identity claims", async () => {
    const { jwks, token } = await accessToken({ subject: "access-user-001" });
    await expect(
      verifyAccessJwt(token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks,
      }),
    ).resolves.toEqual({
      email: "operator@example.test",
      principalKind: "human",
      subject: "access-user-001",
    });
  });

  test("accepts a production-shaped Cloudflare service token", async () => {
    const { jwks, token } = await accessToken({
      audience: ["test-audience"],
      payload: { common_name: "service-token-001.access", type: "app" },
      subject: "",
    });
    await expect(
      verifyAccessJwt(token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks,
      }),
    ).resolves.toEqual({
      principalKind: "service",
      serviceName: "service-token-001.access",
      subject: "service-token-001.access",
    });
  });

  test("refreshes the remote JWKS when an unknown key id appears after rotation", async () => {
    const issuer = "https://shoppp.cloudflareaccess.com";
    const beforeRotation = await signingKey("key-before-rotation");
    const afterRotation = await signingKey("key-after-rotation");
    let publishedJwks = { keys: [beforeRotation.publicJwk] };
    let fetchCount = 0;
    const keySet = createAccessKeySet(issuer, {
      cooldownDuration: 0,
      [customFetch]: async (url) => {
        expect(url).toBe(`${issuer}/cdn-cgi/access/certs`);
        fetchCount += 1;
        return Response.json(publishedJwks);
      },
    });

    const first = await accessToken({ key: beforeRotation, subject: "access-user-001" });
    await expect(
      verifyAccessJwt(first.token, {
        audience: "test-audience",
        issuer,
        keySet,
      }),
    ).resolves.toEqual({
      email: "operator@example.test",
      principalKind: "human",
      subject: "access-user-001",
    });

    publishedJwks = { keys: [afterRotation.publicJwk] };
    const second = await accessToken({ key: afterRotation, subject: "access-user-002" });
    await expect(
      verifyAccessJwt(second.token, {
        audience: "test-audience",
        issuer,
        keySet,
      }),
    ).resolves.toEqual({
      email: "operator@example.test",
      principalKind: "human",
      subject: "access-user-002",
    });
    expect(fetchCount).toBe(2);
  });

  test("rejects expired, wrong-audience, wrong-issuer, and malformed tokens", async () => {
    const expired = await accessToken({ expiresAt: "0s" });
    const wrongAudience = await accessToken({ audience: "production-audience" });
    const wrongIssuer = await accessToken({ issuer: "https://other.cloudflareaccess.com" });
    const wrongServiceType = await accessToken({
      payload: { common_name: "service-token-001.access", type: "user" },
    });

    await expect(
      verifyAccessJwt(expired.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: expired.jwks,
      }),
    ).rejects.toThrow();
    await expect(
      verifyAccessJwt(wrongAudience.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: wrongAudience.jwks,
      }),
    ).rejects.toThrow();
    await expect(
      verifyAccessJwt(wrongIssuer.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: wrongIssuer.jwks,
      }),
    ).rejects.toThrow();
    await expect(
      verifyAccessJwt("not-a-token", {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: { keys: [] },
      }),
    ).rejects.toThrow();
    await expect(
      verifyAccessJwt(wrongServiceType.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: wrongServiceType.jwks,
      }),
    ).rejects.toThrow();
  });

  test.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["missing", undefined],
    ["non-string", 42],
  ])("rejects an app token with an %s common_name", async (_case, commonName) => {
    const payload: Record<string, unknown> = { type: "app" };
    if (commonName !== undefined) {
      payload.common_name = commonName;
    }
    const malformedService = await accessToken({ payload });

    await expect(
      verifyAccessJwt(malformedService.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: malformedService.jwks,
      }),
    ).rejects.toThrow("Access token is missing required identity claims.");
  });

  test("does not reinterpret an app token with human-looking claims as a human", async () => {
    const malformedService = await accessToken({
      payload: {
        common_name: "",
        email: "operator@example.test",
        type: "app",
      },
      subject: "access-user-001",
    });

    await expect(
      verifyAccessJwt(malformedService.token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: malformedService.jwks,
      }),
    ).rejects.toThrow("Access token is missing required identity claims.");
  });
});
