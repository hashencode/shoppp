import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalStorefrontJson,
  sameStorefrontPublicationIdentity,
  storefrontActivationObservationSchema,
  storefrontPublicationBuildManifestSchema,
} from "../packages/contracts/src/storefront-publication";

type Environment = Record<string, string | undefined>;
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function parseFormalPublicationContext(metadata: unknown, environment: Environment) {
  const manifest = storefrontPublicationBuildManifestSchema.parse(metadata);
  const { input, publication } = manifest;
  assert(
    publication.operation === "publish" &&
      publication.id === environment.PUBLICATION_ID &&
      input.publicationId === publication.id &&
      publication.environment === environment.SOURCE_ENVIRONMENT &&
      input.sourceEnvironment === publication.environment &&
      sameStorefrontPublicationIdentity(input.inputIdentity, publication.identity),
    "Formal public proof must bind its authorized publication and source environment",
  );
  assert(
    hash(input.catalogManifestJson) === input.inputIdentity.catalogManifestDigest,
    "Formal public proof Catalog raw-byte digest mismatch",
  );
  assert(
    canonicalStorefrontJson(JSON.parse(input.catalogManifestJson)) ===
      canonicalStorefrontJson(input.catalogRelease),
    "Formal public proof Catalog differs from the retained bytes",
  );
  assert(
    hash(canonicalStorefrontJson(input.snapshot)) === input.inputIdentity.snapshotDigest,
    "Formal public proof Snapshot digest mismatch",
  );
  assert(
    input.themeId === "fashion-store",
    "REL must supply a hosted public purchase proof for this template; current formal proof covers fashion-store",
  );
  const product = input.catalogRelease.products.find(
    ({ slug, status }) => slug === environment.E2E_PRODUCT_SLUG && status === "published",
  );
  assert(product, "REL staging product must be a published member of the retained public Catalog");
  const variant = product.variants.find(
    ({ status, prices }) =>
      status === "active" && prices.some(({ currency }) => currency === "USD"),
  );
  assert(
    variant,
    "REL staging product must have an active USD variant in the retained public Catalog",
  );
  return { manifest, product, variant };
}
export type FormalPublicationContext = ReturnType<typeof parseFormalPublicationContext>;
export function readFormalPublicationContext(environment: Environment = process.env) {
  const path = environment.STOREFRONT_PUBLICATION_METADATA;
  assert(path, "STOREFRONT_PUBLICATION_METADATA is required for formal public proof");
  return parseFormalPublicationContext(
    JSON.parse(readFileSync(resolve(path), "utf8")),
    environment,
  );
}
export function assertFormalPublicationProofAuthority(
  context: FormalPublicationContext,
  environment: Environment,
  checkoutSourceSha: string,
): void {
  assert(
    environment.GITHUB_ACTIONS === "true" &&
      environment.GITHUB_REPOSITORY === "hashencode/shoppp" &&
      environment.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      environment.GITHUB_WORKFLOW_REF ===
        "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main",
    "Formal public proof requires protected deploy.yml on main in GitHub Actions",
  );
  assert(
    environment.ACTIVATION_ENVIRONMENT === "staging",
    "Formal public proof requires staging activation",
  );
  const expected = environment.PUBLICATION_VALIDATED_SOURCE_SHA;
  assert(
    expected &&
      /^[a-f0-9]{40}$/.test(expected) &&
      checkoutSourceSha === expected &&
      environment.RELEASE_EXPECTED_COMMIT === expected,
    "Formal public proof validated source SHA must equal the checked-out source SHA",
  );
  assert(
    context.manifest.publication.id === environment.PUBLICATION_ID &&
      context.manifest.publication.environment === environment.SOURCE_ENVIRONMENT,
    "Formal public proof publication authority differs",
  );
  const proof = JSON.parse(environment.STOREFRONT_PUBLICATION_PROOF ?? "null") as {
    publicationId?: string;
    sourceEnvironment?: string;
    activationEnvironment?: string;
    run?: { runId?: string; runAttempt?: number; sourceCommit?: string };
    observation?: unknown;
  } | null;
  assert(
    proof &&
      proof.publicationId === environment.PUBLICATION_ID &&
      proof.sourceEnvironment === environment.SOURCE_ENVIRONMENT &&
      proof.activationEnvironment === "staging" &&
      /^\d+$/.test(environment.GITHUB_RUN_ID ?? "") &&
      /^[1-9]\d*$/.test(environment.GITHUB_RUN_ATTEMPT ?? "") &&
      proof.run &&
      proof.run.runId === environment.GITHUB_RUN_ID &&
      proof.run.runAttempt === Number(environment.GITHUB_RUN_ATTEMPT) &&
      proof.run.sourceCommit === expected,
    "Formal public proof must be owned by this exact protected run and publication",
  );
  const observation = storefrontActivationObservationSchema.parse(proof.observation);
  assert(
    observation.sourceEnvironment === environment.SOURCE_ENVIRONMENT &&
      sameStorefrontPublicationIdentity(
        observation.identity,
        context.manifest.publication.identity,
      ),
    "Formal public proof observed storefront identity differs from the retained input",
  );
}
function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
export function formalPublicationCommerceCheckSql(context: FormalPublicationContext): string {
  const { product, variant } = context;
  const price = variant.prices.find(({ currency }) => currency === "USD")!;
  const options = Object.entries(variant.optionValues).map(
    ([key, value]) =>
      `json_extract(v.option_values_json, ${sql(`$.${JSON.stringify(key)}`)}) = ${sql(value)}`,
  );
  return `SELECT COUNT(*) AS qualified_variant FROM product_variants v
    JOIN products p ON p.id = v.product_id
    WHERE p.id = ${sql(product.id)} AND p.slug = ${sql(product.slug)} AND p.name = ${sql(product.name)} AND p.status = 'published'
      AND v.id = ${sql(variant.id)} AND v.sku = ${sql(variant.sku)} AND v.title = ${sql(variant.title)} AND v.weight_grams = ${variant.weightGrams} AND v.status = 'active'
      AND (SELECT COUNT(*) FROM json_each(v.option_values_json)) = ${Object.keys(variant.optionValues).length}
      ${options.length ? `AND ${options.join(" AND ")}` : ""}
      AND EXISTS (SELECT 1 FROM prices price JOIN price_lists list ON list.id = price.price_list_id
        WHERE price.variant_id = v.id AND price.amount = ${price.amount} AND list.currency = 'USD' AND list.status = 'active')
      AND EXISTS (SELECT 1 FROM inventory_items inventory WHERE inventory.variant_id = v.id);`;
}
if (import.meta.main) {
  const context = readFormalPublicationContext();
  const directory = resolve(process.env.STOREFRONT_PUBLICATION_METADATA!, "..");
  writeFileSync(
    resolve(directory, "commerce-check.sql"),
    formalPublicationCommerceCheckSql(context),
  );
  writeFileSync(
    resolve(directory, "proof-product.json"),
    JSON.stringify({
      productId: context.product.id,
      variantId: context.variant.id,
      sku: context.variant.sku,
    }),
  );
  if (process.env.GITHUB_ENV)
    appendFileSync(
      process.env.GITHUB_ENV,
      `E2E_PRODUCT_SLUG=${context.product.slug}\nE2E_PRODUCT_VARIANT_ID=${context.variant.id}\n`,
    );
}
