import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { listCatalogMedia } from "../../src/media/library";

const createdAt = "2026-08-14T00:00:00.000Z";
const bindings = {
  ...env,
  MEDIA_PUBLIC_ORIGIN: "https://media.example.test",
  TAX_MODE: "zero" as const,
};

async function seedProduct(id: string, status: "archived" | "draft" | "published") {
  await env.DB.prepare(
    `INSERT INTO products
       (id, slug, name, description, status, seo_title, seo_description,
        published_at, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, '', '', ?, ?, ?)`,
  )
    .bind(
      id,
      id,
      `Product ${id}`,
      status,
      status === "draft" ? null : createdAt,
      createdAt,
      createdAt,
    )
    .run();
}

async function seedMedia(id: string, productId: string, alt: string, position: number) {
  await env.DB.prepare(
    `INSERT INTO product_media
       (id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at)
     VALUES (?, ?, NULL, ?, ?, 800, 600, ?, ?)`,
  )
    .bind(id, productId, `catalog/${id}.webp`, alt, position, createdAt)
    .run();
}

describe("Catalog media library", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM product_media"),
      env.DB.prepare("DELETE FROM products"),
    ]);
  });

  test("paginates approved media deterministically and reports the total", async () => {
    await seedProduct("product-media-page", "published");
    await seedMedia("media-a", "product-media-page", "Alpha", 0);
    await seedMedia("media-b", "product-media-page", "Beta", 1);
    await seedMedia("media-c", "product-media-page", "Gamma", 2);

    const first = await listCatalogMedia(bindings, { page: 1, pageSize: 2, query: "" });
    const second = await listCatalogMedia(bindings, { page: 2, pageSize: 2, query: "" });

    expect(first).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(first.data.map(({ key }) => key)).toEqual([
      "catalog/media-a.webp",
      "catalog/media-b.webp",
    ]);
    expect(second.data.map(({ key }) => key)).toEqual(["catalog/media-c.webp"]);
  });

  test("searches alt text and product name without exposing draft media", async () => {
    await seedProduct("summer-product", "archived");
    await seedProduct("hidden-product", "draft");
    await seedMedia("approved-summer", "summer-product", "Lookbook cover", 0);
    await seedMedia("hidden-summer", "hidden-product", "Summer secret", 0);

    const byProduct = await listCatalogMedia(bindings, {
      page: 1,
      pageSize: 20,
      query: "summer",
    });
    const byAlt = await listCatalogMedia(bindings, {
      page: 1,
      pageSize: 20,
      query: "lookbook",
    });

    expect(byProduct.total).toBe(1);
    expect(byProduct.data[0]).toMatchObject({
      alt: "Lookbook cover",
      key: "catalog/approved-summer.webp",
      productName: "Product summer-product",
    });
    expect(byAlt.data).toHaveLength(1);
  });
});
