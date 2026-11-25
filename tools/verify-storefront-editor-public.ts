import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { canonicalStorefrontJson, experienceSnapshotSchema } from "../packages/contracts/src";
import {
  editorContext,
  editorDocument,
  editorRelease,
} from "../apps/storefront/tests/fixtures/editor-context";
import {
  experienceBuildInputSchema,
  renderActiveThemeModule,
} from "../apps/storefront/scripts/prepare-experience";
import { fashionStoreEditorDescriptor } from "../apps/storefront/app/themes/fashion-store/authoring/package";
import { fashionStoreSuccessorPackage } from "../apps/storefront/app/themes/fashion-store/package-registry";

const root = resolve(import.meta.dir, "../apps/storefront");
const temporary = await mkdtemp(resolve(tmpdir(), "shoppp-editor-public-"));
const paths = ["app/generated", "public"];
for (const path of paths)
  await cp(resolve(root, path), resolve(temporary, path), { recursive: true });
try {
  const templates = structuredClone(editorDocument.templates);
  templates[0]!.sections[0]!.blocks[0]!.settings.title = "Locally approved autumn";
  templates[0]!.sections = templates[0]!.sections.filter(
    (section) => section.type !== "fashion-store.services",
  );
  for (const template of templates)
    template.styles = { accent: "#123456", spacing: 24, buttonRadius: 12, font: "outfit" };
  const removed = new Set(
    editorDocument.templates[0]!.sections.filter(
      (section) => section.type === "fashion-store.services",
    ).map((section) => section.id),
  );
  if (removed.size !== 1) throw new Error('The public verification fixture requires one Services Section.');
  const snapshot = experienceSnapshotSchema.parse({
    experienceId: editorContext.draft.experienceId,
    version: 1,
    themeId: "fashion-store",
    themeVersion: "1.3.0",
    configurationSchemaVersion: 4,
    overrides: [],
    id: "snapshot-local-editor-public",
    kind: "approved",
    approvedAt: "2026-10-31T00:00:00.000Z",
    approvedBy: "local-fixture",
    resolvedTemplates: templates,
    bindings: editorDocument.bindings.filter((binding) => !removed.has(binding.instanceId)),
    platformContractVersion: "1.0.0",
    provenance: editorContext.package.manifest.provenance,
    contact: {
      version: "c".repeat(64),
      publicContact: {
        supportEmail: "help@example.test",
        privacyEmail: "privacy@example.test",
        publicPhone: null,
        serviceHours: null,
        timeZone: "UTC",
        locations: [],
        socials: [],
      },
    },
  });
  const release = { ...structuredClone(editorRelease), purpose: "public" as const };
  const catalogManifestJson = JSON.stringify(release);
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const input = experienceBuildInputSchema.parse({
    environment: "public",
    sourceEnvironment: "staging",
    publicationId: "publication-local-editor",
    expectedOrigin: release.site.origin,
    themeId: "fashion-store",
    presentationMode: "live",
    mediaOrigins: [],
    catalogRelease: release,
    catalogManifestJson,
    snapshot,
    inputIdentity: {
      catalogManifestDigest: hash(catalogManifestJson),
      catalogSourceDigest: null,
      catalogReleaseId: release.releaseId,
      contactVersion: snapshot.contact!.version,
      experienceSnapshotId: snapshot.id,
      experienceVersion: snapshot.version,
      platformContractVersion: snapshot.platformContractVersion,
      snapshotDigest: hash(canonicalStorefrontJson(snapshot)),
      themeId: snapshot.themeId,
      themeVersion: snapshot.themeVersion,
    },
  });
  if (input.environment !== "public") throw new Error("Expected an approved public input.");
  // Old exact readers remain buildable with the current selectable catalog.
  const previous = experienceSnapshotSchema.parse({
    ...snapshot,
    themeVersion: "1.2.0",
    configurationSchemaVersion: 3,
    resolvedTemplates: fashionStoreSuccessorPackage.presets[0]!.templates,
  });
  renderActiveThemeModule({
    catalog: [fashionStoreEditorDescriptor],
    moduleAllowlist: { "fashion-store": "../themes/fashion-store/successor/registry" },
    input: {
      environment: "preview",
      expectedOrigin: "https://preview.example.test",
      themeId: "fashion-store",
      snapshot: previous,
    },
  });
  const file = resolve(temporary, "public-input.json");
  await writeFile(file, JSON.stringify(input));
  const child = Bun.spawn(["bun", "run", "build"], {
    cwd: root,
    env: {
      ...process.env,
      STOREFRONT_BUILD_MODE: "public",
      STOREFRONT_EXPERIENCE_FILE: file,
      STOREFRONT_FASHION_HOME_PROFILE: "combined",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await child.exited) !== 0) throw new Error("Approved public storefront build failed.");
  const html = await readFile(resolve(root, ".output/public/index.html"), "utf8");
  for (const text of ["Locally approved autumn", "#123456", "border-radius:12px"])
    if (!html.includes(text)) throw new Error(`Approved output is missing ${text}`);
  if (
    html.includes("data-editor-instance") ||
    html.includes("editor-sessions") ||
    html.includes('data-home-section="services"')
  )
    throw new Error("Public output contains editor markers or a removed Section.");
  const marker = JSON.parse(
    await readFile(resolve(root, ".output/public/__shoppp-release.json"), "utf8"),
  );
  if (
    marker.identity.snapshotDigest !== input.inputIdentity.snapshotDigest ||
    marker.identity.themeVersion !== "1.3.0"
  )
    throw new Error("Public receipt identity changed.");
  console.log(
    JSON.stringify({
      approvedPublicBuild: true,
      savedTextStructureStyles: true,
      exactOldReader: true,
      privateEditorAbsent: true,
      exactReceipt: true,
      output: resolve(root, ".output/public"),
    }),
  );
} finally {
  for (const path of paths) {
    await rm(resolve(root, path), { recursive: true, force: true });
    await cp(resolve(temporary, path), resolve(root, path), { recursive: true });
  }
  await mkdir(resolve(temporary, "retained"), { recursive: true });
}
