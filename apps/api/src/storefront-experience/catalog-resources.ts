import {
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  type CanonicalCatalogRelease,
} from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";
import { ApiError } from "../http/errors";
import { assertCatalogReleaseLifecycle } from "../publishing/candidate-releases";
import { fashionStoreEditorDestinations } from "../../../storefront/app/themes/fashion-store/editor-destinations";

interface ReleaseRow {
  approved_at: string;
  deployed_at: string | null;
  id: string;
  manifest_json: string;
  status: "deployed";
}

function parseCanonicalRelease(
  row: Pick<ReleaseRow, "id" | "manifest_json">,
): CanonicalCatalogRelease | null {
  let manifest: unknown;
  try {
    manifest = JSON.parse(row.manifest_json);
  } catch {
    return null;
  }
  const parsed = canonicalCatalogReleaseSchema.safeParse(manifest);
  return parsed.success && parsed.data.releaseId === row.id ? parsed.data : null;
}

export async function getCanonicalDeployedCatalogRelease(
  db: D1Database,
  releaseId: string,
  options: {
    allowPrivateCandidate?: boolean;
    privateCandidateBuildId?: string;
    allowStagingProof?: boolean;
    environment?: ApiBindings["ENVIRONMENT"];
    principalKind?: "human" | "service";
  } = {},
): Promise<CanonicalCatalogRelease> {
  const row = await db
    .prepare(
      `SELECT id, manifest_json, status, purpose, environment, candidate_status
         FROM catalog_releases
        WHERE id = ?
          AND (status = 'deployed' OR
               (? = 1 AND purpose = 'private-preview' AND candidate_status = 'succeeded'
                  AND candidate_expires_at > ?
                  AND (? IS NULL OR EXISTS (
                    SELECT 1 FROM storefront_preview_builds
                     WHERE id = ? AND catalog_release_id = catalog_releases.id
                  ))) OR
               (? = 1 AND status = 'building' AND build_correlation_id LIKE 'staging-proof:%'))`,
    )
    .bind(
      releaseId,
      options.allowPrivateCandidate ? 1 : 0,
      new Date().toISOString(),
      options.privateCandidateBuildId ?? null,
      options.privateCandidateBuildId ?? null,
      options.allowStagingProof ? 1 : 0,
    )
    .first<{
      candidate_status: string | null;
      environment: ApiBindings["ENVIRONMENT"];
      id: string;
      manifest_json: string;
      purpose: "private-preview" | "public";
      status: string;
    }>();
  if (!row) {
    throw new ApiError(422, "catalog_release_unavailable", "Select a deployed Catalog Release.");
  }
  if (row.purpose === "private-preview") {
    assertCatalogReleaseLifecycle(
      { ...row, candidateStatus: row.candidate_status },
      {
        environment: options.environment ?? row.environment,
        operation: options.privateCandidateBuildId ? "private-preview-build" : "private-preview",
        ...(options.principalKind ? { principalKind: options.principalKind } : {}),
      },
    );
    const v3 = catalogReleaseV3Schema.safeParse(JSON.parse(row.manifest_json));
    if (!v3.success) {
      throw new ApiError(422, "catalog_release_invalid", "The private candidate is invalid.");
    }
    const {
      content: _content,
      environment: _environment,
      identity: _identity,
      navigation: _navigation,
      purpose: _purpose,
      routeOutput: _routeOutput,
      sourceVersionVector: _sources,
      ...core
    } = v3.data;
    return canonicalCatalogReleaseSchema.parse({ ...core, schemaVersion: 2 });
  }
  const release = parseCanonicalRelease(row);
  if (!release) {
    throw new ApiError(
      422,
      "catalog_release_invalid",
      "The deployed Catalog Release is not canonical.",
    );
  }
  return release;
}

export function storefrontDestinationsForRelease(release: CanonicalCatalogRelease) {
  return fashionStoreEditorDestinations(release);
}

export async function listStorefrontCatalogResources(
  db: D1Database,
  releaseId: string,
  input: {
    kind: "article" | "collection" | "page" | "policy" | "product";
    page: number;
    pageSize: number;
    query: string;
  },
  options: {
    environment?: ApiBindings["ENVIRONMENT"];
    principalKind?: "human" | "service";
  } = {},
) {
  const release = await getCanonicalDeployedCatalogRelease(db, releaseId, {
    allowPrivateCandidate: true,
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.principalKind ? { principalKind: options.principalKind } : {}),
  });
  const resources =
    input.kind === "product"
      ? release.products.map(({ id, name, slug }) => ({
          id,
          kind: "product" as const,
          name,
          path: `/products/${slug}`,
        }))
      : input.kind === "collection"
        ? release.collections.map(({ id, name, slug }) => ({
            id,
            kind: "collection" as const,
            name,
            path: `/collections/${slug}`,
          }))
        : storefrontDestinationsForRelease(release).filter(({ kind }) => kind === input.kind);
  const query = input.query.trim().toLocaleLowerCase("en-US");
  const filtered = resources.filter(
    (resource) =>
      !query ||
      resource.name.toLocaleLowerCase("en-US").includes(query) ||
      resource.path.toLocaleLowerCase("en-US").includes(query),
  );
  const offset = (input.page - 1) * input.pageSize;
  return {
    data: filtered.slice(offset, offset + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    total: filtered.length,
  };
}

export async function listStorefrontCatalogReleases(env: ApiBindings) {
  const rows = await env.DB.prepare(
    `SELECT id, status, manifest_json, approved_at, deployed_at
       FROM catalog_releases
      WHERE status = 'deployed'
      ORDER BY deployed_at DESC, id DESC
      LIMIT 50`,
  ).all<ReleaseRow>();

  return rows.results.flatMap((row) => {
    const release = parseCanonicalRelease(row);
    if (!release) return [];
    return [
      {
        approvedAt: row.approved_at,
        collections: release.collections.map(({ id, name, slug }) => ({
          id,
          kind: "collection" as const,
          name,
          slug,
        })),
        deployedAt: row.deployed_at,
        destinations: storefrontDestinationsForRelease(release),
        environment: env.ENVIRONMENT,
        id: row.id,
        products: release.products.map(({ id, name, slug }) => ({
          id,
          kind: "product" as const,
          name,
          slug,
        })),
        status: row.status,
      },
    ];
  });
}
