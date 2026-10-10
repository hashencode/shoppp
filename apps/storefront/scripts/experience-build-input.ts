import { createHash } from "node:crypto";
import {
  canonicalStorefrontJson,
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  experienceSnapshotSchema,
  storefrontPublicationBuildInputSchema,
} from "@shoppp/contracts";
import * as z from "zod";

const exactHttpsOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      url.origin === value
    );
  }, "Preview origin must be one exact credential-free HTTPS origin.");

const productionExperienceBuildInputSchema = z
  .object({ environment: z.literal("production") })
  .strict();
const fixturePreviewBuildInputSchema = z
  .object({
    catalogRelease: z.union([catalogReleaseV3Schema, canonicalCatalogReleaseSchema]).optional(),
    environment: z.literal("preview"),
    expectedOrigin: exactHttpsOriginSchema,
    snapshot: experienceSnapshotSchema,
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  })
  .strict();
const previewInputIdentitySchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160),
    experienceSnapshotId: z.string().trim().min(1).max(160),
    experienceVersion: z.int().positive(),
    platformContractVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    themeVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  })
  .strict();
const livePreviewBuildInputSchema = z
  .object({
    catalogRelease: z.union([catalogReleaseV3Schema, canonicalCatalogReleaseSchema]),
    environment: z.literal("preview"),
    expectedOrigin: exactHttpsOriginSchema,
    inputIdentity: previewInputIdentitySchema,
    mediaOrigins: z
      .array(exactHttpsOriginSchema)
      .max(8)
      .refine((origins) => new Set(origins).size === origins.length, {
        message: "Preview media origins must be unique.",
      }),
    presentationMode: z.literal("live"),
    snapshot: experienceSnapshotSchema,
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  })
  .strict()
  .superRefine((input, context) => {
    const expected = {
      catalogReleaseId: input.catalogRelease.releaseId,
      experienceSnapshotId: input.snapshot.id,
      experienceVersion: input.snapshot.version,
      platformContractVersion: input.snapshot.platformContractVersion,
      themeId: input.snapshot.themeId,
      themeVersion: input.snapshot.themeVersion,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (input.inputIdentity[key as keyof typeof input.inputIdentity] !== value) {
        context.addIssue({
          code: "custom",
          message: `Live preview input identity does not match ${key}.`,
          path: ["inputIdentity", key],
        });
      }
    }
  });

const publicExperienceBuildInputSchema = storefrontPublicationBuildInputSchema.superRefine(
  (input, context) => {
    const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
    if (sha256(input.catalogManifestJson) !== input.inputIdentity.catalogManifestDigest) {
      context.addIssue({
        code: "custom",
        message: "Public Catalog manifest digest does not match retained bytes.",
        path: ["catalogManifestJson"],
      });
    }
    if (sha256(canonicalStorefrontJson(input.snapshot)) !== input.inputIdentity.snapshotDigest) {
      context.addIssue({
        code: "custom",
        message: "Public Snapshot digest does not match approved bytes.",
        path: ["snapshot"],
      });
    }
    try {
      const raw = JSON.parse(input.catalogManifestJson);
      const release = z.union([catalogReleaseV3Schema, canonicalCatalogReleaseSchema]).parse(raw);
      if (canonicalStorefrontJson(release) !== canonicalStorefrontJson(input.catalogRelease)) {
        context.addIssue({
          code: "custom",
          message: "Public Catalog input differs from retained manifest.",
          path: ["catalogRelease"],
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "Public Catalog manifest is invalid.",
        path: ["catalogManifestJson"],
      });
    }
  },
);

export const experienceBuildInputSchema = z.union([
  productionExperienceBuildInputSchema,
  fixturePreviewBuildInputSchema,
  livePreviewBuildInputSchema,
  publicExperienceBuildInputSchema,
]);

export type ExperienceBuildInput = z.infer<typeof experienceBuildInputSchema>;
