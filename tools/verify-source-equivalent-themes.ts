import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import ts from "typescript";

import {
  assertFidelityMatrixComplete,
  fidelityMatrixViewports,
  themeFidelityMatrix,
} from "../apps/storefront/e2e/support/theme-fidelity-matrix";
import {
  captureGeometryIssues,
  type CaptureGeometryBox,
} from "../apps/storefront/e2e/support/theme-capture-contract";
import {
  decorNamedStates,
  fashionNamedStates,
  namedStatePixelThreshold,
} from "../apps/storefront/e2e/support/theme-named-state-contract";

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
  themes: {
    equivalenceScope: string[];
    id: string;
    requiredContractFacets: string[];
    sourceContractPath: string;
    upstreamPath: string;
  }[];
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

interface EvidenceOptions {
  commit: string;
  maxAgeHours?: number;
  now?: Date;
  thresholds?: Pick<
    SourceEquivalencePolicy["thresholds"],
    "geometryEdgePx" | "namedStateChangedPixelRatio"
  >;
}

interface EvidenceRecord {
  capturedAt?: unknown;
  commit?: unknown;
  density?: unknown;
  difference?: { changedPixelRatio?: unknown; dimensionsMatch?: unknown };
  failures?: unknown;
  implementationUrl?: unknown;
  region?: { id?: unknown; maxChangedPixelRatio?: unknown };
  results?: {
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
const NAMED_STATES_BY_THEME = {
  decor: decorNamedStates,
  fashion: fashionNamedStates,
} as const;

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

export function validateSourceEquivalencePolicy(
  policy: SourceEquivalencePolicy,
  root = ROOT,
  now = new Date(),
): void {
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

  const themeIds = new Set<string>();
  for (const theme of policy.themes) {
    if (!SAFE_THEME_ID.test(theme.id)) errors.push(`${theme.id}: expected a lowercase theme ID`);
    if (themeIds.has(theme.id)) errors.push(`${theme.id}: duplicate theme policy`);
    themeIds.add(theme.id);
    if (theme.equivalenceScope.length === 0) errors.push(`${theme.id}: equivalence scope is empty`);
    const upstreamPath = resolve(root, theme.upstreamPath);
    if (!existsSync(upstreamPath))
      errors.push(`${theme.id}: missing required file ${theme.upstreamPath}`);
    const contractPath = resolve(root, theme.sourceContractPath);
    if (!existsSync(contractPath)) {
      errors.push(`${theme.id}: missing required file ${theme.sourceContractPath}`);
      continue;
    }
    const contract = readFileSync(contractPath, "utf8");
    const contractFacets = sourceContractFacets(contract, contractPath);
    for (const facet of theme.requiredContractFacets) {
      if (!contractFacets.has(facet))
        errors.push(`${theme.id}: missing required contract facet ${facet}`);
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
    assertFidelityMatrixComplete();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const usedWaivers = new Set<string>();
  for (const route of themeFidelityMatrix) {
    const themeId = route.id.split("-")[0]!;
    const policyTheme = policy.themes.find(({ id }) => id === themeId);
    const pageType = route.id.slice(themeId.length + 1);
    if (!policyTheme?.equivalenceScope.includes(pageType))
      errors.push(`${route.id}: route is absent from the declared equivalence scope`);
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
  const regionalCaptureSets = new Set<string>();
  if (!/^[a-f0-9]{7,40}$/.test(options.commit)) errors.push("a real commit SHA is required");
  if (records.length === 0) errors.push("no fidelity report records found");
  for (const [index, record] of records.entries()) {
    const results = Array.isArray(record.results) ? record.results : null;
    const label = results
      ? `${String(record.themeId ?? "unknown-theme")}/${String(record.state ?? "unknown-state")}`
      : `${String(record.route ?? "unknown-route")}/${String(record.region?.id ?? "unknown-region")}`;
    if (record.commit !== options.commit) errors.push(`${label}: evidence commit does not match`);
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
      const namedStateContracts =
        record.themeId === "decor" || record.themeId === "fashion"
          ? NAMED_STATES_BY_THEME[record.themeId]
          : null;
      if (!namedStateContracts) errors.push(`${label}: invalid named-state theme identity`);
      if (record.state !== `${record.themeId}-named-states`)
        errors.push(`${label}: invalid named-state suite identity`);
      const expectedSourcePath =
        record.themeId === "decor"
          ? "/demo-decor-store.html"
          : record.themeId === "fashion"
            ? "/demo-fashion-store.html"
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
            stateContract?.capture === "viewport-top" || stateContract?.id === "cookie-overlay"
              ? "viewport"
              : "document";
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
    if (route && region) regionalCaptureSets.add(`${route.id}:${region.id}`);
  }
  for (const captureSet of regionalCaptureSets) {
    const separator = captureSet.indexOf(":");
    const routeId = captureSet.slice(0, separator);
    const regionId = captureSet.slice(separator + 1);
    const route = themeFidelityMatrix.find(({ id }) => id === routeId);
    if (!route) continue;
    for (const viewportId of route.viewports) {
      for (const density of route.densities) {
        if (!identities.has(`${routeId}:${regionId}:${viewportId}:${density}`))
          errors.push(`${routeId}/${regionId}: regional capture set is incomplete`);
      }
    }
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
    },
    strict: true,
  });
  const policy = await loadSourceEquivalencePolicy();
  validateSourceEquivalencePolicy(policy);
  if (values.evidence) {
    if (!values.commit) throw new Error("--commit is required with --evidence");
    const paths = await reportFiles(resolve(ROOT, values.evidence));
    const records = await Promise.all(
      paths.map(async (path) => JSON.parse(await readFile(path, "utf8")) as EvidenceRecord),
    );
    validateFidelityEvidenceRecords(records, {
      commit: values.commit,
      ...(values["max-age-hours"] ? { maxAgeHours: Number(values["max-age-hours"]) } : {}),
      thresholds: policy.thresholds,
    });
    console.log(`Verified ${records.length} commit-bound fidelity reports.`);
  }
  console.log(`Verified source-equivalence policy for ${policy.themes.length} themes.`);
}

if (import.meta.main) await main();
