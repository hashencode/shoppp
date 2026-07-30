import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  type RemoteJWKSetOptions,
} from "jose";

export interface AccessIdentity {
  readonly email: string;
  readonly subject: string;
}

export interface AccessVerificationConfig {
  readonly audience: string;
  readonly issuer: string;
  readonly jwks?: JSONWebKeySet;
  readonly keySet?: JWTVerifyGetKey;
}

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

export function createAccessKeySet(issuer: string, options?: RemoteJWKSetOptions): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer), options);
}

function resolveKeySet(config: AccessVerificationConfig): JWTVerifyGetKey {
  if (config.keySet) {
    return config.keySet;
  }
  if (config.jwks) {
    return createLocalJWKSet(config.jwks);
  }
  const cached = remoteKeySets.get(config.issuer);
  if (cached) {
    return cached;
  }
  const remote = createAccessKeySet(config.issuer);
  remoteKeySets.set(config.issuer, remote);
  return remote;
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
  const { payload } = await jwtVerify(token, resolveKeySet(config), options);
  if (typeof payload.sub === "string" && typeof payload.email === "string") {
    return { email: payload.email, subject: payload.sub };
  }
  if (
    payload.type === "app" &&
    typeof payload.common_name === "string" &&
    payload.common_name.length > 0
  ) {
    return {
      email: "service-auth@cloudflare-access.invalid",
      subject: payload.common_name,
    };
  }
  throw new Error("Access token is missing required identity claims.");
}
