import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTVerifyOptions } from "jose";

export interface AccessIdentity {
  readonly email: string;
  readonly subject: string;
}

export interface AccessVerificationConfig {
  readonly audience: string;
  readonly issuer: string;
  readonly jwks: JSONWebKeySet;
}

export async function verifyAccessJwt(
  token: string,
  config: AccessVerificationConfig,
): Promise<AccessIdentity> {
  const options: JWTVerifyOptions = {
    algorithms: ["RS256"],
    audience: config.audience,
    issuer: config.issuer,
  };
  const { payload } = await jwtVerify(token, createLocalJWKSet(config.jwks), options);
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Access token is missing required identity claims.");
  }
  return { email: payload.email, subject: payload.sub };
}
