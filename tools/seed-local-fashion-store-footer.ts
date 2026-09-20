import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { canonicalCatalogReleaseSchema, experienceSnapshotSchema } from "../packages/contracts/src";

import { storefrontThemeCatalog } from "../apps/storefront/app/generated/theme-catalog";
import { composeExperienceShell } from "../apps/storefront/app/theme-engine/composer";
import { fashionStoreCompositionAdapter } from "../apps/storefront/app/themes/fashion-store/composition";
import { fashionStoreManifest } from "../apps/storefront/app/themes/fashion-store/successor/manifest";
import { fashionStoreSectionComposition } from "../apps/storefront/app/themes/fashion-store/successor/composition";
import { fashionStorePreset } from "../apps/storefront/app/themes/fashion-store/successor/presets/source-parity";
import {
  experienceBuildInputSchema,
  renderActiveExperienceModule,
  renderActiveThemeModule,
} from "../apps/storefront/scripts/prepare-experience";

const root = join(import.meta.dir, "..");
const localD1Directory = join(root, "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const databases = readdirSync(localD1Directory).filter(
  (name) => name.endsWith(".sqlite") && name !== "metadata.sqlite",
);
if (databases.length !== 1) {
  throw new Error(
    "Expected exactly one migrated local API D1 database; run local migrations first.",
  );
}

const db = new Database(join(localD1Directory, databases[0]!));
db.exec("PRAGMA foreign_keys = ON");
const release = canonicalCatalogReleaseSchema.parse(
  JSON.parse(readFileSync(join(root, "apps/storefront/fixtures/release.json"), "utf8")),
);
const at = new Date().toISOString();
const actorId = "admin-local-fashion-footer-demo";
const draftId = "draft-fashion-store-local-footer-demo-v2";
const validationId = "validation-fashion-store-local-footer-demo-v2";
const snapshotId = "snapshot-fashion-store-local-footer-demo-v2";
const experienceId = "experience-fashion-store-local-footer-demo";
const collection = release.collections.find(({ status }) => status === "published");
if (!collection) throw new Error("The local demo release has no published collection.");
const bindings = [
  {
    id: "local-footer-demo-home-collection",
    instanceId: "fashion-store-home",
    kind: "catalog",
    reference: { id: collection.id, kind: "collection" },
    settingId: "featured-collection",
  },
  {
    id: "local-footer-demo-default-collection",
    instanceId: "fashion-store-collection",
    kind: "catalog",
    reference: { id: collection.id, kind: "collection" },
    settingId: "default-collection",
  },
];
const templates = fashionStorePreset.templates.map((template) =>
  template.pageType === "home"
    ? {
        ...template,
        sections: template.sections.map((section) =>
          section.id === "fashion-store-home"
            ? {
                ...section,
                settings: {
                  ...section.settings,
                  "footer-contact-copy": "Demo contact: hello@example.com",
                  "footer-legal-link": {
                    label: "Privacy policy",
                    target: {
                      kind: "internal",
                      reference: { id: "policy.privacy", kind: "policy" },
                    },
                    targetBehavior: "same-window",
                  },
                  "footer-social-link": {
                    label: "Demo community",
                    target: { kind: "external", url: "https://example.com" },
                    targetBehavior: "new-window",
                  },
                },
              }
            : section,
        ),
      }
    : template,
);
const snapshot = experienceSnapshotSchema.parse({
  approvedAt: at,
  approvedBy: actorId,
  bindings,
  configurationSchemaVersion: fashionStoreManifest.configurationSchemaVersion,
  experienceId,
  id: snapshotId,
  kind: "approved",
  overrides: [],
  platformContractVersion: fashionStoreManifest.platformContractVersion,
  provenance: fashionStoreManifest.provenance,
  resolvedTemplates: templates,
  themeId: fashionStoreManifest.id,
  themeVersion: fashionStoreManifest.themeVersion,
  version: 1,
});

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertFooterPresentation(persisted: typeof snapshot): void {
  const shell = composeExperienceShell({
    adapter: fashionStoreCompositionAdapter,
    experience: persisted,
    release,
    sectionComposition: fashionStoreSectionComposition,
  });
  if (
    shell?.footer.contactCopy !== "Demo contact: hello@example.com" ||
    shell.footer.legalLink?.href !== "/policies/privacy" ||
    shell.footer.socialLink?.href !== "https://example.com"
  ) {
    throw new Error("The local demo snapshot did not resolve to the expected footer presentation.");
  }
}

function writeLocalPreviewInput(persisted: typeof snapshot): string {
  const output = join(
    root,
    "apps/storefront/fixtures/experience/.generated/fashion-store-local-footer-demo-input.json",
  );
  const input = experienceBuildInputSchema.parse({
    catalogRelease: release,
    environment: "preview",
    expectedOrigin: "https://preview.example.test",
    inputIdentity: {
      catalogReleaseId: release.releaseId,
      experienceSnapshotId: persisted.id,
      experienceVersion: persisted.version,
      platformContractVersion: persisted.platformContractVersion,
      themeId: persisted.themeId,
      themeVersion: persisted.themeVersion,
    },
    mediaOrigins: [],
    presentationMode: "live",
    snapshot: persisted,
    themeId: persisted.themeId,
  });
  renderActiveThemeModule({
    catalog: storefrontThemeCatalog,
    input,
    moduleAllowlist: { "fashion-store": "../themes/fashion-store/successor/registry" },
  });
  renderActiveExperienceModule(input);
  mkdirSync(join(root, "apps/storefront/fixtures/experience/.generated"), { recursive: true });
  writeFileSync(output, `${JSON.stringify(input, null, 2)}\n`);
  return output;
}

const contentDigest = createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
const existing = db
  .query("SELECT snapshot_json FROM storefront_experience_snapshots WHERE id = ?")
  .get(snapshotId) as { snapshot_json: string } | null;
if (existing) {
  const persisted = experienceSnapshotSchema.parse(JSON.parse(existing.snapshot_json));
  const persistedSettings = persisted.resolvedTemplates
    .find((template) => template.pageType === "home")
    ?.sections.find((section) => section.id === "fashion-store-home")?.settings;
  const expectedSettings = snapshot.resolvedTemplates
    .find((template) => template.pageType === "home")
    ?.sections.find((section) => section.id === "fashion-store-home")?.settings;
  if (
    !persistedSettings ||
    !expectedSettings ||
    canonicalJson(persistedSettings) !== canonicalJson(expectedSettings) ||
    canonicalJson(persisted.bindings) !== canonicalJson(snapshot.bindings)
  ) {
    throw new Error(
      "The local demo snapshot exists with different footer data; immutable data was not changed.",
    );
  }
  assertFooterPresentation(persisted);
  const previewInput = writeLocalPreviewInput(persisted);
  console.log(`Local demo snapshot already present: ${snapshotId}`);
  console.log(`Local live preview input: ${previewInput}`);
  db.close();
  process.exit(0);
}

db.transaction(() => {
  db.query(
    `INSERT OR IGNORE INTO admin_identities
       (id, principal_kind, access_subject, display_name, role_id, enabled, created_at, updated_at)
     VALUES (?, 'service', ?, ?, 'role_admin', 1, ?, ?)`,
  ).run(actorId, actorId, "Local footer demo operator", at, at);
  db.query(
    `INSERT OR IGNORE INTO catalog_releases
       (id, status, manifest_json, approved_by, approved_at, created_at, updated_at)
     VALUES (?, 'approved', ?, ?, ?, ?, ?)`,
  ).run(release.releaseId, JSON.stringify(release), actorId, at, at, at);
  db.query(
    `INSERT INTO storefront_experience_drafts
       (id, experience_id, theme_id, theme_version, configuration_schema_version,
        preset_id, bindings_json, overrides_json, version, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?, ?, ?)`,
  ).run(
    draftId,
    experienceId,
    snapshot.themeId,
    snapshot.themeVersion,
    snapshot.configurationSchemaVersion,
    fashionStorePreset.id,
    JSON.stringify(bindings),
    actorId,
    actorId,
    at,
    at,
  );
  db.query(
    `INSERT INTO storefront_experience_validations
       (id, draft_id, draft_version, catalog_release_id, status, issues_json,
        resolved_templates_json, validated_by, created_at)
     VALUES (?, ?, 1, ?, 'valid', '[]', ?, ?, ?)`,
  ).run(validationId, draftId, release.releaseId, JSON.stringify(templates), actorId, at);
  db.query(
    `INSERT INTO storefront_experience_snapshots
       (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
        source_validation_id, migration_id, kind, theme_id, theme_version,
        configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
        approved_at, created_at)
     VALUES (?, ?, ?, ?, 1, ?, NULL, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    snapshotId,
    `local-footer-demo:${release.releaseId}:v2`,
    experienceId,
    draftId,
    validationId,
    snapshot.themeId,
    snapshot.themeVersion,
    snapshot.configurationSchemaVersion,
    JSON.stringify(snapshot),
    contentDigest,
    actorId,
    actorId,
    at,
    at,
  );
})();

const stored = db
  .query("SELECT snapshot_json FROM storefront_experience_snapshots WHERE id = ?")
  .get(snapshotId) as { snapshot_json: string } | null;
if (!stored) throw new Error("Local footer demo snapshot was not persisted.");
const persisted = experienceSnapshotSchema.parse(JSON.parse(stored.snapshot_json));
assertFooterPresentation(persisted);
const previewInput = writeLocalPreviewInput(persisted);
console.log(`Inserted local footer demo snapshot: ${snapshotId}`);
console.log(`Local live preview input: ${previewInput}`);
db.close();
