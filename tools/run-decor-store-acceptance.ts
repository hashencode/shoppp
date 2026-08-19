import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { decorStorePageContracts } from "../apps/storefront/app/themes/decor-store/page-contracts";

export interface DecorStoreAcceptanceStep {
  command: string[];
  label: string;
}

export interface DecorStoreAcceptancePlan {
  pages: readonly string[];
  steps: DecorStoreAcceptanceStep[];
}

const STOREFRONT_ROOT = resolve(import.meta.dir, "../apps/storefront");
const DECOR_STORE_PAGES = decorStorePageContracts.map(({ id }) => id);

export function canonicalDecorStoreAcceptanceEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env = { ...source };
  delete env.STOREFRONT_DECOR_STORE_BASE_URL;
  delete env.STOREFRONT_DECOR_STORE_SOURCE_URL;
  delete env.STOREFRONT_PERF_BASE_URL;
  delete env.STOREFRONT_PERF_ROOT_URL;
  delete env.STOREFRONT_PERF_ROUTE;
  return env;
}

export function buildDecorStoreAcceptancePlan(options: {
  page?: string;
  scope: "page" | "theme";
}): DecorStoreAcceptancePlan {
  if (
    options.scope === "page" &&
    !DECOR_STORE_PAGES.includes(options.page as (typeof DECOR_STORE_PAGES)[number])
  )
    throw new Error(`Decor Store page acceptance requires one of: ${DECOR_STORE_PAGES.join(", ")}`);
  if (options.scope === "theme" && options.page)
    throw new Error("Decor Store theme acceptance does not accept --page");
  const pages = options.scope === "page" ? [options.page!] : [...DECOR_STORE_PAGES];
  const steps: DecorStoreAcceptanceStep[] = [
    {
      command: [
        "bun",
        "test",
        "scripts/generate-decor-store-source-fragments.test.ts",
        "scripts/generate-decor-store-page-fragments.test.ts",
        "../../tools/capture-theme-fidelity-matrix.test.ts",
        "tests/decor-store-registration.test.ts",
        "tests/decor-store-source-contract.test.ts",
        "tests/decor-store-routing.test.ts",
        "tests/decor-store-shop.test.ts",
        "tests/decor-store-product.test.ts",
        "tests/decor-store-cart-checkout-account.test.ts",
        "tests/decor-store-content-pages.test.ts",
      ],
      label: "page-suite/unit",
    },
    {
      command: [
        "bunx",
        "playwright",
        "test",
        "--config",
        "playwright.decor-store.config.ts",
        "--workers=1",
      ],
      label: "page-suite/browser",
    },
    ...pages.map((page) => ({
      command: [
        "bun",
        "../../tools/verify-theme-behavior-execution.ts",
        "--theme=decor-store",
        `--page=${page}`,
        "--report=test-results/decor-store-behavior-results.json",
      ],
      label: `${page}/behavior-evidence`,
    })),
  ];
  if (options.scope === "theme")
    steps.push({
      command: ["bun", "run", "test:perf:decor-store", "--", "--workers=1"],
      label: "page-suite/performance",
    });
  return { pages, steps };
}

async function availablePort(): Promise<number> {
  const server = Bun.serve({
    fetch: () => new Response(null, { status: 204 }),
    hostname: "127.0.0.1",
    port: 0,
  });
  const port = server.port;
  await server.stop(true);
  if (!port) throw new Error("unable to allocate a loopback Decor acceptance port");
  return port;
}

export async function runDecorStoreAcceptancePlan(plan: DecorStoreAcceptancePlan): Promise<void> {
  const implementationPort = await availablePort();
  let sourcePort = await availablePort();
  while (sourcePort === implementationPort) sourcePort = await availablePort();
  const generatedThemePath = resolve(STOREFRONT_ROOT, "app/generated/active-theme.ts");
  const originalGeneratedTheme = await readFile(generatedThemePath);
  const env = {
    ...canonicalDecorStoreAcceptanceEnvironment(process.env),
    PLAYWRIGHT_FORCE_ASYNC_LOADER: "1",
    STOREFRONT_DECOR_STORE_PORT: String(implementationPort),
    STOREFRONT_DECOR_STORE_SOURCE_PORT: String(sourcePort),
  };
  try {
    for (const step of plan.steps) {
      console.log(`[decor-store-acceptance] ${step.label}: ${step.command.join(" ")}`);
      const child = Bun.spawn(step.command, {
        cwd: STOREFRONT_ROOT,
        env,
        stderr: "inherit",
        stdout: "inherit",
      });
      const exitCode = await child.exited;
      if (exitCode !== 0) throw new Error(`${step.label} failed with exit code ${exitCode}`);
    }
  } finally {
    await writeFile(generatedThemePath, originalGeneratedTheme);
  }
  console.log(
    JSON.stringify({
      pages: plan.pages,
      ports: { implementation: implementationPort, source: sourcePort },
    }),
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean" },
      page: { type: "string" },
      scope: { default: "theme", type: "string" },
    },
    strict: true,
  });
  if (values.scope !== "page" && values.scope !== "theme")
    throw new Error(`unknown Decor Store acceptance scope: ${values.scope}`);
  const plan = buildDecorStoreAcceptancePlan({
    scope: values.scope,
    ...(values.page ? { page: values.page } : {}),
  });
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runDecorStoreAcceptancePlan(plan);
}

if (import.meta.main) await main();
