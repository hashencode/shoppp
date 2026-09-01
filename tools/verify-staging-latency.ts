const SAMPLE_COUNT = 20;
const DEFAULT_CHECKOUT_CONCURRENCY = 4;
const CART_RECOVERY_ATTEMPTS = 3;
const CART_RECOVERY_BACKOFF_MS = 50;

class CartFixtureCreationError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`cart fixture creation failed with ${status}`);
    this.name = "CartFixtureCreationError";
  }
}

export interface StagingLatencyConfig {
  catalogReleaseId: string;
  currency: string;
  previewCookie: string;
  previewOrigin: string;
  productId: string;
  runId: string;
  sampleCount: 20;
  shippingConcurrency: 4;
  timeoutMs: number;
}

export interface StagingLatencyLifecycle {
  cleanup(): Promise<void>;
  registerCart(cartId: string): Promise<void>;
}

export type StagingLatencyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface StagingLatencyReport {
  catalogDurationsMs: number[];
  catalogReadP95Ms: number;
  cartDurationsMs: number[];
  cartReadP95Ms: number;
  sampleCount: 20;
  shippingConcurrency: 4;
  shippingDurationsMs: number[];
  shippingMutationP95Ms: number;
}

export function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

export async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }
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
  fetcher: StagingLatencyFetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  now: () => number,
): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${label} timed out`)), timeoutMs);
  const started = now();
  let response: Response;
  try {
    response = await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const duration = now() - started;
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  const commerceDuration = /(?:^|,)\s*commerce;dur=([0-9]+(?:\.[0-9]+)?)(?:\s*(?:,|$))/.exec(
    response.headers.get("Server-Timing") ?? "",
  )?.[1];
  if (commerceDuration !== undefined) {
    const parsed = Number(commerceDuration);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return duration;
}

function assertConfig(config: StagingLatencyConfig): void {
  const preview = new URL(config.previewOrigin);
  if (preview.protocol !== "https:" || preview.origin !== config.previewOrigin) {
    throw new Error("previewOrigin must be one exact HTTPS origin");
  }
  if (config.sampleCount !== SAMPLE_COUNT) throw new Error("sampleCount must be exactly 20");
  if (config.shippingConcurrency !== DEFAULT_CHECKOUT_CONCURRENCY) {
    throw new Error("shippingConcurrency must be exactly 4");
  }
  if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 1) {
    throw new Error("timeoutMs must be a positive integer");
  }
  if (!/^__Host-shoppp-preview=[A-Za-z0-9_-]{8,256}$/.test(config.previewCookie)) {
    throw new Error("previewCookie must be one private Preview session cookie");
  }
  for (const [name, value] of Object.entries({
    catalogReleaseId: config.catalogReleaseId,
    productId: config.productId,
    runId: config.runId,
  })) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)) {
      throw new Error(`${name} must be a stable identifier`);
    }
  }
  if (!/^[A-Z]{3}$/.test(config.currency)) throw new Error("currency must be uppercase ISO-4217");
}

export async function runStagingLatencyProbe(
  config: StagingLatencyConfig,
  fetcher: StagingLatencyFetch = fetch,
  lifecycle: StagingLatencyLifecycle,
  now: () => number = performance.now.bind(performance),
): Promise<StagingLatencyReport> {
  assertConfig(config);
  const commonHeaders = { Cookie: config.previewCookie, Origin: config.previewOrigin };
  const cartTokens: string[] = [];
  const requestCart = async (idempotencyKey: string) => {
    const response = await fetcher(`${config.previewOrigin}/api/cart`, {
      body: JSON.stringify({ currency: config.currency }),
      headers: {
        ...commonHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      method: "POST",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: unknown };
      } | null;
      const code = payload?.error?.code;
      throw new CartFixtureCreationError(
        response.status,
        typeof code === "string" ? code : undefined,
      );
    }
    const payload = (await response.json()) as {
      data?: { cart?: { id?: unknown }; token?: unknown };
    };
    const cartId = payload.data?.cart?.id;
    const token = payload.data?.token;
    if (typeof cartId !== "string" || typeof token !== "string") {
      throw new Error("cart fixture creation returned invalid private evidence");
    }
    return { cartId, token };
  };
  const recoverCart = async (idempotencyKey: string) => {
    for (let attempt = 0; attempt < CART_RECOVERY_ATTEMPTS; attempt += 1) {
      try {
        return await requestCart(idempotencyKey);
      } catch (error) {
        const retryable =
          error instanceof CartFixtureCreationError &&
          error.status === 409 &&
          error.code === "idempotency_in_progress";
        if (!retryable || attempt === CART_RECOVERY_ATTEMPTS - 1) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, CART_RECOVERY_BACKOFF_MS * 2 ** attempt),
        );
      }
    }
    throw new Error("cart recovery attempt bound was not enforced");
  };
  const registerCart = async (
    cartId: string,
  ): Promise<{ recovered: false } | { initialError: unknown; recovered: true }> => {
    try {
      await lifecycle.registerCart(cartId);
      return { recovered: false };
    } catch (registrationError) {
      try {
        await lifecycle.registerCart(cartId);
      } catch (recoveryError) {
        throw new AggregateError(
          [registrationError, recoveryError],
          "cart registration and cleanup recovery both failed",
          { cause: recoveryError },
        );
      }
      return { initialError: registrationError, recovered: true };
    }
  };
  const createCart = async (index: number): Promise<void> => {
    const idempotencyKey = `fashion-u8-latency-cart-${config.runId}-${index}`;
    let cart: { cartId: string; token: string };
    try {
      cart = await requestCart(idempotencyKey);
    } catch (creationError) {
      try {
        cart = await recoverCart(idempotencyKey);
        await registerCart(cart.cartId);
      } catch (recoveryError) {
        throw new AggregateError(
          [creationError, recoveryError],
          "cart creation and cleanup registration recovery both failed",
          { cause: recoveryError },
        );
      }
      throw creationError;
    }
    const registration = await registerCart(cart.cartId);
    if (registration.recovered) throw registration.initialError;
    cartTokens.push(cart.token);
  };

  try {
    for (let index = 0; index <= SAMPLE_COUNT; index += 1) await createCart(index);
    const catalogUrl = `${config.previewOrigin}/api/catalog/products/by-id/${config.productId}/live?currency=${config.currency}`;
    const cartInit = (token: string): RequestInit => ({
      headers: { ...commonHeaders, Authorization: `CartToken ${token}` },
    });
    const shippingInit = (token: string, index: number): RequestInit => ({
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
        ...commonHeaders,
        Authorization: `CartToken ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `fashion-u8-latency-shipping-${config.runId}-${index}`,
      },
      method: "PUT",
    });

    const warmupToken = cartTokens[0]!;
    await timedRequest(
      "catalog read",
      fetcher,
      catalogUrl,
      { headers: commonHeaders },
      config.timeoutMs,
      now,
    );
    await timedRequest(
      "cart read",
      fetcher,
      `${config.previewOrigin}/api/cart`,
      cartInit(warmupToken),
      config.timeoutMs,
      now,
    );
    await timedRequest(
      "shipping mutation",
      fetcher,
      `${config.previewOrigin}/api/cart/shipping`,
      shippingInit(warmupToken, 0),
      config.timeoutMs,
      now,
    );

    const measuredTokens = cartTokens.slice(1);
    const catalogDurationsMs: number[] = [];
    const cartDurationsMs: number[] = [];
    for (const token of measuredTokens) {
      catalogDurationsMs.push(
        await timedRequest(
          "catalog read",
          fetcher,
          catalogUrl,
          { headers: commonHeaders },
          config.timeoutMs,
          now,
        ),
      );
      cartDurationsMs.push(
        await timedRequest(
          "cart read",
          fetcher,
          `${config.previewOrigin}/api/cart`,
          cartInit(token),
          config.timeoutMs,
          now,
        ),
      );
    }
    const shippingDurationsMs = await mapWithConcurrency(
      measuredTokens,
      config.shippingConcurrency,
      (token, index) =>
        timedRequest(
          "shipping mutation",
          fetcher,
          `${config.previewOrigin}/api/cart/shipping`,
          shippingInit(token, index + 1),
          config.timeoutMs,
          now,
        ),
    );
    const report: StagingLatencyReport = {
      catalogDurationsMs,
      catalogReadP95Ms: percentile95(catalogDurationsMs),
      cartDurationsMs,
      cartReadP95Ms: percentile95(cartDurationsMs),
      sampleCount: SAMPLE_COUNT,
      shippingConcurrency: DEFAULT_CHECKOUT_CONCURRENCY,
      shippingDurationsMs,
      shippingMutationP95Ms: percentile95(shippingDurationsMs),
    };
    if (report.catalogReadP95Ms > 500 || report.cartReadP95Ms > 500) {
      throw new Error(`staging read p95 exceeds 500 ms: ${JSON.stringify(report)}`);
    }
    if (report.shippingMutationP95Ms > 800) {
      throw new Error(`staging shipping mutation p95 exceeds 800 ms: ${JSON.stringify(report)}`);
    }
    return report;
  } finally {
    await lifecycle.cleanup();
  }
}

if (import.meta.main) {
  throw new Error(
    "Run the authenticated U8 orchestrator; direct staging API latency execution is prohibited.",
  );
}
