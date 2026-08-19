import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

export interface DecorAcceptancePlan {
  pages: ["home"];
  steps: { command: string[]; label: string }[];
}

const STOREFRONT_ROOT = resolve(import.meta.dir, "../apps/storefront");

export function buildDecorAcceptancePlan(options: {
  page?: string;
  scope: "page" | "theme";
}): DecorAcceptancePlan {
  if (options.scope === "page" && options.page !== "home")
    throw new Error("Decor page acceptance requires --page=home");
  if (options.scope === "theme" && options.page)
    throw new Error("Decor theme acceptance does not accept --page");
  return {
    pages: ["home"],
    steps: [
      {
        command: [
          "bun",
          "test",
          "tests/decor-preview-authority.test.ts",
          "tests/decor-motion-contract.test.ts",
          "tests/theme-capture-contract.test.ts",
        ],
        label: "home/unit",
      },
      {
        command: ["bunx", "playwright", "test", "--config", "playwright.decor.config.ts"],
        label: "home/browser",
      },
    ],
  };
}

export async function runDecorAcceptancePlan(plan: DecorAcceptancePlan): Promise<void> {
  const generatedPaths = [
    resolve(STOREFRONT_ROOT, "app/generated/active-experience.ts"),
    resolve(STOREFRONT_ROOT, "app/generated/active-theme.ts"),
  ];
  const originals = await Promise.all(generatedPaths.map((path) => readFile(path)));
  try {
    for (const step of plan.steps) {
      console.log(`[decor-acceptance] ${step.label}: ${step.command.join(" ")}`);
      const child = Bun.spawn(step.command, {
        cwd: STOREFRONT_ROOT,
        env: { ...process.env, PLAYWRIGHT_FORCE_ASYNC_LOADER: "1" },
        stderr: "inherit",
        stdout: "inherit",
      });
      const exitCode = await child.exited;
      if (exitCode !== 0) throw new Error(`${step.label} failed with exit code ${exitCode}`);
    }
  } finally {
    await Promise.all(generatedPaths.map((path, index) => writeFile(path, originals[index]!)));
  }
  console.log(JSON.stringify({ pages: plan.pages }));
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
    throw new Error(`unknown Decor acceptance scope: ${values.scope}`);
  const plan = buildDecorAcceptancePlan({
    scope: values.scope,
    ...(values.page ? { page: values.page } : {}),
  });
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runDecorAcceptancePlan(plan);
}

if (import.meta.main) await main();
