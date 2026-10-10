import { describe, expect, test } from "bun:test";
import * as context from "./formal-publication-context";
import {
  formalPublicationEnvironment,
  formalPublicationFixture,
} from "./formal-publication-test-fixture";
const sha = "a".repeat(40);

describe("formal public proof context", () => {
  test("binds original Catalog and Snapshot, configured staging product, run and observed identity", () => {
    const fixture = formalPublicationFixture();
    const env = formalPublicationEnvironment(fixture);
    const value = context.parseFormalPublicationContext(fixture, env);
    expect(value.product.slug).toBe(env.E2E_PRODUCT_SLUG);
    expect(value.variant.optionValues).toEqual(
      fixture.input.catalogRelease.products[0].variants[0].optionValues,
    );
    expect(() => context.assertFormalPublicationProofAuthority(value, env, sha)).not.toThrow();
    for (const override of [
      { ACTIVATION_ENVIRONMENT: "production" },
      { PUBLICATION_ID: "other" },
      { GITHUB_RUN_ATTEMPT: "2" },
      { PUBLICATION_VALIDATED_SOURCE_SHA: "b".repeat(40) },
      { GITHUB_WORKFLOW_REF: "hashencode/shoppp/.github/workflows/other.yml@refs/heads/main" },
    ]) {
      expect(() =>
        context.assertFormalPublicationProofAuthority(value, { ...env, ...override }, sha),
      ).toThrow();
    }
    const proof = JSON.parse(env.STOREFRONT_PUBLICATION_PROOF);
    proof.observation.identity.snapshotDigest = "0".repeat(64);
    expect(() =>
      context.assertFormalPublicationProofAuthority(
        value,
        { ...env, STOREFRONT_PUBLICATION_PROOF: JSON.stringify(proof) },
        sha,
      ),
    ).toThrow("observed");
  });
  test("fails before network when approved bytes or REL staging product differ", () => {
    const fixture = formalPublicationFixture();
    const env = formalPublicationEnvironment(fixture);
    expect(() =>
      context.parseFormalPublicationContext(fixture, {
        ...env,
        E2E_PRODUCT_SLUG: "wrong-staging-product",
      }),
    ).toThrow("REL staging product");
    fixture.input.catalogManifestJson += " ";
    expect(() => context.parseFormalPublicationContext(fixture, env)).toThrow("raw-byte");
  });
  test("Commerce check is read-only, selects exact saved variant and fails closed on mismatch", () => {
    const fixture = formalPublicationFixture();
    const value = context.parseFormalPublicationContext(
      fixture,
      formalPublicationEnvironment(fixture),
    );
    const sql = context.formalPublicationCommerceCheckSql(value);
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i);
    expect(sql).toContain(value.variant.id);
    expect(sql).toContain(value.product.id);
    expect(sql).toContain("inventory_items");
    expect(sql).toContain("price_lists");
  });
});

test("the emitted Commerce SQL qualifies exact staged rows and rejects a changed price or option tuple", async () => {
  const { Database } = await import("bun:sqlite");
  const fixture = formalPublicationFixture();
  const value = context.parseFormalPublicationContext(
    fixture,
    formalPublicationEnvironment(fixture),
  );
  const db = new Database(":memory:");
  try {
    db.exec(
      "CREATE TABLE products(id TEXT, slug TEXT, name TEXT, status TEXT); CREATE TABLE product_variants(id TEXT, product_id TEXT, sku TEXT, title TEXT, weight_grams INTEGER, option_values_json TEXT, status TEXT); CREATE TABLE prices(variant_id TEXT, price_list_id TEXT, amount INTEGER); CREATE TABLE price_lists(id TEXT, currency TEXT, status TEXT); CREATE TABLE inventory_items(variant_id TEXT);",
    );
    db.query("INSERT INTO products VALUES (?, ?, ?, 'published')").run(
      value.product.id,
      value.product.slug,
      value.product.name,
    );
    db.query("INSERT INTO product_variants VALUES (?, ?, ?, ?, ?, ?, 'active')").run(
      value.variant.id,
      value.product.id,
      value.variant.sku,
      value.variant.title,
      value.variant.weightGrams,
      JSON.stringify(value.variant.optionValues),
    );
    db.query("INSERT INTO prices VALUES (?, 'usd', ?)").run(
      value.variant.id,
      value.variant.prices.find(({ currency }) => currency === "USD")!.amount,
    );
    db.exec("INSERT INTO price_lists VALUES ('usd', 'USD', 'active')");
    db.query("INSERT INTO inventory_items VALUES (?)").run(value.variant.id);
    const check = db.query(context.formalPublicationCommerceCheckSql(value));
    expect(check.get()).toEqual({ qualified_variant: 1 });
    db.exec("UPDATE prices SET amount = amount + 1");
    expect(check.get()).toEqual({ qualified_variant: 0 });
    db.exec("UPDATE prices SET amount = amount - 1");
    db.exec('UPDATE product_variants SET option_values_json = \'{"unexpected":"option"}\'');
    expect(check.get()).toEqual({ qualified_variant: 0 });
  } finally {
    db.close();
  }
});
