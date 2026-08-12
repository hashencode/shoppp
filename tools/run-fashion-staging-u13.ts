type EnvironmentValues = Record<string, string | undefined>;
export type FashionStagingU13Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface FashionStagingU13InputIdentity {
  catalogReleaseId: string;
  experienceSnapshotId: string;
  experienceVersion: number;
  platformContractVersion: string;
  themeId: string;
  themeVersion: string;
}

export interface FashionStagingU13Config {
  authorityOrigin: string;
  buildId: string;
  currency: string;
  expectedInputIdentity: FashionStagingU13InputIdentity;
  handoffOrigin: string;
  previewOrigin: string;
  productId: string;
  runId: string;
  serviceToken: string;
  variantId: string;
}

export interface FashionStagingU13Report {
  buildId: string;
  cartId: string;
  inputIdentity: FashionStagingU13InputIdentity;
  passed: true;
  previewOrigin: string;
  previewOriginClassification: "fashion-staging-private";
  productId: string;
  runId: string;
  variantId: string;
}

function required(environment: EnvironmentValues, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function exactHttpsOrigin(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be one exact credential-free HTTPS origin`);
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be one exact credential-free HTTPS origin`);
  }
  return value;
}

function identifier(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)) {
    throw new Error(`${name} must be a stable identifier`);
  }
  return value;
}

function version(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${name} must be a semantic version`);
  }
  return value;
}

export function loadFashionStagingU13Config(
  environment: EnvironmentValues = process.env,
): FashionStagingU13Config {
  const serviceToken = required(environment, "FASHION_U13_SERVICE_TOKEN");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(serviceToken)) {
    throw new Error("FASHION_U13_SERVICE_TOKEN must be an opaque service credential");
  }
  const experienceVersionValue = required(environment, "FASHION_U13_EXPERIENCE_VERSION");
  const experienceVersion = Number(experienceVersionValue);
  if (!Number.isSafeInteger(experienceVersion) || experienceVersion < 1) {
    throw new Error("FASHION_U13_EXPERIENCE_VERSION must be a positive integer");
  }
  const currency = required(environment, "FASHION_U13_CURRENCY");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("FASHION_U13_CURRENCY must be an uppercase ISO currency code");
  }

  return {
    authorityOrigin: exactHttpsOrigin(environment, "FASHION_U13_AUTHORITY_ORIGIN"),
    buildId: identifier(environment, "FASHION_U13_BUILD_ID"),
    currency,
    expectedInputIdentity: {
      catalogReleaseId: identifier(environment, "FASHION_U13_CATALOG_RELEASE_ID"),
      experienceSnapshotId: identifier(environment, "FASHION_U13_SNAPSHOT_ID"),
      experienceVersion,
      platformContractVersion: version(environment, "FASHION_U13_PLATFORM_CONTRACT_VERSION"),
      themeId: identifier(environment, "FASHION_U13_THEME_ID"),
      themeVersion: version(environment, "FASHION_U13_THEME_VERSION"),
    },
    handoffOrigin: exactHttpsOrigin(environment, "FASHION_U13_HANDOFF_ORIGIN"),
    previewOrigin: exactHttpsOrigin(environment, "FASHION_U13_PREVIEW_ORIGIN"),
    productId: identifier(environment, "FASHION_U13_PRODUCT_ID"),
    runId: identifier(environment, "FASHION_U13_RUN_ID"),
    serviceToken,
    variantId: identifier(environment, "FASHION_U13_VARIANT_ID"),
  };
}

async function dataResponse(response: Response, stage: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${stage} failed with HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${stage} returned invalid JSON`);
  }
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error(`${stage} returned no data`);
  }
  return (payload as { data: unknown }).data;
}

function exactInputIdentity(
  value: unknown,
  expected: FashionStagingU13InputIdentity,
): value is FashionStagingU13InputIdentity {
  if (!value || typeof value !== "object") return false;
  const actual = value as Record<string, unknown>;
  return (Object.keys(expected) as (keyof FashionStagingU13InputIdentity)[]).every(
    (key) => actual[key] === expected[key],
  );
}

function previewCookie(response: Response): string {
  const header = response.headers.get("Set-Cookie") ?? "";
  const match = /(?:^|,\s*)(__Host-shoppp-preview=[A-Za-z0-9_-]{32,256})(?:;|$)/.exec(header);
  if (!match?.[1]) throw new Error("grant redemption returned no private preview session");
  return match[1];
}

function objectValue(value: unknown, stage: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${stage} returned invalid evidence`);
  }
  return value as Record<string, unknown>;
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&middot;|&#183;/gi, "·")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runFashionStagingU13(
  config: FashionStagingU13Config,
  fetcher: FashionStagingU13Fetch = fetch,
): Promise<FashionStagingU13Report> {
  const identity = config.expectedInputIdentity;
  const build = objectValue(
    await dataResponse(
      await fetcher(
        `${config.authorityOrigin}/admin/storefront-experiences/builds/${config.buildId}`,
        {
          headers: { Authorization: `Bearer ${config.serviceToken}` },
        },
      ),
      "deployed preview build",
    ),
    "deployed preview build",
  );
  if (
    build.id !== config.buildId ||
    build.snapshotId !== identity.experienceSnapshotId ||
    build.status !== "deployed" ||
    !exactInputIdentity(build.inputIdentity, identity)
  ) {
    throw new Error("deployed preview build did not match the expected input identity");
  }
  const grantValue = objectValue(
    await dataResponse(
      await fetcher(
        `${config.authorityOrigin}/admin/storefront-experiences/snapshots/${identity.experienceSnapshotId}/grants`,
        {
          body: JSON.stringify({
            catalogReleaseId: identity.catalogReleaseId,
            origin: config.previewOrigin,
            reason: `Fashion staging U13 ${config.runId}`,
          }),
          headers: {
            Authorization: `Bearer ${config.serviceToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      ),
      "preview grant",
    ),
    "preview grant",
  );
  if (
    typeof grantValue.grant !== "string" ||
    typeof grantValue.redeemUrl !== "string" ||
    grantValue.redeemUrl !== `${config.previewOrigin}/__preview/session` ||
    grantValue.snapshotId !== identity.experienceSnapshotId ||
    !exactInputIdentity(grantValue.inputIdentity, identity)
  ) {
    throw new Error("preview grant input identity did not match the expected input identity");
  }

  const redemption = await fetcher(grantValue.redeemUrl, {
    body: JSON.stringify({ grant: grantValue.grant }),
    headers: {
      "Content-Type": "application/json",
      Origin: config.handoffOrigin,
    },
    method: "POST",
    redirect: "manual",
  });
  if (redemption.status !== 303 || redemption.headers.get("Location") !== "/") {
    throw new Error(`grant redemption failed with HTTP ${redemption.status}`);
  }
  const cookie = previewCookie(redemption);

  const preview = await fetcher(`${config.previewOrigin}/`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  if (!preview.ok) throw new Error(`private preview failed with HTTP ${preview.status}`);
  const visible = visibleText(await preview.text());
  for (const expected of [
    `Catalog ${identity.catalogReleaseId}`,
    `Experience ${identity.experienceSnapshotId} v${identity.experienceVersion}`,
    `Theme ${identity.themeId} ${identity.themeVersion}`,
    `Platform ${identity.platformContractVersion}`,
  ]) {
    if (!visible.includes(expected)) {
      throw new Error("private preview did not render the expected input identity");
    }
  }

  const product = objectValue(
    await dataResponse(
      await fetcher(
        `${config.previewOrigin}/api/catalog/products/by-id/${config.productId}/live?currency=${config.currency}`,
        { headers: { Cookie: cookie } },
      ),
      "representative product lookup",
    ),
    "representative product lookup",
  );
  if (
    product.id !== config.productId ||
    !Array.isArray(product.variants) ||
    !product.variants.some(
      (variant) =>
        variant &&
        typeof variant === "object" &&
        "id" in variant &&
        variant.id === config.variantId,
    )
  ) {
    throw new Error("representative product or exact variant is not authorized by the release");
  }

  const cartValue = objectValue(
    await dataResponse(
      await fetcher(`${config.previewOrigin}/api/cart`, {
        body: JSON.stringify({ currency: config.currency }),
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          "Idempotency-Key": `fashion-u13-cart-${config.runId}`,
          Origin: config.previewOrigin,
        },
        method: "POST",
      }),
      "fresh cart creation",
    ),
    "fresh cart creation",
  );
  const freshCart = objectValue(cartValue.cart, "fresh cart creation");
  if (
    typeof freshCart.id !== "string" ||
    !Array.isArray(freshCart.lines) ||
    freshCart.lines.length !== 0 ||
    typeof cartValue.token !== "string" ||
    !/^[A-Za-z0-9_-]{32,160}$/.test(cartValue.token)
  ) {
    throw new Error("fresh cart creation returned unexpected evidence");
  }

  const cart = objectValue(
    await dataResponse(
      await fetcher(`${config.previewOrigin}/api/cart/lines`, {
        body: JSON.stringify({
          quantity: 1,
          releaseId: identity.catalogReleaseId,
          variantId: config.variantId,
        }),
        headers: {
          Authorization: `CartToken ${cartValue.token}`,
          "Content-Type": "application/json",
          Cookie: cookie,
          "Idempotency-Key": `fashion-u13-line-${config.runId}`,
          Origin: config.previewOrigin,
        },
        method: "POST",
      }),
      "representative cart line add",
    ),
    "representative cart line add",
  );
  if (
    cart.id !== freshCart.id ||
    !Array.isArray(cart.lines) ||
    !cart.lines.some(
      (line) =>
        line &&
        typeof line === "object" &&
        "variantId" in line &&
        line.variantId === config.variantId &&
        "quantity" in line &&
        line.quantity === 1,
    )
  ) {
    throw new Error("cart response did not contain authoritative exact-variant evidence");
  }

  return {
    buildId: config.buildId,
    cartId: freshCart.id,
    inputIdentity: identity,
    passed: true,
    previewOrigin: config.previewOrigin,
    previewOriginClassification: "fashion-staging-private",
    productId: config.productId,
    runId: config.runId,
    variantId: config.variantId,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await runFashionStagingU13(loadFashionStagingU13Config())));
}
