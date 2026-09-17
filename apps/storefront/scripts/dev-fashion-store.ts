import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { runFashionStoreLiveDevelopment } from "./dev-fashion-store-live";

type Environment = Record<string, string | undefined>;

export interface FashionStoreDevelopmentOptions {
  readonly home: "combined" | "isolated";
  readonly port: number;
  readonly source: "local" | "staging";
}

const storefrontRoot = resolve(import.meta.dir, "..");
const localExperienceFile = resolve(
  storefrontRoot,
  "fixtures/experience/.generated/fashion-store-preview-input.json",
);

export function resolveFashionStoreDevelopmentOptions(
  arguments_: readonly string[],
  environment: Environment = process.env,
): FashionStoreDevelopmentOptions {
  const { values } = parseArgs({
    args: [...arguments_],
    options: {
      home: { default: "combined", type: "string" },
      port: { type: "string" },
      source: { default: "local", type: "string" },
    },
    strict: true,
  });
  const source = values.source;
  if (source !== "local" && source !== "staging") {
    throw new Error("--source must be local or staging.");
  }

  const home = values.home;
  if (home !== "combined" && home !== "isolated") {
    throw new Error("--home must be combined or isolated.");
  }
  if (source === "staging" && home !== "combined") {
    throw new Error("The staging source supports only the combined Home profile.");
  }

  const rawPort =
    values.port ??
    environment.FASHION_STORE_DEV_PORT ??
    (source === "staging" ? environment.FASHION_STORE_LIVE_DEV_PORT : undefined) ??
    "3435";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port must be an integer between 1 and 65535.");
  }

  return { home, port, source };
}

export function createFashionStoreLocalDevelopmentEnvironment(
  environment: Environment,
  options: FashionStoreDevelopmentOptions,
): Environment {
  const childEnvironment = {
    ...environment,
    STOREFRONT_BUILD_MODE: "preview",
    STOREFRONT_EXPERIENCE_FILE: localExperienceFile,
    STOREFRONT_FASHION_HOME_PROFILE: options.home,
  };
  delete childEnvironment.API_PROXY_CATALOG_RELEASE_ID;
  delete childEnvironment.API_PROXY_STOREFRONT_ORIGIN;
  delete childEnvironment.API_PROXY_TARGET;
  delete childEnvironment.NUXT_CATALOG_RELEASE_FILE;
  return childEnvironment;
}

async function runChild(command: readonly string[], environment: Environment): Promise<number> {
  const child = Bun.spawn([...command], {
    cwd: storefrontRoot,
    env: environment,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  const forwardSignal = (signal: NodeJS.Signals) => child.kill(signal);
  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  try {
    return await child.exited;
  } finally {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
  }
}

export async function runFashionStoreDevelopment(
  arguments_: readonly string[] = process.argv.slice(2),
  environment: Environment = process.env,
): Promise<number> {
  const options = resolveFashionStoreDevelopmentOptions(arguments_, environment);
  if (options.source === "staging") {
    return runFashionStoreLiveDevelopment({
      ...environment,
      FASHION_STORE_LIVE_DEV_PORT: String(options.port),
    });
  }

  const childEnvironment = createFashionStoreLocalDevelopmentEnvironment(environment, options);
  const preparationExitCode = await runChild(
    ["bun", "scripts/prepare-theme-preview-fixture.ts", "fashion-store"],
    childEnvironment,
  );
  if (preparationExitCode !== 0) return preparationExitCode;

  console.log(`Fashion Store local development: http://127.0.0.1:${options.port}`);
  console.log(`Catalog source: local release fixture (${options.home} Home profile)`);
  return runChild(
    ["bun", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(options.port)],
    childEnvironment,
  );
}

if (import.meta.main) process.exitCode = await runFashionStoreDevelopment();
