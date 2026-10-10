import { describe, expect, test } from "bun:test";
import {
  storefrontPublicationRequestSchema,
  storefrontPublicationCallbackSchema,
  storefrontReleaseMarkerSchema,
} from "../src/storefront-publication";

const identity = {
  catalogReleaseId: "release-exact",
  catalogManifestDigest: "a".repeat(64),
  catalogSourceDigest: "b".repeat(64),
  experienceSnapshotId: "snapshot-approved",
  snapshotDigest: "c".repeat(64),
  contactVersion: "d".repeat(64),
  experienceVersion: 3,
  themeId: "fashion-store",
  themeVersion: "1.1.0",
  platformContractVersion: "1.0.0",
};

describe("formal storefront publication contract", () => {
  test("requires exact approval identity and an explicit previous active pointer", () => {
    const input = {
      draftId: "draft-shop",
      expectedVersion: 3,
      identity,
      expectedActivePublicationId: null,
      reason: "Launch approved shop",
    };
    expect(storefrontPublicationRequestSchema.parse(input)).toEqual(input);
    expect(
      storefrontPublicationRequestSchema.safeParse({
        ...input,
        expectedActivePublicationId: undefined,
      }).success,
    ).toBe(false);
    expect(
      storefrontPublicationRequestSchema.safeParse({
        ...input,
        identity: { ...identity, snapshotDigest: "wrong" },
      }).success,
    ).toBe(false);
  });

  test("activation receipt binds environment, run attempt and actual version", () => {
    const result = {
      status: "activated",
      runId: "12345",
      runAttempt: 1,
      sourceCommit: "e".repeat(40),
      receipt: {
        environment: "staging",
        identity,
        workerVersionId: "version-exact",
        deploymentId: "deployment-exact",
        artifactDigest: "f".repeat(64),
        reportDigest: "0".repeat(64),
        observedAt: "2026-10-11T00:00:00.000Z",
      },
    };
    expect(storefrontPublicationCallbackSchema.safeParse(result).success).toBe(true);
    expect(
      storefrontPublicationCallbackSchema.safeParse({ ...result, runAttempt: 0 }).success,
    ).toBe(false);
    expect(
      storefrontPublicationCallbackSchema.safeParse({
        ...result,
        receipt: { ...result.receipt, workerVersionId: "" },
      }).success,
    ).toBe(false);
  });

  test("public marker is portable between protected targets and exact rollback", () => {
    const marker = { schemaVersion: 1 as const, sourceEnvironment: "production" as const, identity };
    expect(storefrontReleaseMarkerSchema.parse(marker)).toEqual(marker);
    expect(
      storefrontReleaseMarkerSchema.safeParse({ ...marker, publicationId: "new-rollback-request" })
        .success,
    ).toBe(false);
    expect(
      storefrontReleaseMarkerSchema.safeParse({ ...marker, previewToken: "secret" }).success,
    ).toBe(false);
  });
});
