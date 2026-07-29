const SAMPLE_COUNT = 20;

function required(name: string): string {
  const value = process.env[name]?.trim().replace(/\/$/, "");
  if (!value) throw new Error(`${name} is required for staging latency verification.`);
  return value;
}

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

async function expectSuccess(label: string, sample: Promise<Response>): Promise<number> {
  const started = performance.now();
  const response = await sample;
  const duration = performance.now() - started;
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${await response.text()}`);
  }
  return duration;
}

const api = required("API_E2E_BASE_URL");
const storefront = required("STOREFRONT_E2E_BASE_URL");
const slug = required("E2E_PRODUCT_SLUG");
const publicHeaders = { Origin: storefront };
const runId = Date.now();

const carts = await Promise.all(
  Array.from({ length: SAMPLE_COUNT }, async (_, index) => {
    const response = await fetch(`${api}/cart`, {
      method: "POST",
      headers: {
        ...publicHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": `latency-cart-${runId}-${index}`,
      },
      body: JSON.stringify({ currency: "USD" }),
    });
    if (!response.ok) throw new Error(`cart fixture creation failed with ${response.status}`);
    const payload = (await response.json()) as { data: { token: string } };
    return payload.data.token;
  }),
);

const catalogSamples = await Promise.all(
  Array.from({ length: SAMPLE_COUNT }, () =>
    expectSuccess(
      "catalog read",
      fetch(`${api}/catalog/products/${slug}/live?currency=USD`, { headers: publicHeaders }),
    ),
  ),
);
const cartSamples = await Promise.all(
  carts.map((token) =>
    expectSuccess(
      "cart read",
      fetch(`${api}/cart`, {
        headers: { ...publicHeaders, Authorization: `CartToken ${token}` },
      }),
    ),
  ),
);
const checkoutMutationSamples = await Promise.all(
  carts.map((token, index) =>
    expectSuccess(
      "checkout shipping mutation",
      fetch(`${api}/cart/shipping`, {
        method: "PUT",
        headers: {
          ...publicHeaders,
          Authorization: `CartToken ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `latency-shipping-${runId}-${index}`,
        },
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
      }),
    ),
  ),
);

const results = {
  catalogReadP95Ms: Math.round(percentile95(catalogSamples)),
  cartReadP95Ms: Math.round(percentile95(cartSamples)),
  checkoutMutationP95Ms: Math.round(percentile95(checkoutMutationSamples)),
  sampleCount: SAMPLE_COUNT,
};

if (results.catalogReadP95Ms > 500 || results.cartReadP95Ms > 500) {
  throw new Error(`staging read p95 exceeds 500 ms: ${JSON.stringify(results)}`);
}
if (results.checkoutMutationP95Ms > 800) {
  throw new Error(`staging checkout mutation p95 exceeds 800 ms: ${JSON.stringify(results)}`);
}
console.log(`Staging API latency passed: ${JSON.stringify(results)}`);
