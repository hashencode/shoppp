interface FashionStagingOperatorActivation {
  acceptedAt: string;
  auditActorType: "admin";
  auditId: string;
  auditResult: "succeeded";
  auditTargetType: "admin_invitation";
  credentialCount: 1;
  displayName: "Shoppp Fashion Staging Owner";
  identityEnabled: 1;
  identityExpiresAt: null;
  identityId: string;
  invitationId: string;
  principalKind: "human";
  roleEnabled: 1;
  roleKey: "admin";
  roleProtected: 1;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function verifyFashionStagingOperatorActivation(
  raw: string,
): FashionStagingOperatorActivation {
  const result = JSON.parse(raw) as unknown;
  assert(
    Array.isArray(result) && result.length === 1 && isRecord(result[0]),
    "D1 verification result is missing or ambiguous",
  );
  assert(result[0].success === true, "D1 verification query failed");
  const rows = result[0].results;
  assert(Array.isArray(rows) && isRecord(rows[0]), "D1 verification row is missing");
  const encoded = rows[0].verification;
  assert(typeof encoded === "string", "D1 verification Snapshot is missing");
  const verification = JSON.parse(encoded) as unknown;
  assert(isRecord(verification), "D1 verification Snapshot is invalid");

  assert(
    verification.displayName === "Shoppp Fashion Staging Owner",
    "operator display name is invalid",
  );
  assert(verification.principalKind === "human", "operator must be a human identity");
  assert(verification.identityEnabled === 1, "operator identity is disabled");
  assert(verification.identityExpiresAt === null, "operator identity must be durable");
  assert(verification.roleKey === "admin", "operator role is invalid");
  assert(verification.roleEnabled === 1, "operator role is disabled");
  assert(verification.roleProtected === 1, "operator role is not protected");
  assert(verification.credentialCount === 1, "operator password credential is missing");
  assert(verification.auditActorType === "admin", "activation audit actor is invalid");
  assert(verification.auditTargetType === "admin_invitation", "activation audit target is invalid");
  assert(verification.auditResult === "succeeded", "activation audit did not succeed");
  for (const [label, value] of [
    ["identity ID", verification.identityId],
    ["invitation ID", verification.invitationId],
    ["acceptance timestamp", verification.acceptedAt],
    ["audit ID", verification.auditId],
  ] as const) {
    assert(nonEmptyString(value), `${label} is missing`);
  }

  return verification as unknown as FashionStagingOperatorActivation;
}

if (import.meta.main) {
  const verification = verifyFashionStagingOperatorActivation(await Bun.stdin.text());
  process.stdout.write(`${JSON.stringify(verification)}\n`);
}
