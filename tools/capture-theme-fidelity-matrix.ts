import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  themeFidelityMatrix,
  type FidelityDensity,
  type FidelityMatrixViewportId,
} from "../apps/storefront/e2e/support/theme-fidelity-matrix";
import { captureModeForRegion } from "../apps/storefront/e2e/support/theme-capture-contract";

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const arguments_ = Bun.argv.slice(2);
const theme = argumentValue(arguments_, "--theme");
const phase = argumentValue(arguments_, "--phase") ?? "regional";
const routeFilter = argumentValue(arguments_, "--route");
const regionFilter = argumentValue(arguments_, "--region");
const viewportFilter = argumentValue(arguments_, "--viewport");
const densities = (argumentValue(arguments_, "--dpr") ?? "1")
  .split(",")
  .map(Number) as FidelityDensity[];
const sourceOrigin = argumentValue(arguments_, "--source-origin");
const implementationOrigin = argumentValue(arguments_, "--implementation-origin");
const outputRoot = argumentValue(arguments_, "--output");
const commit = argumentValue(arguments_, "--commit");
const artifactDigest = argumentValue(arguments_, "--artifact-digest");
const matchesTheme = (routeId: string): boolean =>
  theme === "fashion-store"
    ? routeId.startsWith("fashion-store-")
    : theme === "fashion"
      ? routeId.startsWith("fashion-") && !routeId.startsWith("fashion-store-")
      : routeId.startsWith("decor-");

if (
  !theme ||
  !["fashion", "fashion-store", "decor"].includes(theme) ||
  !["regional", "full-page"].includes(phase) ||
  !sourceOrigin ||
  !implementationOrigin ||
  !outputRoot ||
  !commit ||
  !artifactDigest ||
  densities.some((density) => density !== 1 && density !== 2)
) {
  throw new Error(
    "Usage: bun tools/capture-theme-fidelity-matrix.ts --theme=<fashion|fashion-store|decor> --phase=<regional|full-page> [--route=<id>] [--region=<id>] [--viewport=<id>] [--dpr=<1|2|1,2>] --source-origin=<url> --implementation-origin=<url> --output=<path> --commit=<sha> --artifact-digest=<sha256>",
  );
}

const tasks = themeFidelityMatrix
  .filter((route) => matchesTheme(route.id) && (!routeFilter || route.id === routeFilter))
  .flatMap((route) =>
    route.viewports
      .filter((viewport) => !viewportFilter || viewport === viewportFilter)
      .flatMap((viewport) =>
        route.densities
          .filter((density) => densities.includes(density))
          .flatMap((density) =>
            route.regions
              .filter((region) =>
                phase === "full-page"
                  ? region.kind === "full-page-smoke"
                  : region.kind !== "full-page-smoke" &&
                    (regionFilter
                      ? region.id === regionFilter
                      : !["bag", "header", "search"].includes(region.id)),
              )
              .map((region) => ({ density, region, route, viewport })),
          ),
      ),
  );

if (tasks.length === 0) {
  throw new Error(
    "No fidelity tasks matched the supplied theme, phase, route, region, viewport, and DPR filters.",
  );
}

const startedAt = new Date().toISOString();
const results: Array<{
  density: FidelityDensity;
  error?: string;
  region: string;
  route: string;
  status: "failed" | "passed";
  viewport: FidelityMatrixViewportId;
}> = [];

for (const [index, task] of tasks.entries()) {
  const label = `${task.route.id}/${task.viewport}/dpr-${task.density}/${task.region.id}`;
  process.stdout.write(`[${index + 1}/${tasks.length}] ${label}\n`);
  const child = Bun.spawn(
    [
      "bun",
      "tools/capture-theme-route-region.ts",
      `--route=${task.route.id}`,
      `--region=${task.region.id}`,
      `--mode=${captureModeForRegion(task.region.id)}`,
      `--viewport=${task.viewport}`,
      `--dpr=${task.density}`,
      `--source-origin=${sourceOrigin}`,
      `--implementation-origin=${implementationOrigin}`,
      `--output=${outputRoot}`,
      `--commit=${commit}`,
      `--artifact-digest=${artifactDigest}`,
    ],
    { stderr: "pipe", stdout: "pipe" },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (exitCode === 0) {
    results.push({
      density: task.density,
      region: task.region.id,
      route: task.route.id,
      status: "passed",
      viewport: task.viewport,
    });
  } else {
    const message = (stderr || stdout || `Capture exited with code ${exitCode}`).trim();
    results.push({
      density: task.density,
      error: message,
      region: task.region.id,
      route: task.route.id,
      status: "failed",
      viewport: task.viewport,
    });
  }
}

const summary = {
  completedAt: new Date().toISOString(),
  failed: results.filter(({ status }) => status === "failed").length,
  passed: results.filter(({ status }) => status === "passed").length,
  phase,
  results,
  startedAt,
  theme,
  ...(theme === "fashion-store"
    ? { implementationThemeId: "fashion-store", referenceThemeId: "fashion" }
    : {}),
  total: results.length,
};
await mkdir(resolve(outputRoot), { recursive: true });
await writeFile(
  resolve(
    outputRoot,
    [theme, phase, routeFilter, viewportFilter, regionFilter, `dpr-${densities.join("-")}`]
      .filter(Boolean)
      .join("-") + "-matrix-summary.json",
  ),
  `${JSON.stringify(summary, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify({ failed: summary.failed, passed: summary.passed })}\n`);
if (summary.failed > 0) process.exitCode = 1;
