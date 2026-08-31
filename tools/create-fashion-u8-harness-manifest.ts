import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface FashionU8HarnessManifestInput {
  candidateSha: string;
  harnessSha: string;
  paths: string[];
}

export interface FashionU8HarnessManifest {
  candidateSha: string;
  contractTestDigest: string;
  files: { path: string; sha256: string }[];
  harnessSha: string;
  schemaVersion: 1;
}

type ReadBytes = (path: string) => Promise<Uint8Array>;
const SHA = /^[a-f0-9]{40}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;

export const FASHION_U8_SECURITY_SENSITIVE_PATHS = [
  ".github/workflows/accept-fashion-staging-u8.yml",
  ".github/workflows/prepare-fashion-staging-u12.yml",
  ".github/workflows/prepare-fashion-staging-u8.yml",
  ".github/workflows/preview-storefront.yml",
  ".github/workflows/provision-fashion-staging-operator.yml",
  "apps/admin/e2e/storefront-theme-preview.spec.ts",
  "apps/admin/src/pages/storefront/storefront-resource-picker.tsx",
  "apps/admin/src/pages/storefront/theme-editor-page.test.tsx",
  "apps/admin/src/pages/storefront/theme-editor-page.tsx",
  "apps/admin/src/services/storefront/api.ts",
  "apps/admin/src/shared/i18n/translations.ts",
  "apps/admin/src/test/playwright-config.test.ts",
  "apps/admin/wrangler.jsonc",
  "apps/api/src/iam/password-auth.ts",
  "apps/api/src/iam/identity-expiry.ts",
  "apps/api/src/middleware/auth.ts",
  "apps/api/src/storefront-experience/preview.ts",
  "apps/api/src/testing/fashion-staging-operator.ts",
  "apps/api/test/iam/password-auth.test.ts",
  "apps/api/test/middleware/auth-expiry.test.ts",
  "apps/api/test/storefront-experience/experience-api.test.ts",
  "apps/api/test/testing/fashion-staging-operator.test.ts",
  "apps/api/wrangler.jsonc",
  "apps/storefront/wrangler.preview.jsonc",
  "packages/db/migrations/0022_admin_identity_expiry.sql",
  "packages/db/migrations/0023_fashion_staging_operator_runs.sql",
  "packages/db/src/schema/index.ts",
  "packages/db/test/migrations.test.ts",
  "tools/create-fashion-u8-harness-manifest.test.ts",
  "tools/create-fashion-u8-harness-manifest.ts",
  "tools/cloud-runner-policy.test.ts",
  "tools/capture-fashion-staging-readiness.ts",
  "tools/bootstrap-admin.test.ts",
  "tools/bootstrap-admin.ts",
  "tools/deploy-workflow.test.ts",
  "tools/dev-admin.test.ts",
  "tools/dev-admin.ts",
  "tools/run-fashion-staging-u8.test.ts",
  "tools/run-fashion-staging-u8.ts",
  "tools/run-fashion-staging-u12.test.ts",
  "tools/run-fashion-staging-u12.ts",
  "tools/verify-fashion-u8-standing-authority.test.ts",
  "tools/verify-fashion-u8-standing-authority.ts",
  "tools/verify-fashion-cloud-authority.test.ts",
  "tools/verify-fashion-cloud-authority.ts",
  "tools/verify-environment-isolation.test.ts",
  "tools/verify-environment-isolation.ts",
  "tools/verify-fashion-staging-readiness.test.ts",
  "tools/verify-fashion-staging-readiness.ts",
  "tools/verify-github-oidc-claims.test.ts",
  "tools/verify-github-oidc-claims.ts",
  "tools/verify-staging-latency.test.ts",
  "tools/verify-staging-latency.ts",
] as const;

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(value).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createFashionU8HarnessManifest(
  input: FashionU8HarnessManifestInput,
  read: ReadBytes,
): Promise<FashionU8HarnessManifest> {
  if (!SHA.test(input.candidateSha)) throw new Error("candidateSha must be a full lowercase SHA");
  if (!SHA.test(input.harnessSha)) throw new Error("harnessSha must be a full lowercase SHA");
  if (input.candidateSha === input.harnessSha) {
    throw new Error("candidate and harness SHAs must remain separate");
  }
  const paths = [...new Set(input.paths)].sort();
  if (paths.length === 0 || paths.some((path) => !SAFE_PATH.test(path))) {
    throw new Error("paths must contain safe repository-relative files");
  }
  const files = await Promise.all(
    paths.map(async (path) => ({ path, sha256: await sha256(await read(path)) })),
  );
  const contractFiles = files.filter(({ path }) =>
    /(?:\.test\.ts|\.spec\.ts|\.github\/workflows\/)/.test(path),
  );
  if (contractFiles.length === 0) throw new Error("harness requires frozen contract files");
  const contractTestDigest = await sha256(
    new TextEncoder().encode(
      contractFiles.map(({ path, sha256: digest }) => `${path}:${digest}`).join("\n"),
    ),
  );
  return {
    candidateSha: input.candidateSha,
    contractTestDigest,
    files,
    harnessSha: input.harnessSha,
    schemaVersion: 1,
  };
}

export async function createCanonicalFashionU8HarnessManifest(
  candidateSha: string,
  harnessSha: string,
  read: ReadBytes,
): Promise<FashionU8HarnessManifest> {
  return createFashionU8HarnessManifest(
    { candidateSha, harnessSha, paths: [...FASHION_U8_SECURITY_SENSITIVE_PATHS] },
    read,
  );
}

export async function verifyFashionU8HarnessManifest(
  manifest: FashionU8HarnessManifest,
  read: ReadBytes,
): Promise<FashionU8HarnessManifest> {
  const rebuilt = await createFashionU8HarnessManifest(
    {
      candidateSha: manifest.candidateSha,
      harnessSha: manifest.harnessSha,
      paths: manifest.files.map(({ path }) => path),
    },
    read,
  );
  if (rebuilt.contractTestDigest !== manifest.contractTestDigest) {
    throw new Error("harness contract-test digest mismatch");
  }
  for (let index = 0; index < rebuilt.files.length; index += 1) {
    if (
      rebuilt.files[index]?.sha256 !== manifest.files[index]?.sha256 ||
      rebuilt.files[index]?.path !== manifest.files[index]?.path
    ) {
      throw new Error(
        `harness file digest mismatch for ${rebuilt.files[index]?.path ?? "unknown"}`,
      );
    }
  }
  return manifest;
}

if (import.meta.main) {
  const candidateSha = process.env.FASHION_U8_CANDIDATE_SHA?.trim() ?? "";
  const harnessSha = process.env.FASHION_U8_HARNESS_SHA?.trim() ?? "";
  const root = resolve(import.meta.dir, "..");
  const manifest = await createCanonicalFashionU8HarnessManifest(candidateSha, harnessSha, (path) =>
    readFile(resolve(root, path)),
  );
  console.log(JSON.stringify(manifest));
}
