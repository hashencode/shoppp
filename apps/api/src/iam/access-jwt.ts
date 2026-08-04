import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  type RemoteJWKSetOptions,
} from "jose";

export interface HumanAccessIdentity {
  readonly email: string;
  readonly principalKind: "human";
  readonly subject: string;
}

export interface ServiceAccessIdentity {
  readonly principalKind: "service";
  readonly serviceName: string;
  readonly subject: string;
}

export type AccessIdentity = HumanAccessIdentity | ServiceAccessIdentity;

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
  if (payload.type === "app") {
    if (typeof payload.common_name === "string" && payload.common_name.trim().length > 0) {
      const serviceName = payload.common_name.trim();
      return { principalKind: "service", serviceName, subject: serviceName };
    }
    throw new Error("Access token is missing required identity claims.");
  }
  if (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.email === "string" &&
    payload.email.trim().length > 0
  ) {
    return {
      email: payload.email.trim().toLowerCase(),
      principalKind: "human",
      subject: payload.sub,
    };
  }
  throw new Error("Access token is missing required identity claims.");
}
