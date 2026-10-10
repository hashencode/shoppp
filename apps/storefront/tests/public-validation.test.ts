import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalStorefrontJson, storefrontPublicationBuildInputSchema } from "@shoppp/contracts";
import { releaseGateEnvironment } from "../../../tools/release-validate";
import { readPublicValidationInput } from "../e2e/public-validation-input";
import releaseFixture from "../fixtures/release.json";

const root = resolve(import.meta.dir, "..");
const temporaryDirectories: string[] = [];
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function approvedInput() {
  const catalogRelease = structuredClone(releaseFixture);
  catalogRelease.site.origin = "https://approved-store.example.test";
  catalogRelease.products = catalogRelease.products.slice(0, 1);
  catalogRelease.collections = [];
  catalogRelease.products[0]!.slug = "approved-travel-case";
  catalogRelease.products[0]!.name = "Approved travel case";
  const snapshot = {
    approvedAt: "2026-10-11T00:00:00.000Z",
    approvedBy: "operator-1",
    bindings: [],
    configurationSchemaVersion: 1,
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
    experienceId: "experience-public",
    id: "approved-snapshot",
    kind: "approved",
    overrides: [],
    platformContractVersion: "1.0.0",
    provenance: {
      approvedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "theme-team",
      license: "Internal",
      source: "internal://fashion-store",
    },
    resolvedTemplates: [{ id: "home", pageType: "home", requiredCapabilities: [], sections: [] }],
    themeId: "fashion-store",
    themeVersion: "1.2.0",
    version: 1,
  };
  const catalogManifestJson = JSON.stringify(catalogRelease);
  return storefrontPublicationBuildInputSchema.parse({
    catalogRelease,
    catalogManifestJson,
    snapshot,
    environment: "public",
    expectedOrigin: "https://approved-store.example.test",
    publicationId: "approved-publication",
    sourceEnvironment: "staging",
    themeId: "fashion-store",
    presentationMode: "live",
    mediaOrigins: [],
    inputIdentity: {
      catalogReleaseId: catalogRelease.releaseId,
      catalogManifestDigest: sha256(catalogManifestJson),
      catalogSourceDigest: null,
      snapshotDigest: sha256(canonicalStorefrontJson(snapshot)),
      contactVersion: snapshot.contact.version,
      experienceSnapshotId: snapshot.id,
      experienceVersion: snapshot.version,
      platformContractVersion: snapshot.platformContractVersion,
      themeId: snapshot.themeId,
      themeVersion: snapshot.themeVersion,
    },
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function publicEnvironment() {
  const directory = await mkdtemp(join(tmpdir(), "shoppp-public-validation-"));
  temporaryDirectories.push(directory);
  const input = approvedInput();
  const path = join(directory, "input.json");
  await writeFile(path, JSON.stringify(input));
  return {
    input,
    environment: {
      ...process.env,
      STOREFRONT_BUILD_MODE: "public",
      STOREFRONT_EXPERIENCE_FILE: path,
      STOREFRONT_REUSE_VALIDATED_BUILD: "1",
    },
  };
}

async function config(name: string, environment: NodeJS.ProcessEnv) {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `import config from ${JSON.stringify(resolve(root, name))}; console.log(JSON.stringify(config));`,
    ],
    {
      cwd: root,
      env: environment,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(child.stdout).text();
  const error = await new Response(child.stderr).text();
  expect(await child.exited, error).toBe(0);
  return JSON.parse(output);
}

async function listedTests(name: string, environment: NodeJS.ProcessEnv) {
  const child = Bun.spawn(
    [
      process.execPath,
      resolve(root, "../../node_modules/@playwright/test/cli.js"),
      "test",
      "--list",
      "--config",
      name,
      "--reporter=json",
    ],
    {
      cwd: root,
      env: environment,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(child.stdout).text();
  const error = await new Response(child.stderr).text();
  expect(await child.exited, error || output).toBe(0);
  return JSON.parse(output);
}

describe("approved public artifact validation consumers", () => {
  test("release browser config selects public tests and serves the existing output", async () => {
    const { environment } = await publicEnvironment();
    const selected = await config(
      "playwright.config.ts",
      releaseGateEnvironment("browser-journeys", environment),
    );
    expect(selected.testMatch).toBe("public-storefront.spec.ts");
    expect(selected.webServer.command).toBe("bun scripts/serve-static.ts 3420");
    const discovery = await listedTests(
      "playwright.config.ts",
      releaseGateEnvironment("browser-journeys", environment),
    );
    const serialized = JSON.stringify(discovery.suites);
    expect(serialized).toContain("Approved travel case");
    expect(serialized).toContain("approved-travel-case");
    expect(discovery.suites.map((suite: { file: string }) => suite.file)).toEqual([
      "public-storefront.spec.ts",
    ]);
  });

  test("a11y and performance select approved routes and retain public static verification", async () => {
    const { environment } = await publicEnvironment();
    for (const [gate, filename] of [
      ["accessibility", "playwright.a11y.config.ts"],
      ["performance", "playwright.performance.config.ts"],
    ]) {
      const scoped = releaseGateEnvironment(gate!, environment);
      const selected = await config(filename!, scoped);
      expect(selected.webServer.command).not.toContain("build");
      expect(scoped.STOREFRONT_BUILD_MODE).toBe("public");
      expect(scoped.STOREFRONT_EXPERIENCE_FILE).toBe(environment.STOREFRONT_EXPERIENCE_FILE);
      const discovery = await listedTests(filename!, scoped);
      const serialized = JSON.stringify(discovery.suites);
      expect(serialized).toContain("/products/approved-travel-case");
      expect(serialized).not.toContain("/products/atlas-carry-on");
      expect(serialized).not.toContain("/products/relaxed-corduroy-shirt");
      if (gate === "performance") {
        const budgets = discovery.suites[0].specs.filter((spec: { title: string }) =>
          spec.title.includes("Lighthouse budgets"),
        );
        expect(
          budgets.flatMap(
            (budget: {
              tests: Array<{ annotations: Array<{ type: string; description: string }> }>;
            }) =>
              budget.tests[0]!.annotations.map(({ type, description }) => ({ type, description })),
          ),
        ).toEqual(
          ["/", "/shop", "/products/approved-travel-case", "/cart", "/checkout", "/magazine"].map(
            (route) => ({ type: "approved-routes", description: route }),
          ),
        );
      }
    }
  }, 15_000);

  test("ordinary fixture browser profile keeps its own build and suite", async () => {
    const environment = { ...process.env };
    delete environment.STOREFRONT_BUILD_MODE;
    delete environment.STOREFRONT_EXPERIENCE_FILE;
    delete environment.STOREFRONT_REUSE_VALIDATED_BUILD;
    const selected = await config("playwright.config.ts", environment);
    expect(selected.testMatch).toBeUndefined();
    expect(selected.webServer.command).toBe("bun run build && bun scripts/serve-static.ts 3420");
    const discovery = await listedTests("playwright.config.ts", environment);
    const serialized = JSON.stringify(discovery.suites);
    expect(serialized).toContain("published product is complete static HTML");
    expect(serialized).not.toContain("public-storefront.spec.ts");
  });

  test("consumers derive names, canonical origin and approved identity from retained input bytes", async () => {
    const { input, environment } = await publicEnvironment();
    const selected = readPublicValidationInput(environment)!;
    expect(selected.product.name).toBe("Approved travel case");
    expect(selected.productPath).toBe("/products/approved-travel-case");
    expect(selected.canonicalUrl).toBe(
      "https://approved-store.example.test/products/approved-travel-case",
    );
    expect(selected.input.inputIdentity).toEqual(input.inputIdentity);
    expect(selected.criticalRoutes).toEqual([
      "/",
      "/shop",
      "/products/approved-travel-case",
      "/cart",
      "/checkout",
      "/magazine",
    ]);
    input.catalogRelease.site.origin = "https://unapproved-store.example.test";
    await writeFile(environment.STOREFRONT_EXPERIENCE_FILE, JSON.stringify(input));
    expect(() => readPublicValidationInput(environment)).toThrow(
      "Public Catalog input differs from retained manifest",
    );
    expect(() => readPublicValidationInput({ STOREFRONT_BUILD_MODE: "public" })).toThrow(
      "STOREFRONT_EXPERIENCE_FILE",
    );
  });
});
