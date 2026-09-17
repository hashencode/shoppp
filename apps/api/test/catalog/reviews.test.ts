import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const productId = "review-product-001";
const now = "2026-09-17T00:00:00.000Z";
const validReview = {
  body: "The fit and finish matched the photos I saw.",
  displayName: "Alex Shopper",
  rating: 4,
};

function appFor(subject = "review-admin", allowed = true) {
  return createApp({
    reviewRateLimiter: { limit: vi.fn(async () => ({ success: allowed })) },
    testIdentityVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
      subject,
    }),
  });
}

function publicRequest(
  input: unknown,
  key: string = crypto.randomUUID(),
  origin = env.STOREFRONT_ORIGIN,
) {
  return new Request("https://api.example.test/catalog/products/review-product/reviews", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      Origin: origin,
    },
    method: "POST",
  });
}

function adminRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "X-Test-Admin-Identity": "test-token",
      Origin: env.ADMIN_ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM idempotency_claims"),
    env.DB.prepare("DELETE FROM product_reviews"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
  await env.DB.prepare(
    `INSERT INTO products
      (id, slug, name, description, status, seo_title, seo_description,
       published_at, created_at, updated_at)
     VALUES (?, 'review-product', 'Review Product', 'Product for review tests',
             'published', 'Review Product', 'Product for review tests', ?, ?, ?)`,
  )
    .bind(productId, now, now, now)
    .run();
  await seedHumanAdmin(env.DB, {
    email: "review-admin@example.test",
    id: "review-admin-id",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "review-admin",
  });
  await seedHumanAdmin(env.DB, {
    email: "review-support@example.test",
    id: "review-support-id",
    roleId: ADMIN_ROLE_IDS.support,
    subject: "review-support",
  });
});

describe("Product review submission and moderation", () => {
  test("stores a pending review, retries idempotently, and restricts moderation to its permission", async () => {
    const app = appFor();
    const key = "review-submission-idempotency-001";
    const submitted = await app.fetch(publicRequest(validReview, key), env);
    expect(submitted.status, JSON.stringify(await submitted.clone().json())).toBe(202);
    const result = await submitted.json<{ data: { id: string; status: string } }>();
    expect(result.data.status).toBe("pending");
    const retry = await app.fetch(publicRequest(validReview, key), env);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual(result);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM product_reviews").first()).toEqual({
      count: 1,
    });

    const support = appFor("review-support");
    const pendingDenied = await support.fetch(adminRequest("/admin/catalog/reviews"), env);
    expect(pendingDenied.status).toBe(403);
    const detailDenied = await support.fetch(
      adminRequest(`/admin/catalog/reviews/${result.data.id}`),
      env,
    );
    expect(detailDenied.status).toBe(403);
    const decisionDenied = await support.fetch(
      adminRequest(`/admin/catalog/reviews/${result.data.id}/moderate`, {
        body: JSON.stringify({ decision: "approved", reason: "Reviewed content" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "review-support-moderation-001",
        },
        method: "POST",
      }),
      env,
    );
    expect(decisionDenied.status).toBe(403);

    const pending = await app.fetch(adminRequest("/admin/catalog/reviews"), env);
    expect(await pending.json()).toMatchObject({
      data: {
        items: [{ id: result.data.id, displayName: validReview.displayName, status: "pending" }],
      },
    });
    const decision = await app.fetch(
      adminRequest(`/admin/catalog/reviews/${result.data.id}/moderate`, {
        body: JSON.stringify({ decision: "approved", reason: "Reviewed content" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "review-admin-moderation-001",
        },
        method: "POST",
      }),
      env,
    );
    expect(decision.status, JSON.stringify(await decision.clone().json())).toBe(200);
    expect(await decision.json()).toMatchObject({
      data: { id: result.data.id, moderatedBy: "review-admin-id", status: "approved" },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE target_id = ? AND action = 'reviews.approved'",
      )
        .bind(result.data.id)
        .first(),
    ).toEqual({ count: 1 });
    const pendingAfter = await app.fetch(adminRequest("/admin/catalog/reviews"), env);
    expect(await pendingAfter.json()).toMatchObject({ data: { items: [] } });
  });

  test("rejects malformed, cross-origin, oversized, and rate-limited submissions", async () => {
    const app = appFor();
    expect((await app.fetch(publicRequest({ ...validReview, rating: 0 }), env)).status).toBe(422);
    expect((await app.fetch(publicRequest({ ...validReview, body: "short" }), env)).status).toBe(
      422,
    );
    expect(
      (await app.fetch(publicRequest(validReview, crypto.randomUUID(), "https://evil.test"), env))
        .status,
    ).toBe(403);
    expect(
      (await app.fetch(publicRequest({ ...validReview, body: "x".repeat(9_000) }), env)).status,
    ).toBe(413);
    expect(
      (await appFor("review-admin", false).fetch(publicRequest(validReview), env)).status,
    ).toBe(429);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM product_reviews").first()).toEqual({
      count: 0,
    });
  });

  test("rejects a review once and never exposes it in the pending queue", async () => {
    const app = appFor();
    const submitted = await app.fetch(publicRequest(validReview), env);
    const { data } = await submitted.json<{ data: { id: string } }>();
    const decide = (key: string) =>
      app.fetch(
        adminRequest(`/admin/catalog/reviews/${data.id}/moderate`, {
          body: JSON.stringify({ decision: "rejected", reason: "Off-topic content" }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": key },
          method: "POST",
        }),
        env,
      );
    expect((await decide("review-reject-first-001")).status).toBe(200);
    expect((await decide("review-reject-second-001")).status).toBe(409);
    const review = await app.fetch(adminRequest(`/admin/catalog/reviews/${data.id}`), env);
    expect(await review.json()).toMatchObject({ data: { status: "rejected" } });
    const pending = await app.fetch(adminRequest("/admin/catalog/reviews"), env);
    expect(await pending.json()).toMatchObject({ data: { items: [] } });
  });
});
