import { describe, expect, test } from "bun:test";

import { verifyFashionStagingOperatorActivation } from "./verify-fashion-staging-operator-activation";

const validVerification = {
  acceptedAt: "2026-08-31T03:00:00.000Z",
  auditActorType: "admin",
  auditId: "audit-activation",
  auditResult: "succeeded",
  auditTargetType: "admin_invitation",
  credentialCount: 1,
  displayName: "Shoppp Fashion Staging Owner",
  identityEnabled: 1,
  identityExpiresAt: null,
  identityId: "identity-fashion-owner",
  invitationId: "invitation-fashion-owner",
  principalKind: "human",
  roleEnabled: 1,
  roleKey: "admin",
  roleProtected: 1,
} as const;

function d1Output(verification: unknown): string {
  return JSON.stringify([{ results: [{ verification: JSON.stringify(verification) }], success: true }]);
}

describe("Fashion staging operator activation verification", () => {
  test("returns the exact non-secret activation Snapshot", () => {
    expect(verifyFashionStagingOperatorActivation(d1Output(validVerification))).toEqual(
      validVerification,
    );
  });

  for (const [label, patch] of [
    ["wrong display name", { displayName: "Another operator" }],
    ["service principal", { principalKind: "service" }],
    ["expired identity", { identityExpiresAt: "2026-09-01T00:00:00.000Z" }],
    ["disabled identity", { identityEnabled: 0 }],
    ["disabled role", { roleEnabled: 0 }],
    ["unprotected role", { roleProtected: 0 }],
    ["wrong role", { roleKey: "catalog_manager" }],
    ["missing credential", { credentialCount: 0 }],
    ["duplicate credential", { credentialCount: 2 }],
    ["wrong audit actor", { auditActorType: "service" }],
    ["wrong audit target", { auditTargetType: "admin_identity" }],
    ["failed audit", { auditResult: "denied" }],
    ["missing identity ID", { identityId: "" }],
    ["missing invitation ID", { invitationId: "" }],
    ["missing acceptance timestamp", { acceptedAt: "" }],
    ["missing audit ID", { auditId: "" }],
  ] as const) {
    test(`rejects ${label}`, () => {
      expect(() =>
        verifyFashionStagingOperatorActivation(d1Output({ ...validVerification, ...patch })),
      ).toThrow();
    });
  }

  test("rejects malformed or missing D1 result shapes", () => {
    expect(() => verifyFashionStagingOperatorActivation("not-json")).toThrow();
    expect(() =>
      verifyFashionStagingOperatorActivation(
        JSON.stringify([{ results: [{ verification: "not-json" }], success: true }]),
      ),
    ).toThrow();
    expect(() =>
      verifyFashionStagingOperatorActivation(JSON.stringify([{ results: [], success: true }])),
    ).toThrow();
    expect(() =>
      verifyFashionStagingOperatorActivation(
        JSON.stringify([{ results: [{ verification: "{}" }], success: false }]),
      ),
    ).toThrow();
    expect(() =>
      verifyFashionStagingOperatorActivation(
        JSON.stringify([
          { results: [{ verification: JSON.stringify(validVerification) }], success: true },
          { results: [], success: true },
        ]),
      ),
    ).toThrow();
  });
});
