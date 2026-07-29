import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, test } from "vitest";

import { verifyAccessJwt } from "../../src/iam/access-jwt";

async function accessToken(overrides: { audience?: string; expiresAt?: string } = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  const token = await new SignJWT({ email: "operator@example.test" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://shoppp.cloudflareaccess.com")
    .setAudience(overrides.audience ?? "test-audience")
    .setSubject("access-user-001")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? "5m")
    .sign(privateKey);
  return { jwks: { keys: [publicJwk] }, token };
}

describe("Cloudflare Access JWT verification", () => {
  test("accepts a valid token and returns the mapped identity claims", async () => {
    const { jwks, token } = await accessToken();
    await expect(
      verifyAccessJwt(token, {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks,
      }),
    ).resolves.toEqual({
      email: "operator@example.test",
      subject: "access-user-001",
    });
  });

  test("rejects expired, wrong-audience, and malformed tokens", async () => {
    const expired = await accessToken({ expiresAt: "0s" });
    const wrongAudience = await accessToken({ audience: "production-audience" });

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
      verifyAccessJwt("not-a-token", {
        audience: "test-audience",
        issuer: "https://shoppp.cloudflareaccess.com",
        jwks: { keys: [] },
      }),
    ).rejects.toThrow();
  });
});
