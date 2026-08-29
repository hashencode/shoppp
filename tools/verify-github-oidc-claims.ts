export interface GithubOidcClaims {
  actor?: string;
  aud?: string | string[];
  event_name?: string;
  environment?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
  ref?: string;
  repository?: string;
  repository_owner?: string;
  sub?: string;
  workflow_ref?: string;
}

export interface GithubOidcAuthority {
  authorizedActors: string;
  expectedAudience: string;
  expectedEnvironment: string;
  expectedRepository: string;
  expectedWorkflowRef: string;
  nowSeconds?: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyGithubOidcClaims(claims: GithubOidcClaims, authority: GithubOidcAuthority) {
  const now = authority.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  assert(audience.includes(authority.expectedAudience), "OIDC audience is not authorized");
  assert(claims.iss === "https://token.actions.githubusercontent.com", "OIDC issuer is invalid");
  assert(typeof claims.exp === "number" && claims.exp > now, "OIDC token is expired");
  assert(typeof claims.nbf === "number" && claims.nbf <= now, "OIDC token is not active");
  assert(claims.repository === authority.expectedRepository, "OIDC repository is not authorized");
  assert(claims.ref === "refs/heads/main", "OIDC ref must be exact main");
  assert(claims.event_name === "workflow_dispatch", "OIDC event must be workflow_dispatch");
  const owner = authority.expectedRepository.split("/", 1)[0];
  assert(claims.repository_owner === owner, "OIDC repository owner is not authorized");
  assert(
    claims.environment === authority.expectedEnvironment,
    "OIDC environment is not authorized",
  );
  assert(
    claims.sub ===
      `repo:${authority.expectedRepository}:environment:${authority.expectedEnvironment}`,
    "OIDC subject is not bound to the protected environment",
  );
  assert(
    claims.workflow_ref === authority.expectedWorkflowRef,
    "OIDC workflow ref is not the executing workflow",
  );
  const allowed = new Set(
    authority.authorizedActors
      .split(",")
      .map((actor) => actor.trim())
      .filter(Boolean),
  );
  assert(claims.actor === owner || allowed.has(claims.actor ?? ""), "OIDC actor is not authorized");
  return { actor: claims.actor!, passed: true as const, repository: claims.repository! };
}

function decodePayload(token: string): GithubOidcClaims {
  const parts = token.split(".");
  assert(parts.length === 3, "OIDC token must be a JWT");
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as GithubOidcClaims;
  } catch {
    throw new Error("OIDC token payload is invalid");
  }
}

if (import.meta.main) {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const result = verifyGithubOidcClaims(decodePayload(required("SHOPPP_GITHUB_OIDC_TOKEN")), {
    authorizedActors: process.env.FASHION_STAGING_OPERATORS ?? "",
    expectedAudience: "shoppp-fashion-staging",
    expectedEnvironment: "fashion-staging",
    expectedRepository: required("EXPECTED_REPOSITORY"),
    expectedWorkflowRef: required("GITHUB_WORKFLOW_REF"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
