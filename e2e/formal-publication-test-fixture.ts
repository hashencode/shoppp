import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalStorefrontJson } from "../packages/contracts/src/storefront-publication";

const sha = "a".repeat(40);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function formalPublicationFixture() {
  const catalogRelease = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../apps/storefront/fixtures/release.json"), "utf8"),
  );
  const snapshot = {
    kind: "approved",
    id: "snapshot-proof",
    experienceId: "experience-proof",
    version: 3,
    approvedAt: "2026-10-11T00:00:00.000Z",
    approvedBy: "operator",
    bindings: [],
    overrides: [],
    configurationSchemaVersion: 1,
    themeId: "fashion-store",
    themeVersion: "2.0.0",
    platformContractVersion: "1.0.0",
    provenance: {
      approvedAt: "2026-10-11T00:00:00.000Z",
      approvedBy: "operator",
      license: "MIT",
      source: "test",
    },
    resolvedTemplates: [{ id: "home", pageType: "home", requiredCapabilities: [], sections: [] }],
    contact: {
      version: "d".repeat(64),
      publicContact: {
        supportEmail: null,
        privacyEmail: null,
        publicPhone: null,
        serviceHours: null,
        timeZone: "UTC",
        locations: [],
        socials: [],
      },
    },
  };
  const catalogManifestJson = JSON.stringify(catalogRelease);
  const identity = {
    catalogReleaseId: catalogRelease.releaseId,
    catalogManifestDigest: hash(catalogManifestJson),
    catalogSourceDigest: null,
    experienceSnapshotId: snapshot.id,
    snapshotDigest: hash(canonicalStorefrontJson(snapshot)),
    contactVersion: snapshot.contact.version,
    experienceVersion: snapshot.version,
    themeId: snapshot.themeId,
    themeVersion: snapshot.themeVersion,
    platformContractVersion: snapshot.platformContractVersion,
  };
  return {
    input: {
      environment: "public",
      sourceEnvironment: "production",
      expectedOrigin: catalogRelease.site.origin,
      publicationId: "publication-proof",
      inputIdentity: identity,
      catalogManifestJson,
      catalogRelease,
      snapshot,
      themeId: snapshot.themeId,
      presentationMode: "live",
      mediaOrigins: [],
    },
    publication: {
      id: "publication-proof",
      environment: "production",
      identity,
      operation: "publish",
      status: "queued",
      expectedActivePublicationId: null,
      rollbackOf: null,
      restoreWorkerVersionId: null,
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:00:00.000Z",
      createdBy: "operator",
      reason: "Publish",
      correlationId: null,
      failureCode: null,
      runId: null,
      runAttempt: null,
      sourceCommit: null,
      receipt: null,
    },
    baselineReceipt: null,
    rollbackReceipt: null,
  };
}
export function formalPublicationEnvironment(input = formalPublicationFixture()) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "hashencode/shoppp",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_WORKFLOW_REF: "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main",
    GITHUB_RUN_ID: "1234",
    GITHUB_RUN_ATTEMPT: "1",
    PUBLICATION_ID: input.publication.id,
    SOURCE_ENVIRONMENT: input.publication.environment,
    ACTIVATION_ENVIRONMENT: "staging",
    PUBLICATION_VALIDATED_SOURCE_SHA: sha,
    RELEASE_EXPECTED_COMMIT: sha,
    STOREFRONT_E2E_BASE_URL: "https://staging.example.test",
    E2E_PRODUCT_SLUG: input.input.catalogRelease.products[0].slug,
    STOREFRONT_PUBLICATION_PROOF: JSON.stringify({
      publicationId: input.publication.id,
      sourceEnvironment: input.publication.environment,
      activationEnvironment: "staging",
      run: { runId: "1234", runAttempt: 1, sourceCommit: sha },
      observation: {
        schemaVersion: 1,
        sourceEnvironment: input.publication.environment,
        identity: input.publication.identity,
        workerVersionId: "version-observed",
      },
    }),
  };
}
