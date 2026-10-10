import * as z from "zod";
import { canonicalCatalogReleaseSchema, catalogReleaseV3Schema } from "./catalog";
import { experienceSnapshotSchema, storefrontSemverSchema } from "./storefront-experience";

const id = z.string().trim().min(1).max(160);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const storefrontPublicationEnvironmentSchema = z.enum([
  "development",
  "staging",
  "production",
]);
const origin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password;
  }, "Use an exact credential-free HTTPS origin.");

export const storefrontPublicationIdentitySchema = z
  .object({
    catalogReleaseId: id,
    catalogManifestDigest: digest,
    catalogSourceDigest: digest.nullable(),
    experienceSnapshotId: id,
    snapshotDigest: digest,
    contactVersion: digest,
    experienceVersion: z.int().positive(),
    themeId: id,
    themeVersion: storefrontSemverSchema,
    platformContractVersion: storefrontSemverSchema,
  })
  .strict();

export const storefrontPublicationRequestSchema = z
  .object({
    draftId: id,
    expectedVersion: z.int().positive(),
    identity: storefrontPublicationIdentitySchema,
    expectedActivePublicationId: id.nullable(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const storefrontPublicationRollbackSchema = z
  .object({
    targetPublicationId: id,
    expectedActivePublicationId: id,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

// This marker identifies immutable bytes, not a deployment request. It is retained
// unchanged when the same artifact is validated in staging or restored later.
export const storefrontReleaseMarkerSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceEnvironment: storefrontPublicationEnvironmentSchema,
    identity: storefrontPublicationIdentitySchema,
  })
  .strict();

export const storefrontActivationObservationSchema = storefrontReleaseMarkerSchema
  .extend({
    workerVersionId: id,
  })
  .strict();

// Isolated staging Commerce proof reads the catalog from its currently deployed
// artifact. Production never uses this temporary qualification path.
export const storefrontStagingCatalogObservationSchema = storefrontActivationObservationSchema
  .extend({ catalogManifestJson: z.string().min(1) })
  .strict();

export const storefrontPublicationReceiptSchema = z
  .object({
    environment: storefrontPublicationEnvironmentSchema,
    identity: storefrontPublicationIdentitySchema,
    workerVersionId: id,
    deploymentId: id,
    artifactDigest: digest,
    reportDigest: digest,
    observedAt: z.iso.datetime(),
  })
  .strict();

const run = {
  runId: z.string().regex(/^\d+$/),
  runAttempt: z.int().positive(),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
};
export const storefrontPublicationCallbackSchema = z.discriminatedUnion("status", [
  z.object({ ...run, status: z.literal("building") }).strict(),
  z
    .object({ ...run, status: z.literal("activated"), receipt: storefrontPublicationReceiptSchema })
    .strict(),
  z
    .object({
      ...run,
      status: z.literal("failed"),
      failureCode: id,
      restorationVerified: z.boolean(),
    })
    .strict(),
]);

export const storefrontPublicationSchema = z
  .object({
    id,
    environment: storefrontPublicationEnvironmentSchema,
    identity: storefrontPublicationIdentitySchema,
    operation: z.enum(["publish", "rollback"]),
    status: z.enum(["queued", "building", "succeeded", "failed", "unresolved"]),
    expectedActivePublicationId: id.nullable(),
    rollbackOf: id.nullable(),
    restoreWorkerVersionId: id.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    createdBy: id,
    reason: z.string(),
    correlationId: id.nullable(),
    failureCode: id.nullable(),
    runId: z.string().nullable(),
    runAttempt: z.int().positive().nullable(),
    sourceCommit: z.string().nullable(),
    receipt: storefrontPublicationReceiptSchema.nullable(),
  })
  .strict();

export const storefrontActivePublicationSchema = z
  .object({
    publication: storefrontPublicationSchema.nullable(),
    verification: z.enum(["verified", "none", "unavailable", "mismatch"]),
    checkedAt: z.iso.datetime(),
  })
  .strict();

export const storefrontPublicationContextSchema = z
  .object({
    environment: storefrontPublicationEnvironmentSchema,
    approval: z
      .object({
        id,
        sourceDraftId: id,
        sourceDraftVersion: z.int().positive(),
        sourceValidationId: id,
        contentDigest: digest,
        identity: storefrontPublicationIdentitySchema,
      })
      .strict()
      .nullable(),
    active: storefrontActivePublicationSchema,
    publications: z.array(storefrontPublicationSchema),
  })
  .strict();

export const storefrontPublicationBuildInputSchema = z
  .object({
    environment: z.literal("public"),
    sourceEnvironment: storefrontPublicationEnvironmentSchema,
    expectedOrigin: origin,
    publicationId: id,
    inputIdentity: storefrontPublicationIdentitySchema,
    catalogManifestJson: z.string().min(1),
    catalogRelease: z.union([catalogReleaseV3Schema, canonicalCatalogReleaseSchema]),
    snapshot: experienceSnapshotSchema,
    themeId: id,
    presentationMode: z.literal("live"),
    mediaOrigins: z.array(origin).max(8),
  })
  .strict()
  .superRefine((input, context) => {
    const expected = {
      catalogReleaseId: input.catalogRelease.releaseId,
      experienceSnapshotId: input.snapshot.id,
      experienceVersion: input.snapshot.version,
      themeId: input.snapshot.themeId,
      themeVersion: input.snapshot.themeVersion,
      platformContractVersion: input.snapshot.platformContractVersion,
      contactVersion: input.snapshot.contact?.version,
    };
    if (
      input.snapshot.kind !== "approved" ||
      input.snapshot.bindings.some((binding) => binding.kind === "fixture")
    ) {
      context.addIssue({
        code: "custom",
        message: "Public builds require an approved live snapshot.",
        path: ["snapshot"],
      });
    }
    for (const [key, value] of Object.entries(expected)) {
      if (input.inputIdentity[key as keyof typeof input.inputIdentity] !== value) {
        context.addIssue({
          code: "custom",
          message: `Public input does not match ${key}.`,
          path: ["inputIdentity", key],
        });
      }
    }
    if (
      input.themeId !== input.snapshot.themeId ||
      (input.catalogRelease.schemaVersion === 3 &&
        input.catalogRelease.environment !== input.sourceEnvironment)
    ) {
      context.addIssue({
        code: "custom",
        message: "Public input source or Theme does not match.",
        path: ["sourceEnvironment"],
      });
    }
  });

export function canonicalStorefrontJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStorefrontJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStorefrontJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const storefrontPublicationBuildManifestSchema = z
  .object({
    input: storefrontPublicationBuildInputSchema,
    publication: storefrontPublicationSchema,
    rollbackReceipt: storefrontPublicationReceiptSchema.nullable(),
    baselineReceipt: storefrontPublicationReceiptSchema.nullable(),
  })
  .strict();

export function sameStorefrontPublicationIdentity(
  left: StorefrontPublicationIdentity,
  right: StorefrontPublicationIdentity,
): boolean {
  return canonicalStorefrontJson(left) === canonicalStorefrontJson(right);
}

export type StorefrontPublicationIdentity = z.infer<typeof storefrontPublicationIdentitySchema>;
export type StorefrontPublication = z.infer<typeof storefrontPublicationSchema>;
export type StorefrontPublicationReceipt = z.infer<typeof storefrontPublicationReceiptSchema>;
export type StorefrontPublicationRequest = z.infer<typeof storefrontPublicationRequestSchema>;
export type StorefrontPublicationRollback = z.infer<typeof storefrontPublicationRollbackSchema>;
export type StorefrontPublicationCallback = z.infer<typeof storefrontPublicationCallbackSchema>;
export type StorefrontPublicationBuildInput = z.infer<typeof storefrontPublicationBuildInputSchema>;
export type StorefrontPublicationContext = z.infer<typeof storefrontPublicationContextSchema>;
export type StorefrontActivePublication = z.infer<typeof storefrontActivePublicationSchema>;
export type StorefrontReleaseMarker = z.infer<typeof storefrontReleaseMarkerSchema>;
export type StorefrontPublicationBuildManifest = z.infer<
  typeof storefrontPublicationBuildManifestSchema
>;
