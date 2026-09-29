import type { ProductSalesQuery, ProductSalesReport } from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";
import { ApiError } from "../http/errors";
import {
  getPublicRelease,
  publicProductName,
  publicProductPath,
  publicStorefrontOrigin,
} from "./public-products";
import { resolveReportingWindow } from "./revenue-metrics";

const MAX_PRODUCT_SALES_LINES = 50_000;

export async function getProductSalesReport(
  env: ApiBindings,
  input: ProductSalesQuery,
): Promise<ProductSalesReport> {
  const window = resolveReportingWindow(input);
  // Bound source lines, rather than silently truncating an already aggregated ranking.
  const rows = await env.DB.prepare(
    `SELECT l.product_id, l.product_name, l.line_total_amount
       FROM orders o JOIN order_lines l ON l.order_id = o.id
      WHERE o.environment = ? AND o.test_mode = 0 AND o.currency = ?
        AND l.currency = o.currency
        AND o.payment_status IN ('paid', 'partially_refunded', 'refunded')
        AND o.created_at >= ? AND o.created_at < ?
      ORDER BY o.created_at DESC, o.id DESC, l.id DESC LIMIT ?`,
  )
    .bind(
      env.ENVIRONMENT,
      input.currency,
      window.startUtc,
      window.endExclusiveUtc,
      MAX_PRODUCT_SALES_LINES + 1,
    )
    .all<{ product_id: string; product_name: string; line_total_amount: number }>();
  if (rows.results.length > MAX_PRODUCT_SALES_LINES) {
    throw new ApiError(422, "reporting_dataset_too_large", "Choose a smaller reporting range.");
  }
  const totals = new Map<string, { productId: string; name: string; grossSales: number }>();
  for (const row of rows.results) {
    const product = totals.get(row.product_id) ?? {
      productId: row.product_id,
      name: row.product_name,
      grossSales: 0,
    };
    product.grossSales += row.line_total_amount;
    if (!Number.isSafeInteger(product.grossSales)) {
      throw new ApiError(
        422,
        "reporting_dataset_too_large",
        "The reporting total exceeds the supported range.",
      );
    }
    totals.set(row.product_id, product);
  }
  const current = await getPublicRelease(env);
  const storefrontOrigin = publicStorefrontOrigin(env);
  const products = [...totals.values()]
    .sort(
      (a, b) =>
        b.grossSales - a.grossSales ||
        (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
    )
    .slice(0, 10)
    .map((product) => ({
      ...product,
      name: publicProductName(current, product.productId) ?? product.name,
      path: storefrontOrigin ? publicProductPath(current, product.productId) : null,
    }));
  return { ...input, storefrontOrigin, products };
}
