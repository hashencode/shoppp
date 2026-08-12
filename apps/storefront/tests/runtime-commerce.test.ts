import { describe, expect, test } from "bun:test";
import { productSchema } from "@shoppp/contracts";

import {
  CommerceCurrencyUnavailableError,
  toRuntimeProductState,
  verifyProductCartAdd,
} from "../app/theme-engine/runtime-commerce";
import { COMMERCE_REQUEST_TIMEOUT_MS } from "../app/composables/use-commerce-api";

const liveProduct = productSchema.parse({
  description: "A selected product whose mutable state comes from Commerce.",
  id: "prod_01JRUNTIMECOMMERCE00000001",
  media: [
    {
      alt: "Selected jacket",
      height: 800,
      id: "med_01JRUNTIMECOMMERCE000000001",
      position: 0,
      src: "https://media.example.test/jacket.jpg",
      width: 600,
    },
  ],
  name: "Selected jacket",
  options: [{ name: "Size", values: ["M", "L"] }],
  seo: { description: "Selected jacket", title: "Selected jacket" },
  slug: "selected-jacket",
  status: "published",
  variants: [
    {
      available: true,
      id: "var_01JRUNTIMECOMMERCE000000001",
      options: { Size: "M" },
      price: { amount: 6500, currency: "USD" },
      sku: "JACKET-M",
    },
    {
      available: false,
      id: "var_01JRUNTIMECOMMERCE000000002",
      options: { Size: "L" },
      price: { amount: 6700, currency: "USD" },
      sku: "JACKET-L",
    },
  ],
});

describe("runtime commerce presentation", () => {
  test("maps only Commerce-issued mutable price and availability into the runtime projection", () => {
    expect(toRuntimeProductState(liveProduct, "USD")).toEqual({
      availability: "in-stock",
      id: liveProduct.id,
      slug: liveProduct.slug,
      variants: [
        {
          availability: "in-stock",
          id: liveProduct.variants[0]!.id,
          label: "Size: M",
          money: { amount: 6500, currency: "USD" },
        },
        {
          availability: "out-of-stock",
          id: liveProduct.variants[1]!.id,
          label: "Size: L",
          money: { amount: 6700, currency: "USD" },
        },
      ],
    });
  });

  test("rejects a response in a different currency instead of presenting mixed totals", () => {
    expect(() => toRuntimeProductState(liveProduct, "EUR")).toThrow(
      CommerceCurrencyUnavailableError,
    );
  });

  test("marks a product unavailable when Commerce no longer publishes it", () => {
    expect(toRuntimeProductState({ ...liveProduct, status: "archived" }, "USD")).toMatchObject({
      availability: "unavailable",
    });
  });

  test("revalidates before producing a cart input with the verified unit price", async () => {
    let revalidationCount = 0;
    const runtime = toRuntimeProductState(liveProduct, "USD");
    const verified = await verifyProductCartAdd(
      {
        async revalidateProduct() {
          revalidationCount += 1;
          return runtime;
        },
      },
      { currency: "USD", productId: liveProduct.id, slug: liveProduct.slug },
      liveProduct.variants[0]!.id,
      2,
    );

    expect(revalidationCount).toBe(1);
    expect(verified).toMatchObject({
      input: {
        expectedUnitPrice: liveProduct.variants[0]!.price,
        quantity: 2,
        variantId: liveProduct.variants[0]!.id,
      },
    });
  });

  test("does not produce a cart input for an unavailable runtime variant", async () => {
    const runtime = toRuntimeProductState(liveProduct, "USD");
    expect(
      await verifyProductCartAdd(
        { revalidateProduct: async () => runtime },
        { currency: "USD", productId: liveProduct.id, slug: liveProduct.slug },
        liveProduct.variants[1]!.id,
        1,
      ),
    ).toBeNull();
  });

  test("does not substitute the first variant when the selected stable variant disappears", async () => {
    const runtime = toRuntimeProductState(liveProduct, "USD");
    expect(
      await verifyProductCartAdd(
        { revalidateProduct: async () => runtime },
        { currency: "USD", productId: liveProduct.id, slug: liveProduct.slug },
        "var_01JDISAPPEARED0000000000001",
        1,
      ),
    ).toBeNull();
  });

  test("normalizes runtime quantities to the shared cart contract bounds", async () => {
    const runtime = toRuntimeProductState(liveProduct, "USD");
    const verified = await verifyProductCartAdd(
      { revalidateProduct: async () => runtime },
      { currency: "USD", productId: liveProduct.id, slug: liveProduct.slug },
      liveProduct.variants[0]!.id,
      99,
    );
    expect(verified?.input.quantity).toBe(20);
  });

  test("uses a bounded Commerce request timeout", () => {
    expect(COMMERCE_REQUEST_TIMEOUT_MS).toBe(8_000);
  });
});
