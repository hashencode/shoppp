const SAMPLE_COUNT = 20;
const CHECKOUT_CONCURRENCY = 4;
const SOURCE_SHA = /^[a-f0-9]{40}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const DEPLOY_WORKFLOW_REF = "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main";

export interface ReleaseStagingLatencyConfig {
  apiBaseUrl: string;
  checkoutConcurrency: 4;
  currency: "USD";
  productSlug: string;
  runId: string;
  sampleCount: 20;
  storefrontOrigin: string;
  timeoutMs: number;
}

export interface ReleaseStagingLatencyReport {
  catalogReadP95Ms: number;
  cartReadP95Ms: number;
  checkoutConcurrency: 4;
  checkoutMutationP95Ms: number;
  sampleCount: 20;
}

export function assertReleaseStagingLatencyThresholds(report: ReleaseStagingLatencyReport): void {
  if (report.catalogReadP95Ms > 500 || report.cartReadP95Ms > 500) {
    throw new Error(`staging read p95 exceeds 500 ms: ${JSON.stringify(report)}`);
  }
  if (report.checkoutMutationP95Ms > 800) {
    throw new Error(`staging checkout mutation p95 exceeds 800 ms: ${JSON.stringify(report)}`);
  }
}

type Environment = Record<string, string | undefined>;
type LatencyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for CI-GH staging latency verification`);
  return value;
}

function exactHttpsUrl(value: string, name: string, originOnly: boolean): string {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (originOnly && parsed.origin !== value) ||
    (!originOnly && value.endsWith("/"))
  ) {
    throw new Error(`${name} must be one exact HTTPS ${originOnly ? "origin" : "base URL"}`);
  }
  return value;
}

export function assertReleaseStagingLatencyAuthority(
  environment: Environment,
  checkoutSourceSha = required(environment, "CI_GH_VALIDATED_SOURCE_SHA"),
): void {
  if (environment.GITHUB_ACTIONS !== "true") {
    throw new Error("release staging latency verification requires GitHub Actions");
  }
  if (environment.GITHUB_REPOSITORY !== "hashencode/shoppp") {
    throw new Error("release staging latency verification requires hashencode/shoppp");
  }
  if (environment.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error("release staging latency verification requires workflow_dispatch");
  }
  if (environment.GITHUB_WORKFLOW_REF !== DEPLOY_WORKFLOW_REF) {
    throw new Error("release staging latency verification requires protected deploy.yml on main");
  }
  if (environment.CI_GH_STAGING_REHEARSAL !== "true") {
    throw new Error("CI-GH staging rollback rehearsal must be enabled");
  }
  if (environment.CI_GH_PRODUCTION_PROMOTION !== "false") {
    throw new Error("production promotion must remain disabled during CI-GH staging rehearsal");
  }
  const validatedSourceSha = required(environment, "CI_GH_VALIDATED_SOURCE_SHA");
  if (!SOURCE_SHA.test(validatedSourceSha) || checkoutSourceSha !== validatedSourceSha) {
    throw new Error("validated source SHA must equal the checked-out source SHA");
  }
}

function assertConfig(config: ReleaseStagingLatencyConfig): void {
  exactHttpsUrl(config.apiBaseUrl, "apiBaseUrl", false);
  exactHttpsUrl(config.storefrontOrigin, "storefrontOrigin", true);
  if (config.sampleCount !== SAMPLE_COUNT) throw new Error("sampleCount must be exactly 20");
  if (config.checkoutConcurrency !== CHECKOUT_CONCURRENCY) {
    throw new Error("checkoutConcurrency must be exactly 4");
  }
  if (config.currency !== "USD") throw new Error("currency must remain USD");
  if (!STABLE_ID.test(config.productSlug))
    throw new Error("productSlug must be a stable identifier");
  if (!STABLE_ID.test(config.runId)) throw new Error("runId must be a stable identifier");
  if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1) {
    throw new Error("timeoutMs must be a positive integer");
  }
}

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await operation(values[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function timedRequest(
  label: string,
  fetcher: LatencyFetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  now: () => number,
): Promise<number> {
  const started = now();
  const response = await fetcher(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
  const duration = now() - started;
  if (!response.ok) throw new Error(`${label} failed with ${response.status}`);
  return duration;
}

export async function runReleaseStagingLatencyProbe(
  config: ReleaseStagingLatencyConfig,
  fetcher: LatencyFetch = fetch,
  now: () => number = performance.now.bind(performance),
): Promise<ReleaseStagingLatencyReport> {
  assertConfig(config);
  const publicHeaders = { Origin: config.storefrontOrigin };
  const carts = await Promise.all(
    Array.from({ length: SAMPLE_COUNT }, async (_, index) => {
      const response = await fetcher(`${config.apiBaseUrl}/cart`, {
        body: JSON.stringify({ currency: config.currency }),
        headers: {
          ...publicHeaders,
          "Content-Type": "application/json",
          "Idempotency-Key": `ci-gh-latency-cart-${config.runId}-${index}`,
        },
        method: "POST",
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) throw new Error(`cart fixture creation failed with ${response.status}`);
      const payload = (await response.json()) as { data?: { token?: unknown } };
      if (typeof payload.data?.token !== "string") {
        throw new Error("cart fixture creation returned invalid private evidence");
      }
      return payload.data.token;
    }),
  );
  const catalogSamples = await Promise.all(
    Array.from({ length: SAMPLE_COUNT }, () =>
      timedRequest(
        "catalog read",
        fetcher,
        `${config.apiBaseUrl}/catalog/products/${config.productSlug}/live?currency=${config.currency}`,
        { headers: publicHeaders },
        config.timeoutMs,
        now,
      ),
    ),
  );
  const cartSamples = await Promise.all(
    carts.map((token) =>
      timedRequest(
        "cart read",
        fetcher,
        `${config.apiBaseUrl}/cart`,
        { headers: { ...publicHeaders, Authorization: `CartToken ${token}` } },
        config.timeoutMs,
        now,
      ),
    ),
  );
  const checkoutMutationSamples = await mapWithConcurrency(
    carts,
    config.checkoutConcurrency,
    (token, index) =>
      timedRequest(
        "checkout shipping mutation",
        fetcher,
        `${config.apiBaseUrl}/cart/shipping`,
        {
          body: JSON.stringify({
            shippingAddress: {
              city: "Portland",
              countryCode: "US",
              line1: "100 Market Street",
              name: "Latency Probe",
              postalCode: "97205",
              region: "OR",
            },
          }),
          headers: {
            ...publicHeaders,
            Authorization: `CartToken ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `ci-gh-latency-shipping-${config.runId}-${index}`,
          },
          method: "PUT",
        },
        config.timeoutMs,
        now,
      ),
  );
  const report: ReleaseStagingLatencyReport = {
    catalogReadP95Ms: Math.round(percentile95(catalogSamples)),
    cartReadP95Ms: Math.round(percentile95(cartSamples)),
    checkoutConcurrency: CHECKOUT_CONCURRENCY,
    checkoutMutationP95Ms: Math.round(percentile95(checkoutMutationSamples)),
    sampleCount: SAMPLE_COUNT,
  };
  assertReleaseStagingLatencyThresholds(report);
  return report;
}

function checkoutSourceSha(): string {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error("cannot resolve checked-out source SHA");
  return result.stdout.toString().trim();
}

if (import.meta.main) {
  assertReleaseStagingLatencyAuthority(process.env, checkoutSourceSha());
  const runId = `${required(process.env, "GITHUB_RUN_ID")}-${required(process.env, "GITHUB_RUN_ATTEMPT")}`;
  const report = await runReleaseStagingLatencyProbe({
    apiBaseUrl: required(process.env, "API_E2E_BASE_URL").replace(/\/$/, ""),
    checkoutConcurrency: 4,
    currency: "USD",
    productSlug: required(process.env, "E2E_PRODUCT_SLUG"),
    runId,
    sampleCount: 20,
    storefrontOrigin: required(process.env, "STOREFRONT_E2E_BASE_URL").replace(/\/$/, ""),
    timeoutMs: 10_000,
  });
  console.log(`Staging API latency passed: ${JSON.stringify(report)}`);
}
