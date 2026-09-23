import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

type FashionStoreAcceptanceStage = "all" | "behavior" | "browser" | "integrated" | "unit";

const STOREFRONT_ROOT = resolve(import.meta.dir, "../apps/storefront");
const U9_EXACT_BUILD_INPUT = resolve(
  STOREFRONT_ROOT,
  "test-results/u9-exact-tuple-build-input.json",
);
const U9_EXACT_RECEIPT = resolve(STOREFRONT_ROOT, "test-results/u9-exact-tuple-receipt.json");
const U9_EXACT_RELEASE = resolve(STOREFRONT_ROOT, "test-results/u9-exact-tuple-release.json");
const U9_EXACT_ARTIFACT = resolve(STOREFRONT_ROOT, "test-results/u9-exact-tuple-artifact.json");
const GENERATED_STATE_FILES = [
  resolve(STOREFRONT_ROOT, "app/generated/active-theme.ts"),
  resolve(STOREFRONT_ROOT, "app/generated/active-experience.ts"),
];
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

const INTEGRATED_STEPS = [
  {
    command: [
      "bun",
      "run",
      "--cwd",
      "../admin",
      "test:e2e",
      "--",
      "e2e/setup-guide.spec.ts",
      "e2e/storefront-theme-preview.spec.ts",
    ],
    label: "admin/exact-draft-preview",
  },
  {
    command: [
      "bun",
      "run",
      "--cwd",
      "../api",
      "test:workers",
      "--",
      "--disableConsoleIntercept",
      "test/catalog/candidate-release.test.ts",
      "-t",
      "propagates one sparse Admin tuple",
    ],
    label: "control-plane/exact-tuple-receipt",
  },
  {
    command: ["bunx", "playwright", "test", "--config", "playwright.u9-exact-tuple.config.ts"],
    label: "theme/exact-tuple-build-browser",
  },
  {
    command: [
      "bun",
      "run",
      "--cwd",
      "../api",
      "test:workers",
      "--",
      "test/catalog/candidate-release.test.ts",
      "test/storefront-experience/experience-api.test.ts",
    ],
    label: "control-plane/lifecycle-regressions",
  },
  {
    command: [
      "bun",
      "test",
      "tests/fashion-store-package-registry.test.ts",
      "--test-name-pattern",
      "retains the supported|isolates the successor|freezes the exact|freezes the supported|rejects every tuple|removes legacy|migrates v1|moves legacy|shares exact component",
    ],
    label: "theme/reader-matrix",
  },
  {
    command: [
      "bun",
      "test",
      "tests/fashion-store-runtime.test.ts",
      "tests/fashion-store-collection.test.ts",
      "tests/fashion-store-product.test.ts",
      "tests/fashion-store-content.test.ts",
      "tests/fashion-store-information-pages.test.ts",
    ],
    label: "theme/generated-output",
  },
  {
    command: [
      "bunx",
      "playwright",
      "test",
      "--config",
      "playwright.fashion-store-authored-hero.config.ts",
    ],
    label: "theme/authored-hero-browser",
  },
] as const;

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
      "e2e/fashion-store-decor-hero.spec.ts",
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

export function fashionStoreGeneratedStateFiles(): string[] {
  return [...GENERATED_STATE_FILES];
}

export function buildFashionStoreAcceptancePlan(options: {
  page?: string;
  scope: "page" | "theme";
  stage?: FashionStoreAcceptanceStage;
}): FashionStoreAcceptancePlan {
  if (options.scope === "page" && !options.page)
    throw new Error("page acceptance requires --page=<id>");
  if (options.scope === "theme" && options.page)
    throw new Error("theme acceptance does not accept --page");
  if (options.scope === "page" && options.stage === "integrated")
    throw new Error("integrated acceptance requires --scope=theme");
  const pages =
    options.scope === "page" ? [options.page as FashionStoreAcceptancePageId] : ALL_PAGES;
  const selection =
    options.scope === "page" ? fashionStorePageAcceptanceSelection(pages[0]!) : undefined;
  const unitStep = {
    command: ["bun", "test", ...(selection?.unitFiles ?? ALL_UNIT_FILES)],
    label: options.scope === "page" ? `${pages[0]}/unit` : "theme/unit",
  };
  const browserStep = {
    command: [
      "bunx",
      "playwright",
      "test",
      "--config",
      "playwright.fashion-store.config.ts",
      ...(selection?.e2eFiles ?? [
        ...new Set(Object.values(PAGE_SELECTIONS).flatMap(({ e2eFiles }) => e2eFiles)),
      ]),
    ],
    label: options.scope === "page" ? `${pages[0]}/browser` : "theme/browser",
  };
  const behaviorSteps = pages.map((page) => ({
    command: behaviorVerificationCommand(page),
    label: `${page}/behavior-evidence`,
  }));
  const stage = options.stage ?? "all";
  return {
    pages,
    steps:
      stage === "unit"
        ? [unitStep]
        : stage === "integrated"
          ? [
              ...INTEGRATED_STEPS.map((step) => ({
                command: [...step.command],
                label: step.label,
              })),
              browserStep,
              ...behaviorSteps,
            ]
          : stage === "browser"
            ? [browserStep]
            : stage === "behavior"
              ? behaviorSteps
              : [
                  ...(options.scope === "theme"
                    ? INTEGRATED_STEPS.map((step) => ({
                        command: [...step.command],
                        label: step.label,
                      }))
                    : []),
                  unitStep,
                  browserStep,
                  ...behaviorSteps,
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
    U9_EXACT_HANDSHAKE_URL: "",
    STOREFRONT_U9_EXACT_PREBUILT: "0",
  };
  const originalGeneratedState = await Promise.all(
    GENERATED_STATE_FILES.map(async (path) => ({ contents: await readFile(path), path })),
  );
  try {
    for (const step of plan.steps) {
      console.log(`[fashion-store-acceptance] ${step.label}: ${step.command.join(" ")}`);
      let handshake: ReturnType<typeof Bun.serve> | undefined;
      if (step.label === "control-plane/exact-tuple-receipt") {
        const handshakePort = await availablePort();
        env.U9_EXACT_HANDSHAKE_URL = `http://127.0.0.1:${handshakePort}`;
        handshake = Bun.serve({
          port: handshakePort,
          async fetch(request) {
            if (request.method !== "POST" || new URL(request.url).pathname !== "/phase-a")
              return new Response("Not found", { status: 404 });
            const phase = (await request.json()) as {
              buildInput: Record<string, unknown>;
              candidateReleaseId: string;
              previewSnapshotId: string;
            };
            const inputIdentity = phase.buildInput.inputIdentity as Record<string, unknown>;
            const catalogRelease = phase.buildInput.catalogRelease as Record<string, unknown>;
            const snapshot = phase.buildInput.snapshot as Record<string, unknown>;
            const contact = snapshot.contact as Record<string, unknown> | undefined;
            if (
              inputIdentity.catalogReleaseId !== phase.candidateReleaseId ||
              inputIdentity.experienceSnapshotId !== phase.previewSnapshotId
            )
              return new Response("Phase A identity mismatch", { status: 409 });
            await mkdir(resolve(STOREFRONT_ROOT, "test-results"), { recursive: true });
            await Promise.all([
              writeFile(U9_EXACT_BUILD_INPUT, `${JSON.stringify(phase.buildInput, null, 2)}\n`),
              writeFile(
                U9_EXACT_RELEASE,
                `${JSON.stringify(
                  {
                    collections: catalogRelease.collections,
                    generatedAt: catalogRelease.generatedAt,
                    policies: catalogRelease.policies,
                    products: catalogRelease.products,
                    redirects: catalogRelease.redirects,
                    releaseId: catalogRelease.releaseId,
                    routes: catalogRelease.routes,
                    schemaVersion: 2,
                    site: catalogRelease.site,
                  },
                  null,
                  2,
                )}\n`,
              ),
            ]);
            const build = Bun.spawn(["bun", "run", "build"], {
              cwd: STOREFRONT_ROOT,
              env: {
                ...env,
                NUXT_CATALOG_RELEASE_FILE: "test-results/u9-exact-tuple-release.json",
                STOREFRONT_BUILD_MODE: "preview",
                STOREFRONT_EXPERIENCE_FILE: "test-results/u9-exact-tuple-build-input.json",
              },
              stderr: "inherit",
              stdout: "inherit",
            });
            if (await build.exited) return new Response("Exact build failed", { status: 500 });
            const verify = Bun.spawn(["bun", "scripts/verify-static.ts"], {
              cwd: STOREFRONT_ROOT,
              env: { ...env, STOREFRONT_BUILD_MODE: "preview" },
              stderr: "inherit",
              stdout: "inherit",
            });
            if (await verify.exited)
              return new Response("Exact static verification failed", { status: 500 });
            const hash = createHash("sha256");
            const visit = async (directory: string, prefix = "") => {
              for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
                a.name.localeCompare(b.name),
              )) {
                const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.isDirectory()) await visit(resolve(directory, entry.name), relative);
                else {
                  hash.update(relative);
                  hash.update(await readFile(resolve(directory, entry.name)));
                }
              }
            };
            await visit(resolve(STOREFRONT_ROOT, ".output/public"));
            const artifactDigest = hash.digest("hex");
            await writeFile(
              U9_EXACT_ARTIFACT,
              `${JSON.stringify(
                {
                  artifactDigest,
                  candidateReleaseId: phase.candidateReleaseId,
                  contactVersion: contact?.version,
                  environment: phase.buildInput.environment,
                  previewSnapshotId: phase.previewSnapshotId,
                  themeId: inputIdentity.themeId,
                  themeVersion: inputIdentity.themeVersion,
                },
                null,
                2,
              )}\n`,
            );
            env.STOREFRONT_U9_EXACT_PREBUILT = "1";
            return Response.json({ artifactDigest });
          },
        });
      }
      const child = Bun.spawn(step.command, {
        cwd: STOREFRONT_ROOT,
        env,
        stderr: "inherit",
        stdout: step.label === "control-plane/exact-tuple-receipt" ? "pipe" : "inherit",
      });
      const capturedOutput =
        step.label === "control-plane/exact-tuple-receipt"
          ? new Response(child.stdout).text()
          : Promise.resolve("");
      const exitCode = await child.exited;
      const output = await capturedOutput;
      handshake?.stop(true);
      if (handshake) env.U9_EXACT_HANDSHAKE_URL = "";
      if (output) process.stdout.write(output);
      if (exitCode !== 0) throw new Error(`${step.label} failed with exit code ${exitCode}`);
      if (step.label === "control-plane/exact-tuple-receipt") {
        const valueFor = (marker: string) => {
          const line = output.split("\n").find((candidate) => candidate.startsWith(marker));
          if (!line) throw new Error(`${step.label} did not emit ${marker}`);
          return JSON.parse(line.slice(marker.length)) as Record<string, unknown>;
        };
        const receipt = valueFor("U9_EXACT_TUPLE_RECEIPT=");
        const buildInput = JSON.parse(await readFile(U9_EXACT_BUILD_INPUT, "utf8")) as Record<
          string,
          unknown
        >;
        const artifact = JSON.parse(await readFile(U9_EXACT_ARTIFACT, "utf8")) as Record<
          string,
          unknown
        >;
        const inputIdentity = buildInput.inputIdentity as Record<string, unknown> | undefined;
        if (
          inputIdentity?.catalogReleaseId !== receipt.candidateReleaseId ||
          inputIdentity?.experienceSnapshotId !== receipt.previewSnapshotId ||
          artifact.artifactDigest !== receipt.artifactDigest ||
          artifact.candidateReleaseId !== receipt.candidateReleaseId ||
          artifact.previewSnapshotId !== receipt.previewSnapshotId ||
          artifact.contactVersion !== receipt.contactVersion ||
          artifact.environment !== receipt.environment ||
          artifact.themeId !== receipt.themeId ||
          artifact.themeVersion !== receipt.themeVersion
        ) {
          throw new Error("exact tuple receipt does not match the emitted build input identity");
        }
        await writeFile(U9_EXACT_RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
      }
    }
  } finally {
    await Promise.all(
      originalGeneratedState.map(({ contents, path }) => writeFile(path, contents)),
    );
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
      stage: { default: "all", type: "string" },
    },
    strict: true,
  });
  if (values.scope !== "page" && values.scope !== "theme")
    throw new Error(`unknown Fashion Store acceptance scope: ${values.scope}`);
  if (
    values.stage !== "all" &&
    values.stage !== "behavior" &&
    values.stage !== "browser" &&
    values.stage !== "integrated" &&
    values.stage !== "unit"
  )
    throw new Error(`unknown Fashion Store acceptance stage: ${values.stage}`);
  const plan = buildFashionStoreAcceptancePlan({
    scope: values.scope,
    stage: values.stage,
    ...(values.page ? { page: values.page } : {}),
  });
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runFashionStoreAcceptancePlan(plan);
}

if (import.meta.main) await main();
