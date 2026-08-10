import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

export type FashionStoreAcceptancePageId =
  | "about"
  | "account"
  | "article"
  | "cart"
  | "checkout"
  | "collection"
  | "contact"
  | "faq"
  | "home"
  | "magazine"
  | "product"
  | "shop-left"
  | "shop-none"
  | "shop-right"
  | "wishlist";

interface FashionStorePageAcceptanceSelection {
  e2eFiles: string[];
  unitFiles: string[];
}

interface FashionStoreAcceptancePlan {
  pages: FashionStoreAcceptancePageId[];
  steps: { command: string[]; label: string }[];
}

const STOREFRONT_ROOT = resolve(import.meta.dir, "../apps/storefront");
const ALL_PAGES: FashionStoreAcceptancePageId[] = [
  "home",
  "shop-left",
  "shop-none",
  "shop-right",
  "collection",
  "product",
  "cart",
  "checkout",
  "wishlist",
  "account",
  "magazine",
  "article",
  "about",
  "faq",
  "contact",
];

const ALL_UNIT_FILES = [
  "tests/fashion-store-theme.test.ts",
  "tests/fashion-store-runtime.test.ts",
  "tests/fashion-store-shop.test.ts",
  "tests/fashion-store-collection.test.ts",
  "tests/fashion-store-product.test.ts",
  "tests/fashion-store-cart.test.ts",
  "tests/fashion-store-checkout.test.ts",
  "tests/fashion-store-content.test.ts",
  "tests/fashion-store-magazine.test.ts",
  "tests/fashion-store-information-pages.test.ts",
];

const PAGE_SELECTIONS: Record<FashionStoreAcceptancePageId, FashionStorePageAcceptanceSelection> = {
  about: {
    e2eFiles: ["e2e/fashion-store-information-pages.spec.ts"],
    unitFiles: ["tests/fashion-store-information-pages.test.ts"],
  },
  account: {
    e2eFiles: ["e2e/fashion-store-content.spec.ts"],
    unitFiles: ["tests/fashion-store-content.test.ts"],
  },
  article: {
    e2eFiles: ["e2e/fashion-store-magazine.spec.ts"],
    unitFiles: ["tests/fashion-store-magazine.test.ts"],
  },
  cart: {
    e2eFiles: ["e2e/fashion-store-cart.spec.ts"],
    unitFiles: ["tests/fashion-store-cart.test.ts"],
  },
  checkout: {
    e2eFiles: ["e2e/fashion-store-checkout.spec.ts"],
    unitFiles: ["tests/fashion-store-checkout.test.ts"],
  },
  collection: {
    e2eFiles: ["e2e/fashion-store-collection.spec.ts"],
    unitFiles: ["tests/fashion-store-collection.test.ts"],
  },
  contact: {
    e2eFiles: ["e2e/fashion-store-information-pages.spec.ts"],
    unitFiles: ["tests/fashion-store-information-pages.test.ts"],
  },
  faq: {
    e2eFiles: ["e2e/fashion-store-information-pages.spec.ts"],
    unitFiles: ["tests/fashion-store-information-pages.test.ts"],
  },
  home: {
    e2eFiles: [
      "e2e/fashion-store-acceptance-slice.spec.ts",
      "e2e/fashion-store-theme.spec.ts",
      "e2e/theme-behavior-contract.spec.ts",
    ],
    unitFiles: ["tests/fashion-store-theme.test.ts", "tests/fashion-store-runtime.test.ts"],
  },
  magazine: {
    e2eFiles: ["e2e/fashion-store-magazine.spec.ts"],
    unitFiles: ["tests/fashion-store-magazine.test.ts"],
  },
  product: {
    e2eFiles: ["e2e/fashion-store-product.spec.ts"],
    unitFiles: ["tests/fashion-store-product.test.ts"],
  },
  "shop-left": {
    e2eFiles: ["e2e/fashion-store-shop.spec.ts"],
    unitFiles: ["tests/fashion-store-shop.test.ts"],
  },
  "shop-none": {
    e2eFiles: ["e2e/fashion-store-shop.spec.ts"],
    unitFiles: ["tests/fashion-store-shop.test.ts"],
  },
  "shop-right": {
    e2eFiles: ["e2e/fashion-store-shop.spec.ts"],
    unitFiles: ["tests/fashion-store-shop.test.ts"],
  },
  wishlist: {
    e2eFiles: ["e2e/fashion-store-content.spec.ts"],
    unitFiles: ["tests/fashion-store-content.test.ts"],
  },
};

function behaviorVerificationCommand(page: FashionStoreAcceptancePageId): string[] {
  return [
    "bun",
    "../../tools/verify-theme-behavior-execution.ts",
    "--theme=fashion-store",
    `--page=${page}`,
    "--report=test-results/fashion-store-behavior-results.json",
  ];
}

export function fashionStorePageAcceptanceSelection(
  page: string,
): FashionStorePageAcceptanceSelection {
  if (!(page in PAGE_SELECTIONS)) throw new Error(`unknown Fashion Store page: ${page}`);
  return PAGE_SELECTIONS[page as FashionStoreAcceptancePageId];
}

export function buildFashionStoreAcceptancePlan(options: {
  page?: string;
  scope: "page" | "theme";
}): FashionStoreAcceptancePlan {
  if (options.scope === "page" && !options.page)
    throw new Error("page acceptance requires --page=<id>");
  if (options.scope === "theme" && options.page)
    throw new Error("theme acceptance does not accept --page");
  const pages =
    options.scope === "page" ? [options.page as FashionStoreAcceptancePageId] : ALL_PAGES;
  const selection =
    options.scope === "page" ? fashionStorePageAcceptanceSelection(pages[0]!) : undefined;
  return {
    pages,
    steps: [
      {
        command: ["bun", "test", ...(selection?.unitFiles ?? ALL_UNIT_FILES)],
        label: options.scope === "page" ? `${pages[0]}/unit` : "theme/unit",
      },
      {
        command: [
          "bunx",
          "playwright",
          "test",
          "--config",
          "playwright.fashion-store.config.ts",
          ...(selection?.e2eFiles ?? []),
        ],
        label: options.scope === "page" ? `${pages[0]}/browser` : "theme/browser",
      },
      ...pages.map((page) => ({
        command: behaviorVerificationCommand(page),
        label: `${page}/behavior-evidence`,
      })),
    ],
  };
}

async function availablePort(): Promise<number> {
  const server = Bun.serve({
    fetch: () => new Response(null, { status: 204 }),
    hostname: "127.0.0.1",
    port: 0,
  });
  const port = server.port;
  await server.stop(true);
  if (!port) throw new Error("unable to allocate a loopback acceptance port");
  return port;
}

export async function runFashionStoreAcceptancePlan(
  plan: FashionStoreAcceptancePlan,
): Promise<void> {
  const port = await availablePort();
  let sourcePort = await availablePort();
  while (sourcePort === port) sourcePort = await availablePort();
  const env = {
    ...process.env,
    PLAYWRIGHT_FORCE_ASYNC_LOADER: "1",
    STOREFRONT_FASHION_STORE_PORT: String(port),
    STOREFRONT_FASHION_STORE_SOURCE_PORT: String(sourcePort),
  };
  const generatedThemePath = resolve(STOREFRONT_ROOT, "app/generated/active-theme.ts");
  const originalGeneratedTheme = await readFile(generatedThemePath);
  try {
    for (const step of plan.steps) {
      console.log(`[fashion-store-acceptance] ${step.label}: ${step.command.join(" ")}`);
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
    JSON.stringify({ pages: plan.pages, ports: { implementation: port, source: sourcePort } }),
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
    throw new Error(`unknown Fashion Store acceptance scope: ${values.scope}`);
  const plan = buildFashionStoreAcceptancePlan({
    scope: values.scope,
    ...(values.page ? { page: values.page } : {}),
  });
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runFashionStoreAcceptancePlan(plan);
}

if (import.meta.main) await main();
