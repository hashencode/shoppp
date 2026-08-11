import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import type { StorefrontThemeSourceManifest } from "./import-storefront-theme";

import { assertThemeBehaviorContractComplete } from "../apps/storefront/e2e/support/theme-behavior-contract";
import type { ThemeBehaviorDescriptor } from "../apps/storefront/e2e/support/theme-behavior-descriptor";
import { assertCustomBehaviorAdaptersRegistered } from "../apps/storefront/e2e/support/theme-behavior-runner";
import {
  assertFidelityMatrixComplete,
  fidelityMatrixViewports,
  themeFidelityMatrix,
} from "../apps/storefront/e2e/support/theme-fidelity-matrix";
import {
  captureGeometryIssues,
  captureModeForNamedState,
  captureModeForRegion,
  type CaptureGeometryBox,
} from "../apps/storefront/e2e/support/theme-capture-contract";
import { namedStatePixelThreshold } from "../apps/storefront/e2e/support/theme-named-state-contract";
import { loadThemeBehaviorDescriptor } from "./load-theme-behavior-descriptor";

export interface SourceEquivalencePolicy {
  schemaVersion: 1;
  canonicalViewports: { height: number; id: string; width: number }[];
  thresholds: {
    channelTolerance: number;
    computedStyleNumericPx: number;
    fullPageChangedPixelRatio: number;
    fullPageHeightRatio: number;
    geometryEdgePx: number;
    namedStateChangedPixelRatio: number;
  };
  resources: {
    heavyBatchDefaultWorkers: number;
    maxConcurrentBrowserWorkers: number;
    modelInspection: string;
    scriptFirst: boolean;
  };
  requiredEvidence: string[];
  sourceIntakes: SourceEquivalenceSourceIntakePolicy[];
  themes: SourceEquivalenceThemePolicy[];
  waivers: {
    approvedBy: string;
    expiresAt: string;
    id: string;
    owner: string;
    rationale: string;
    regionId: string;
    routeId: string;
    themeId: string;
  }[];
}

export interface SourceEquivalenceSourceIntakePolicy {
  acceptanceModes: string[];
  authorizedSourceRoot: string;
  canonicalViewports: { height: number; id: string; width: number }[];
  checkpoints: string[];
  contracts: {
    acceptanceAdapter: string;
    behavior: string;
    source: string;
  };
  excludedSourceResources: { path: string; reason: string }[];
  id: string;
  requiredHeroDependencies: string[];
  scriptOrder: string[];
  sourceEntry: string;
  sourceEntrySha256: string;
  sourceManifestThemeId: string;
  status: "contracts-frozen";
  stylesheetOrder: string[];
}

export interface SourceEquivalencePagePolicy {
  acceptanceAdapterExport: string;
  acceptanceAdapterPath: string;
  applicableModes: string[];
  behaviorContractExport: string;
  behaviorContractPath: string;
  focusedStates: { id: string; modes: string[] }[];
  id: string;
  implementationRoute: string;
  implementationRuntimeReadySelector: string;
  pageType: string;
  requiredContractFacets: string[];
  sourceContractPath: string;
  sourceEntry: string;
  sourceEntrySha256: string;
  sourceFirstHero: string;
  sourceRegionsExport: string;
  sourceRuntimeReadySelector: string;
}

export interface SourceEquivalenceThemePolicy {
  acceptance: {
    browserConfig: string;
    browserProject: string;
    pageCommand: string[];
    themeCommand: string[];
  };
  authorizedSourceRoot: string;
  equivalenceScope: string[];
  id: string;
  manifestExport: string;
  manifestPath: string;
  pages: SourceEquivalencePagePolicy[];
  upstreamPath: string;
}

interface EvidenceOptions {
  artifactDigest: string;
  behaviorDescriptors?: ReadonlyMap<string, ThemeBehaviorDescriptor>;
  commit: string;
  maxAgeHours?: number;
  now?: Date;
  thresholds?: Pick<
    SourceEquivalencePolicy["thresholds"],
    "geometryEdgePx" | "namedStateChangedPixelRatio"
  >;
}

interface EvidenceRecord {
  artifactDigest?: unknown;
  captureMode?: unknown;
  capturedAt?: unknown;
  commit?: unknown;
  density?: unknown;
  difference?: { changedPixelRatio?: unknown; dimensionsMatch?: unknown };
  failures?: unknown;
  implementationUrl?: unknown;
  region?: { id?: unknown; maxChangedPixelRatio?: unknown };
  results?: {
    captureMode?: unknown;
    difference?: { changedPixelRatio?: unknown; dimensionsMatch?: unknown };
    geometry?: {
      implementation?: Partial<Record<keyof CaptureGeometryBox, unknown>>;
      reference?: Partial<Record<keyof CaptureGeometryBox, unknown>>;
    };
    state?: unknown;
    viewport?: unknown;
  }[];
  route?: unknown;
  sourceUrl?: unknown;
  state?: unknown;
  themeId?: unknown;
  viewport?: { height?: unknown; id?: unknown; width?: unknown };
  viewports?: Record<string, { height?: unknown; width?: unknown }>;
}

const ROOT = resolve(import.meta.dir, "..");
const POLICY_PATH = resolve(import.meta.dir, "storefront-source-equivalence-policy.json");
const SAFE_THEME_ID = /^[a-z][a-z0-9-]*$/;
const MAX_GEOMETRY_EDGE_PX = 2;
const MAX_NAMED_STATE_CHANGED_PIXEL_RATIO = 0.005;
const REQUIRED_VIEWPORTS = [
  { height: 1000, id: "desktop", width: 1440 },
  { height: 900, id: "laptop", width: 1024 },
  { height: 1024, id: "tablet", width: 768 },
  { height: 844, id: "mobile", width: 390 },
] as const;
const REQUIRED_EVIDENCE = [
  "assets",
  "computedStyles",
  "domInventory",
  "fonts",
  "geometry",
  "interactionStates",
  "links",
  "motionStates",
  "responsiveStates",
  "runtimeDiagnostics",
  "visibleCopy",
] as const;
function assertNoErrors(errors: string[], label: string): void {
  if (errors.length > 0) throw new Error(`${label}:\n- ${errors.join("\n- ")}`);
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  )
    current = current.expression;
  return current;
}

function sourceContractFacets(contract: string, path: string): Set<string> {
  const sourceFile = ts.createSourceFile(path, contract, ts.ScriptTarget.Latest, true);
  const facets = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.name.text.endsWith("SourceContract"))
        continue;
      if (!declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) continue;
      for (const property of initializer.properties) {
        if (!property.name) continue;
        if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
          facets.add(property.name.text);
      }
    }
  }
  return facets;
}

function validUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isFidelityViewportId(value: string): value is keyof typeof fidelityMatrixViewports {
  return value in fidelityMatrixViewports;
}

function isCaptureGeometryBox(
  value: Partial<Record<keyof CaptureGeometryBox, unknown>> | undefined,
): value is CaptureGeometryBox {
  return (["height", "pageX", "pageY", "width", "x", "y"] as const).every(
    (property) => typeof value?.[property] === "number" && Number.isFinite(value[property]),
  );
}

export async function loadSourceEquivalencePolicy(root = ROOT): Promise<SourceEquivalencePolicy> {
  const path =
    root === ROOT ? POLICY_PATH : resolve(root, "tools/storefront-source-equivalence-policy.json");
  return JSON.parse(await readFile(path, "utf8")) as SourceEquivalencePolicy;
}

async function treeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Imported source symlink is prohibited: ${path}`);
      if (entry.isDirectory()) return treeFiles(path);
      if (!entry.isFile()) throw new Error(`Unsupported imported source entry: ${path}`);
      return [path];
    }),
  );
  return paths.flat();
}

export async function validateImportedSourceTree(root = ROOT): Promise<void> {
  const manifestPath = resolve(root, "tools/storefront-theme-source-manifest.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as StorefrontThemeSourceManifest;
  const declaration = manifest.themes.find(({ themeId }) => themeId === "fashion-store");
  if (!declaration) throw new Error("Fashion Store source declaration is missing.");
  const errors: string[] = [];
  if (!declaration.importedAt) errors.push("Fashion Store importedAt is missing");
  if (declaration.importedFiles.length !== declaration.allowlist.length)
    errors.push("Fashion Store imported file count does not match the allowlist");

  const themeRoot = resolve(root, "apps/storefront/app/themes/fashion-store");
  const upstreamRoot = resolve(themeRoot, "upstream");
  const expectedPaths = new Set<string>();
  for (const asset of declaration.allowlist) {
    const destinationPath = asset.destinationPath;
    if (!destinationPath.startsWith("upstream/") || destinationPath.includes("..")) {
      errors.push(`${destinationPath}: unsafe Fashion Store destination path`);
      continue;
    }
    expectedPaths.add(destinationPath);
    const imported = declaration.importedFiles.find(
      (candidate) => candidate.destinationPath === destinationPath,
    );
    if (
      !imported ||
      imported.sourcePath !== asset.sourcePath ||
      imported.kind !== asset.kind ||
      imported.sha256 !== asset.expectedSha256
    ) {
      errors.push(`${destinationPath}: imported metadata does not match the pinned declaration`);
      continue;
    }
    const path = resolve(themeRoot, destinationPath);
    if (relative(themeRoot, path).startsWith("..")) {
      errors.push(`${destinationPath}: imported path escapes the theme root`);
      continue;
    }
    try {
      const entry = await lstat(path);
      if (entry.isSymbolicLink() || !entry.isFile()) {
        errors.push(`${destinationPath}: imported output is not a regular file`);
        continue;
      }
      const contents = new Uint8Array(await readFile(path));
      const digest = new Bun.CryptoHasher("sha256").update(contents).digest("hex");
      if (digest !== asset.expectedSha256 || digest !== imported.sha256)
        errors.push(`${destinationPath}: imported hash does not match`);
      if (contents.byteLength !== imported.bytes)
        errors.push(`${destinationPath}: imported byte count does not match`);
    } catch (error) {
      errors.push(
        `${destinationPath}: imported output is missing (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  try {
    const actualPaths = (await treeFiles(upstreamRoot)).map((path) =>
      relative(themeRoot, path).split(sep).join("/"),
    );
    for (const path of actualPaths) {
      if (!expectedPaths.has(path)) errors.push(`${path}: unlisted imported output`);
    }
    for (const path of expectedPaths) {
      if (!actualPaths.includes(path))
        errors.push(`${path}: allowlisted imported output is missing`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const provenance = await readFile(resolve(themeRoot, "UPSTREAM.md"), "utf8");
    if (!provenance.includes(declaration.sourceIdentity ?? "(missing source identity)"))
      errors.push("Fashion Store provenance source identity does not match");
    if (!provenance.includes("js/main.js") || !/behavioral reference/i.test(provenance))
      errors.push("Fashion Store provenance does not document the main.js execution boundary");
    for (const { sha256 } of declaration.importedFiles) {
      if (!provenance.includes(sha256))
        errors.push(`Fashion Store provenance omits hash ${sha256}`);
    }
  } catch (error) {
    errors.push(
      `Fashion Store provenance is missing (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  assertNoErrors(errors, "Fashion Store imported source verification failed");
}

export async function validateSourceEquivalencePolicy(
  policy: SourceEquivalencePolicy,
  root = ROOT,
  now = new Date(),
): Promise<void> {
  const errors: string[] = [];
  if (policy.schemaVersion !== 1) errors.push("policy schemaVersion must be 1");
  if (
    policy.canonicalViewports.length !== REQUIRED_VIEWPORTS.length ||
    REQUIRED_VIEWPORTS.some((expected, index) => {
      const actual = policy.canonicalViewports[index];
      return (
        actual?.id !== expected.id ||
        actual.width !== expected.width ||
        actual.height !== expected.height
      );
    })
  )
    errors.push("canonical viewports must remain desktop, laptop, tablet, and mobile");
  if (
    !Number.isInteger(policy.thresholds.channelTolerance) ||
    policy.thresholds.channelTolerance < 0 ||
    policy.thresholds.channelTolerance > 16
  )
    errors.push("channel tolerance must be an integer between 0 and 16");
  if (
    !Number.isFinite(policy.thresholds.computedStyleNumericPx) ||
    policy.thresholds.computedStyleNumericPx < 0 ||
    policy.thresholds.computedStyleNumericPx > 0.5
  )
    errors.push("computed-style numeric threshold must be between 0 and 0.5px");
  if (
    !Number.isFinite(policy.thresholds.fullPageChangedPixelRatio) ||
    policy.thresholds.fullPageChangedPixelRatio < 0 ||
    policy.thresholds.fullPageChangedPixelRatio > 0.01
  )
    errors.push("full-page pixel threshold must be between 0 and 1%");
  if (
    !Number.isFinite(policy.thresholds.fullPageHeightRatio) ||
    policy.thresholds.fullPageHeightRatio < 0 ||
    policy.thresholds.fullPageHeightRatio > 0.005
  )
    errors.push("full-page height threshold must be between 0 and 0.5%");
  if (
    !Number.isFinite(policy.thresholds.geometryEdgePx) ||
    policy.thresholds.geometryEdgePx < 0 ||
    policy.thresholds.geometryEdgePx > MAX_GEOMETRY_EDGE_PX
  )
    errors.push("geometry edge threshold must be between 0 and 2px");
  if (
    !Number.isFinite(policy.thresholds.namedStateChangedPixelRatio) ||
    policy.thresholds.namedStateChangedPixelRatio < 0 ||
    policy.thresholds.namedStateChangedPixelRatio > MAX_NAMED_STATE_CHANGED_PIXEL_RATIO
  )
    errors.push("named-state pixel threshold must be between 0 and 0.5%");
  if (
    !Number.isInteger(policy.resources.maxConcurrentBrowserWorkers) ||
    policy.resources.maxConcurrentBrowserWorkers < 1 ||
    policy.resources.maxConcurrentBrowserWorkers > 2
  )
    errors.push("concurrent browser workers must be between 1 and 2");
  if (policy.resources.heavyBatchDefaultWorkers !== 1)
    errors.push("heavy batches must default to one worker");
  if (!policy.resources.scriptFirst) errors.push("visual analysis must remain script-first");
  if (policy.resources.modelInspection !== "ranked-ambiguous-crops-only")
    errors.push("model inspection must be limited to ranked ambiguous crops");
  if (
    policy.requiredEvidence.length !== REQUIRED_EVIDENCE.length ||
    REQUIRED_EVIDENCE.some((facet) => !policy.requiredEvidence.includes(facet))
  )
    errors.push("required evidence dimensions must not be removed or replaced");

  const sourceManifest = JSON.parse(
    readFileSync(resolve(root, "tools/storefront-theme-source-manifest.json"), "utf8"),
  ) as StorefrontThemeSourceManifest;
  const intakeIds = new Set<string>();
  if (!Array.isArray(policy.sourceIntakes) || policy.sourceIntakes.length === 0)
    errors.push("at least one frozen source intake is required");
  for (const intake of policy.sourceIntakes ?? []) {
    const label = intake.id || "unknown-source-intake";
    if (!SAFE_THEME_ID.test(intake.id)) errors.push(`${label}: invalid source intake ID`);
    if (intakeIds.has(intake.id)) errors.push(`${label}: duplicate source intake`);
    intakeIds.add(intake.id);
    if (intake.status !== "contracts-frozen")
      errors.push(`${label}: source intake status must be contracts-frozen`);
    if (
      intake.canonicalViewports.length !== REQUIRED_VIEWPORTS.length ||
      REQUIRED_VIEWPORTS.some((viewport, index) =>
        Object.entries(viewport).some(
          ([key, value]) =>
            intake.canonicalViewports[index]?.[key as keyof typeof viewport] !== value,
        ),
      )
    )
      errors.push(`${label}: source intake canonical viewports are incomplete`);
    if (intake.acceptanceModes.join(",") !== "static,temporal,interaction,scroll-fixed,fallback")
      errors.push(`${label}: source intake acceptance modes are incomplete or reordered`);
    if (intake.checkpoints.length !== 4)
      errors.push(`${label}: source intake must declare four review checkpoints`);
    for (const contractPath of Object.values(intake.contracts ?? {})) {
      if (!contractPath || !existsSync(resolve(root, contractPath)))
        errors.push(`${label}: source intake contract is missing (${contractPath || "unknown"})`);
    }
    const sourceRoot = resolve(root, intake.authorizedSourceRoot);
    const entryPath = resolve(sourceRoot, intake.sourceEntry);
    const entryRelative = relative(sourceRoot, entryPath);
    if (entryRelative === ".." || entryRelative.startsWith(`..${sep}`) || !existsSync(entryPath)) {
      errors.push(`${label}: source intake entry is missing or outside its root`);
    } else {
      const digest = createHash("sha256").update(readFileSync(entryPath)).digest("hex");
      if (digest !== intake.sourceEntrySha256)
        errors.push(`${label}: source intake entry digest does not match`);
    }
    const declaration = sourceManifest.themes.find(
      ({ themeId }) => themeId === intake.sourceManifestThemeId,
    );
    if (!declaration) {
      errors.push(`${label}: source manifest declaration is missing`);
    } else {
      const declaredPaths = new Set(declaration.allowlist.map(({ sourcePath }) => sourcePath));
      for (const dependency of intake.requiredHeroDependencies) {
        if (!declaredPaths.has(dependency))
          errors.push(
            `${label}: Hero dependency is absent from the source manifest (${dependency})`,
          );
      }
      if (declaration.sourceRevision !== `sha256:${intake.sourceEntrySha256}`)
        errors.push(`${label}: source manifest revision does not match policy`);
    }
    if (
      intake.scriptOrder.some((path) => /(?:main\.js|particles|https?:|\.php)/i.test(path)) ||
      intake.stylesheetOrder.some((path) => /(?:https?:|\.php)/i.test(path))
    )
      errors.push(`${label}: source intake executable order contains a forbidden resource`);
    for (const exclusion of intake.excludedSourceResources ?? []) {
      if (!exclusion.path?.trim() || !exclusion.reason?.trim())
        errors.push(`${label}: excluded source resource requires a path and reason`);
    }
  }

  const themeIds = new Set<string>();
  const policyBehaviorDescriptors: ThemeBehaviorDescriptor[] = [];
  for (const theme of policy.themes) {
    if (!SAFE_THEME_ID.test(theme.id)) errors.push(`${theme.id}: expected a lowercase theme ID`);
    if (themeIds.has(theme.id)) errors.push(`${theme.id}: duplicate theme policy`);
    themeIds.add(theme.id);
    if (theme.equivalenceScope.length === 0) errors.push(`${theme.id}: equivalence scope is empty`);
    if (!Array.isArray(theme.pages) || theme.pages.length === 0)
      errors.push(`${theme.id}: page collection is empty`);
    if (
      !theme.acceptance?.browserConfig ||
      !existsSync(resolve(root, theme.acceptance.browserConfig))
    )
      errors.push(`${theme.id}: acceptance browser config is missing`);
    if (!theme.acceptance?.browserProject?.trim())
      errors.push(`${theme.id}: acceptance browser project is missing`);
    if (
      !Array.isArray(theme.acceptance?.pageCommand) ||
      theme.acceptance.pageCommand.length === 0 ||
      !theme.acceptance.pageCommand.some((argument) => argument.includes("{page}"))
    )
      errors.push(`${theme.id}: acceptance page command must contain a {page} placeholder`);
    if (
      !Array.isArray(theme.acceptance?.themeCommand) ||
      theme.acceptance.themeCommand.length === 0
    )
      errors.push(`${theme.id}: acceptance theme command is missing`);
    const upstreamPath = resolve(root, theme.upstreamPath);
    if (!existsSync(upstreamPath))
      errors.push(`${theme.id}: missing required file ${theme.upstreamPath}`);

    let supportedPageTypes = new Set<string>();
    const manifestPath = resolve(root, theme.manifestPath);
    if (!theme.manifestPath || !existsSync(manifestPath)) {
      errors.push(`${theme.id}: theme manifest module is missing`);
    } else {
      try {
        const module = (await import(pathToFileURL(manifestPath).href)) as Record<string, unknown>;
        const manifest = module[theme.manifestExport] as
          { supportedPageTemplates?: unknown } | undefined;
        if (!manifest || !Array.isArray(manifest.supportedPageTemplates))
          errors.push(`${theme.id}: theme manifest export is invalid`);
        else supportedPageTypes = new Set(manifest.supportedPageTemplates as string[]);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const authorizedSourceRoot = resolve(root, theme.authorizedSourceRoot);
    const implementationThemeRoot = resolve(root, `apps/storefront/app/themes/${theme.id}`);
    const sourceRelativeToImplementation = relative(implementationThemeRoot, authorizedSourceRoot);
    if (
      sourceRelativeToImplementation === "" ||
      (!sourceRelativeToImplementation.startsWith(`..${sep}`) &&
        sourceRelativeToImplementation !== "..")
    )
      errors.push(
        `${theme.id}: authorized source root must be independent of implementation inputs`,
      );

    const pageIds = new Set<string>();
    const implementationRoutes = new Set<string>();
    const sourceEntries = new Map<string, string>();
    for (const page of theme.pages ?? []) {
      const label = `${theme.id}/${page.id || "unknown-page"}`;
      if (!SAFE_THEME_ID.test(page.id)) errors.push(`${label}: expected a lowercase page ID`);
      if (pageIds.has(page.id)) errors.push(`${label}: duplicate page ID`);
      pageIds.add(page.id);
      if (!page.implementationRoute?.startsWith("/"))
        errors.push(`${label}: implementation route must be root-relative`);
      if (implementationRoutes.has(page.implementationRoute))
        errors.push(`${label}: duplicate implementation route`);
      implementationRoutes.add(page.implementationRoute);
      const priorDigest = sourceEntries.get(page.sourceEntry);
      if (priorDigest && priorDigest !== page.sourceEntrySha256)
        errors.push(`${label}: conflicting source digest for ${page.sourceEntry}`);
      sourceEntries.set(page.sourceEntry, page.sourceEntrySha256);
      if (!supportedPageTypes.has(page.pageType))
        errors.push(`${label}: page type ${page.pageType} is absent from the theme manifest`);
      if (!Array.isArray(page.applicableModes) || page.applicableModes.length === 0)
        errors.push(`${label}: applicable acceptance modes are missing`);
      if (!Array.isArray(page.focusedStates) || page.focusedStates.length === 0)
        errors.push(`${label}: focused acceptance states are missing`);
      for (const state of page.focusedStates ?? []) {
        if (!state.id?.trim() || !Array.isArray(state.modes) || state.modes.length === 0)
          errors.push(`${label}: focused state without an acceptance mode`);
        for (const mode of state.modes ?? []) {
          if (!page.applicableModes.includes(mode))
            errors.push(`${label}/${state.id}: focused mode ${mode} is not applicable`);
        }
      }
      if (!page.acceptanceAdapterPath || !existsSync(resolve(root, page.acceptanceAdapterPath)))
        errors.push(`${label}: acceptance adapter module is missing`);
      const contractPath = resolve(root, page.sourceContractPath);
      if (!existsSync(contractPath)) {
        errors.push(`${label}: missing required file ${page.sourceContractPath}`);
      } else {
        const contract = readFileSync(contractPath, "utf8");
        const contractFacets = sourceContractFacets(contract, contractPath);
        for (const facet of page.requiredContractFacets) {
          if (!contractFacets.has(facet))
            errors.push(`${label}: missing required contract facet ${facet}`);
        }
      }
      const behaviorPath = resolve(root, page.behaviorContractPath);
      if (!existsSync(behaviorPath))
        errors.push(`${label}: missing required file ${page.behaviorContractPath}`);
      try {
        const descriptor = await loadThemeBehaviorDescriptor(page, root);
        policyBehaviorDescriptors.push(descriptor);
        if (descriptor.contract.themeId !== theme.id)
          errors.push(`${label}: behavior contract theme identity does not match policy`);
        if (descriptor.contract.routeId !== `${theme.id}-${page.id}`)
          errors.push(`${label}: behavior contract route identity does not match policy`);
        assertThemeBehaviorContractComplete(descriptor.contract, descriptor.structuralRegionIds);
        assertCustomBehaviorAdaptersRegistered(descriptor.contract, descriptor.adapters);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      const sourceEntryPath = resolve(authorizedSourceRoot, page.sourceEntry);
      const sourceEntryRelative = relative(authorizedSourceRoot, sourceEntryPath);
      let sourceEntrySafe =
        sourceEntryRelative !== ".." &&
        !sourceEntryRelative.startsWith(`..${sep}`) &&
        existsSync(sourceEntryPath);
      if (sourceEntrySafe) {
        try {
          const realSourceRoot = realpathSync(authorizedSourceRoot);
          const realEntryPath = realpathSync(sourceEntryPath);
          const realEntryRelative = relative(realSourceRoot, realEntryPath);
          sourceEntrySafe =
            !lstatSync(sourceEntryPath).isSymbolicLink() &&
            realEntryRelative !== ".." &&
            !realEntryRelative.startsWith(`..${sep}`);
        } catch {
          sourceEntrySafe = false;
        }
      }
      if (!sourceEntrySafe) {
        errors.push(`${label}: authorized source entry is missing or outside its root`);
      } else {
        const digest = createHash("sha256").update(readFileSync(sourceEntryPath)).digest("hex");
        if (digest !== page.sourceEntrySha256)
          errors.push(`${label}: authorized source entry digest does not match policy`);
      }
    }
    for (const pageId of theme.equivalenceScope) {
      if (!pageIds.has(pageId)) errors.push(`${theme.id}: scope references unknown page ${pageId}`);
    }
    for (const pageId of pageIds) {
      if (!theme.equivalenceScope.includes(pageId))
        errors.push(`${theme.id}/${pageId}: page is absent from the declared equivalence scope`);
    }
  }

  const waiverIds = new Set<string>();
  for (const waiver of policy.waivers) {
    if (!waiver.id || waiverIds.has(waiver.id)) errors.push(`${waiver.id}: duplicate waiver ID`);
    waiverIds.add(waiver.id);
    if (!themeIds.has(waiver.themeId)) errors.push(`${waiver.id}: unknown waiver theme`);
    if (!waiver.owner.trim()) errors.push(`${waiver.id}: owner is required`);
    if (!waiver.approvedBy.trim()) errors.push(`${waiver.id}: approvedBy is required`);
    if (!waiver.rationale.trim()) errors.push(`${waiver.id}: rationale is required`);
    const expiry = new Date(waiver.expiresAt);
    if (Number.isNaN(expiry.valueOf()) || expiry <= now)
      errors.push(`${waiver.id}: waiver is expired or has an invalid expiresAt`);
  }

  try {
    assertFidelityMatrixComplete(themeFidelityMatrix, policyBehaviorDescriptors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const pagePoliciesByRoute = new Map<
    string,
    { page: SourceEquivalencePagePolicy; theme: SourceEquivalenceThemePolicy }
  >(
    policy.themes.flatMap((theme) =>
      theme.pages.map((page) => [`${theme.id}-${page.id}`, { page, theme }] as const),
    ),
  );
  for (const routeId of pagePoliciesByRoute.keys()) {
    if (!themeFidelityMatrix.some(({ id }) => id === routeId))
      errors.push(`${routeId}: registered page is absent from the fidelity matrix`);
  }
  const usedWaivers = new Set<string>();
  for (const route of themeFidelityMatrix) {
    const policyPage = pagePoliciesByRoute.get(route.id);
    const themeId = policyPage?.theme.id ?? route.id.split("-")[0]!;
    if (!policyPage) {
      errors.push(`${route.id}: route is absent from the declared page collection`);
    } else {
      if (route.sourcePath !== `/${policyPage.page.sourceEntry}`)
        errors.push(`${route.id}: source path does not match page policy`);
      if (route.implementationPath !== policyPage.page.implementationRoute)
        errors.push(`${route.id}: implementation path does not match page policy`);
    }
    for (const region of route.regions) {
      if (!region.styleEquivalences) continue;
      if (!region.waiverId) {
        errors.push(`${route.id}/${region.id}: intentional style difference requires a waiverId`);
        continue;
      }
      usedWaivers.add(region.waiverId);
      const waiver = policy.waivers.find(({ id }) => id === region.waiverId);
      if (!waiver) errors.push(`${route.id}/${region.id}: unknown waiver ${region.waiverId}`);
      else if (
        waiver.themeId !== themeId ||
        waiver.routeId !== route.id ||
        waiver.regionId !== region.id
      )
        errors.push(`${region.waiverId}: waiver target does not match ${route.id}/${region.id}`);
    }
  }
  for (const waiver of policy.waivers) {
    if (!usedWaivers.has(waiver.id)) errors.push(`${waiver.id}: waiver is not used by the matrix`);
  }
  assertNoErrors(errors, "source-equivalence policy failed");
}

export function validateFidelityEvidenceRecords(
  records: readonly EvidenceRecord[],
  options: EvidenceOptions,
): void {
  const errors: string[] = [];
  const now = options.now ?? new Date();
  const maxAgeHours = options.maxAgeHours ?? 48;
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0)
    errors.push("evidence age window must be a positive finite number");
  const maximumAgeMs = maxAgeHours * 60 * 60 * 1000;
  const geometryThreshold = options.thresholds?.geometryEdgePx ?? MAX_GEOMETRY_EDGE_PX;
  const namedStatePixelLimit =
    options.thresholds?.namedStateChangedPixelRatio ?? MAX_NAMED_STATE_CHANGED_PIXEL_RATIO;
  const identities = new Set<string>();
  if (!/^[a-f0-9]{64}$/.test(options.artifactDigest))
    errors.push("a SHA-256 artifact digest is required");
  if (!/^[a-f0-9]{7,40}$/.test(options.commit)) errors.push("a real commit SHA is required");
  if (records.length === 0) errors.push("no fidelity report records found");
  for (const [index, record] of records.entries()) {
    const results = Array.isArray(record.results) ? record.results : null;
    const label = results
      ? `${String(record.themeId ?? "unknown-theme")}/${String(record.state ?? "unknown-state")}`
      : `${String(record.route ?? "unknown-route")}/${String(record.region?.id ?? "unknown-region")}`;
    if (record.commit !== options.commit) errors.push(`${label}: evidence commit does not match`);
    if (record.artifactDigest !== options.artifactDigest)
      errors.push(`${label}: evidence artifact digest does not match the frozen RC`);
    const capturedAt = typeof record.capturedAt === "string" ? new Date(record.capturedAt) : null;
    if (!capturedAt || Number.isNaN(capturedAt.valueOf()))
      errors.push(`${label}: invalid capturedAt`);
    else if (capturedAt > now) errors.push(`${label}: evidence was captured in the future`);
    else if (now.valueOf() - capturedAt.valueOf() > maximumAgeMs)
      errors.push(`${label}: evidence is stale`);
    if (!Array.isArray(record.failures) || record.failures.length > 0)
      errors.push(`${label}: evidence contains failures`);
    const source = validUrl(record.sourceUrl);
    const implementation = validUrl(record.implementationUrl);
    if (!source || !implementation) errors.push(`${label}: invalid source or implementation URL`);
    else if (source.origin === implementation.origin)
      errors.push(`${label}: source and implementation must use distinct origins`);
    if (results) {
      const descriptor = options.behaviorDescriptors?.get(String(record.themeId));
      const namedStateContracts = descriptor?.namedStates ?? null;
      if (!namedStateContracts) errors.push(`${label}: invalid named-state theme identity`);
      if (record.state !== `${record.themeId}-named-states`)
        errors.push(`${label}: invalid named-state suite identity`);
      const expectedSourcePath = descriptor
        ? (themeFidelityMatrix.find(({ id }) => id === descriptor.contract.routeId)?.sourcePath ??
          null)
        : null;
      if (source && source.pathname !== expectedSourcePath)
        errors.push(`${label}: source URL does not match the named-state contract`);
      if (
        !record.viewports ||
        Object.keys(record.viewports).length !== REQUIRED_VIEWPORTS.length ||
        REQUIRED_VIEWPORTS.some((viewport) => {
          const actual = record.viewports?.[viewport.id];
          return actual?.width !== viewport.width || actual.height !== viewport.height;
        })
      )
        errors.push(`${label}: named-state viewports do not match the canonical matrix`);
      if (results.length === 0) errors.push(`${label}: named-state results are empty`);
      const resultIdentities = new Set<string>();
      for (const result of results) {
        const resultLabel = `${label}/${String(result.viewport)}/${String(result.state)}`;
        const stateId =
          typeof result.state === "string" && SAFE_THEME_ID.test(result.state)
            ? result.state
            : null;
        const viewportId =
          typeof result.viewport === "string" &&
          REQUIRED_VIEWPORTS.some(({ id }) => id === result.viewport)
            ? result.viewport
            : null;
        if (!stateId) errors.push(`${resultLabel}: invalid named-state identity`);
        if (!viewportId) errors.push(`${resultLabel}: invalid named-state viewport`);
        const stateContract = namedStateContracts?.find(({ id }) => id === stateId);
        if (stateId && !stateContract)
          errors.push(`${resultLabel}: state is absent from the named-state contract`);
        if (stateContract && result.captureMode !== captureModeForNamedState(stateContract))
          errors.push(`${resultLabel}: capture mode does not match the named-state contract`);
        if (stateContract && viewportId) {
          const resultIdentity = `${stateId}:${viewportId}`;
          if (resultIdentities.has(resultIdentity))
            errors.push(`${resultLabel}: duplicate named-state result`);
          resultIdentities.add(resultIdentity);
        }
        const statePixelThreshold = stateContract
          ? Math.min(namedStatePixelThreshold(stateContract), namedStatePixelLimit)
          : namedStatePixelLimit;
        if (
          result.difference?.dimensionsMatch !== true ||
          !Number.isFinite(result.difference.changedPixelRatio) ||
          Number(result.difference.changedPixelRatio) < 0 ||
          Number(result.difference.changedPixelRatio) > statePixelThreshold
        )
          errors.push(`${resultLabel}: named-state pixel threshold failed`);
        const reference = result.geometry?.reference;
        const implementationGeometry = result.geometry?.implementation;
        if (!isCaptureGeometryBox(reference) || !isCaptureGeometryBox(implementationGeometry)) {
          errors.push(`${resultLabel}: named-state geometry evidence is missing`);
        } else {
          const geometrySpace =
            stateContract?.geometrySpace ??
            (stateContract?.capture === "viewport-top" || stateContract?.id === "cookie-overlay"
              ? "viewport"
              : "document");
          errors.push(
            ...captureGeometryIssues(
              resultLabel,
              reference,
              implementationGeometry,
              geometrySpace,
              geometryThreshold,
            ),
          );
        }
      }
      for (const { id: stateId } of namedStateContracts ?? []) {
        for (const { id: viewportId } of REQUIRED_VIEWPORTS) {
          if (!resultIdentities.has(`${stateId}:${viewportId}`))
            errors.push(`${label}/${stateId}: named-state matrix is incomplete`);
        }
      }
      const identity = `${record.themeId}:${record.state}`;
      if (identities.has(identity)) errors.push(`${label}: duplicate aggregate identity`);
      identities.add(identity);
      continue;
    }
    if (record.density !== 1 && record.density !== 2) errors.push(`${label}: invalid DPR density`);
    const route =
      typeof record.route === "string"
        ? themeFidelityMatrix.find(({ id }) => id === record.route)
        : undefined;
    const region =
      route && typeof record.region?.id === "string"
        ? route.regions.find(({ id }) => id === record.region?.id)
        : undefined;
    if (!route) errors.push(`${label}: route is absent from the fidelity matrix`);
    if (!region) errors.push(`${label}: region is absent from the fidelity matrix`);
    if (region && record.captureMode !== captureModeForRegion(region.id))
      errors.push(`${label}: capture mode does not match the region contract`);
    if (source && route && source.pathname !== route.sourcePath)
      errors.push(`${label}: source URL does not match the fidelity matrix`);
    const viewportId =
      record.viewport && typeof record.viewport.id === "string" ? record.viewport.id : null;
    const expectedViewport =
      viewportId &&
      isFidelityViewportId(viewportId) &&
      route?.viewports.some((candidate) => candidate === viewportId)
        ? fidelityMatrixViewports[viewportId]
        : undefined;
    if (
      !expectedViewport ||
      record.viewport?.width !== expectedViewport.width ||
      record.viewport.height !== expectedViewport.height
    )
      errors.push(`${label}: incomplete viewport identity`);
    if (route && !route.densities.some((candidate) => candidate === record.density))
      errors.push(`${label}: density is absent from the fidelity matrix`);
    if (region && record.region?.maxChangedPixelRatio !== region.maxChangedPixelRatio)
      errors.push(`${label}: self-reported pixel threshold does not match the fidelity matrix`);
    if (record.difference?.dimensionsMatch !== true)
      errors.push(`${label}: screenshot dimensions do not match`);
    if (
      !Number.isFinite(record.difference?.changedPixelRatio) ||
      Number(record.difference?.changedPixelRatio) < 0 ||
      !region ||
      Number(record.difference?.changedPixelRatio) > region.maxChangedPixelRatio
    )
      errors.push(`${label}: pixel threshold failed`);
    const identity = [record.route, record.region?.id, record.viewport?.id, record.density].join(
      ":",
    );
    if (identities.has(identity))
      errors.push(`${label}: duplicate capture identity at record ${index}`);
    identities.add(identity);
  }
  const requiredRouteIds = options.behaviorDescriptors
    ? new Set([...options.behaviorDescriptors.values()].map(({ contract }) => contract.routeId))
    : new Set(themeFidelityMatrix.map(({ id }) => id));
  for (const route of themeFidelityMatrix) {
    if (!requiredRouteIds.has(route.id)) continue;
    for (const region of route.regions) {
      for (const viewportId of route.viewports) {
        for (const density of route.densities) {
          if (!identities.has(`${route.id}:${region.id}:${viewportId}:${density}`))
            errors.push(`${route.id}/${region.id}: regional capture set is incomplete`);
        }
      }
    }
  }
  for (const [themeId, descriptor] of options.behaviorDescriptors ?? []) {
    if (descriptor.namedStates.length > 0 && !identities.has(`${themeId}:${themeId}-named-states`))
      errors.push(`${themeId}: named-state aggregate evidence is missing`);
  }
  assertNoErrors(errors, "fidelity evidence failed");
}

async function reportFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return reportFiles(path);
      return entry.name === "report.json" ? [path] : [];
    }),
  );
  return files.flat();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      commit: { type: "string" },
      evidence: { type: "string" },
      "max-age-hours": { type: "string" },
      "rc-manifest": { type: "string" },
    },
    strict: true,
  });
  const policy = await loadSourceEquivalencePolicy();
  await validateImportedSourceTree();
  const behaviorDescriptors = new Map(
    await Promise.all(
      policy.themes.flatMap((theme) =>
        theme.pages.map(
          async (page) =>
            [
              page.id === "home" ? theme.id : `${theme.id}/${page.id}`,
              await loadThemeBehaviorDescriptor(page, ROOT),
            ] as const,
        ),
      ),
    ),
  );
  await validateSourceEquivalencePolicy(policy);
  if (values.evidence) {
    if (!values.commit) throw new Error("--commit is required with --evidence");
    if (!values["rc-manifest"]) throw new Error("--rc-manifest is required with --evidence");
    const rcManifest = JSON.parse(await readFile(resolve(ROOT, values["rc-manifest"]), "utf8")) as {
      artifact?: { digest?: unknown };
    };
    if (typeof rcManifest.artifact?.digest !== "string")
      throw new Error("RC manifest artifact digest is missing");
    const paths = await reportFiles(resolve(ROOT, values.evidence));
    const records = await Promise.all(
      paths.map(async (path) => JSON.parse(await readFile(path, "utf8")) as EvidenceRecord),
    );
    validateFidelityEvidenceRecords(records, {
      artifactDigest: rcManifest.artifact.digest,
      commit: values.commit,
      ...(values["max-age-hours"] ? { maxAgeHours: Number(values["max-age-hours"]) } : {}),
      behaviorDescriptors,
      thresholds: policy.thresholds,
    });
    console.log(`Verified ${records.length} commit-bound fidelity reports.`);
  }
  console.log(`Verified source-equivalence policy for ${policy.themes.length} themes.`);
}

if (import.meta.main) await main();
