import type { InventoryAdjustmentRequest } from "@shoppp/contracts";
import { assertInventoryAdjustment } from "@shoppp/domain";
import type { Context } from "hono";
import * as z from "zod";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";

const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(160).optional(),
});

interface InventoryPosition {
  adjusted: number;
  available: number;
  onHand: number;
  oversellLimit: number;
  productName: string;
  reserved: number;
  sku: string;
  variantId: string;
  variantName: string;
  warehouseId: string;
  warehouseName: string;
}

function publicId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function parseListQuery(context: Context<ApiEnvironment>) {
  const parsed = inventoryListQuerySchema.safeParse({
    page: context.req.query("page"),
    pageSize: context.req.query("pageSize"),
    query: context.req.query("query"),
  });
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      "Inventory filters are invalid.",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export async function listInventory(context: Context<ApiEnvironment>) {
  const input = parseListQuery(context);
  const where = input.query
    ? "WHERE p.name LIKE ? ESCAPE '\\' OR v.title LIKE ? ESCAPE '\\' OR v.sku LIKE ? ESCAPE '\\'"
    : "";
  const escapedQuery = input.query
    ?.replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const search = escapedQuery ? `%${escapedQuery}%` : undefined;
  const count = await context.env.DB.prepare(
    `SELECT COUNT(*) AS total
       FROM inventory_items i
       JOIN product_variants v ON v.id = i.variant_id
       JOIN products p ON p.id = v.product_id
       ${where}`,
  )
    .bind(...(search ? [search, search, search] : []))
    .first<{ total: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT i.variant_id, i.warehouse_id, i.on_hand_quantity, i.reserved_quantity,
            i.backordered_quantity, i.oversell_limit,
            p.name AS product_name, v.title AS variant_name, v.sku,
            w.name AS warehouse_name,
            COALESCE((
              SELECT SUM(sl.quantity_delta)
                FROM stock_ledger_entries sl
               WHERE sl.variant_id = i.variant_id
                 AND sl.warehouse_id = i.warehouse_id
                 AND sl.reference_type = 'manual_adjustment'
            ), 0) AS adjusted_quantity
       FROM inventory_items i
       JOIN product_variants v ON v.id = i.variant_id
       JOIN products p ON p.id = v.product_id
       JOIN warehouses w ON w.id = i.warehouse_id
       ${where}
       ORDER BY p.name, v.sku, i.warehouse_id
       LIMIT ? OFFSET ?`,
  )
    .bind(
      ...(search ? [search, search, search] : []),
      input.pageSize,
      (input.page - 1) * input.pageSize,
    )
    .all<{
      adjusted_quantity: number;
      backordered_quantity: number;
      on_hand_quantity: number;
      oversell_limit: number;
      product_name: string;
      reserved_quantity: number;
      sku: string;
      variant_id: string;
      variant_name: string;
      warehouse_id: string;
      warehouse_name: string;
    }>();
  const data: InventoryPosition[] = rows.results.map((row) => ({
    adjusted: row.adjusted_quantity,
    available: Math.max(
      0,
      row.on_hand_quantity + row.oversell_limit - row.reserved_quantity - row.backordered_quantity,
    ),
    onHand: row.on_hand_quantity,
    oversellLimit: row.oversell_limit,
    productName: row.product_name,
    reserved: row.reserved_quantity,
    sku: row.sku,
    variantId: row.variant_id,
    variantName: row.variant_name,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
  }));
  return {
    data,
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      requestId: context.get("requestId"),
      total: count?.total ?? 0,
    },
  };
}

export async function getInventoryHistory(
  context: Context<ApiEnvironment>,
  variantId: string,
  warehouseId: string,
) {
  const item = await context.env.DB.prepare(
    `SELECT on_hand_quantity, reserved_quantity, oversell_limit, backordered_quantity
       FROM inventory_items WHERE variant_id = ? AND warehouse_id = ?`,
  )
    .bind(variantId, warehouseId)
    .first<{
      backordered_quantity: number;
      on_hand_quantity: number;
      oversell_limit: number;
      reserved_quantity: number;
    }>();
  if (!item) {
    throw new ApiError(404, "inventory_item_not_found", "The inventory position was not found.");
  }
  const history = await context.env.DB.prepare(
    `SELECT sl.id, sl.quantity_delta, sl.reason, sl.reference_type, sl.reference_id,
            sl.created_at, ai.display_name AS actor_name
       FROM stock_ledger_entries sl
       LEFT JOIN admin_identities ai ON ai.id = sl.actor_id
      WHERE sl.variant_id = ? AND sl.warehouse_id = ?
      ORDER BY sl.created_at DESC, sl.id DESC
      LIMIT 200`,
  )
    .bind(variantId, warehouseId)
    .all();
  return {
    data: {
      history: history.results,
      position: {
        available: Math.max(
          0,
          item.on_hand_quantity +
            item.oversell_limit -
            item.reserved_quantity -
            item.backordered_quantity,
        ),
        onHand: item.on_hand_quantity,
        oversellLimit: item.oversell_limit,
        reserved: item.reserved_quantity,
        variantId,
        warehouseId,
      },
    },
    meta: { requestId: context.get("requestId") },
  };
}

export async function adjustInventory(
  context: Context<ApiEnvironment>,
  variantId: string,
  warehouseId: string,
  input: InventoryAdjustmentRequest,
) {
  const current = await context.env.DB.prepare(
    `SELECT on_hand_quantity, reserved_quantity, oversell_limit, backordered_quantity
       FROM inventory_items WHERE variant_id = ? AND warehouse_id = ?`,
  )
    .bind(variantId, warehouseId)
    .first<{
      backordered_quantity: number;
      on_hand_quantity: number;
      oversell_limit: number;
      reserved_quantity: number;
    }>();
  if (!current) {
    throw new ApiError(404, "inventory_item_not_found", "The inventory position was not found.");
  }
  try {
    assertInventoryAdjustment(input.quantityDelta, {
      backordered: current.backordered_quantity,
      onHand: current.on_hand_quantity,
      oversellLimit: current.oversell_limit,
      reserved: current.reserved_quantity,
    });
  } catch (error) {
    throw new ApiError(
      422,
      "inventory_adjustment_invalid",
      error instanceof Error ? error.message : "The inventory adjustment is invalid.",
    );
  }
  const principal = context.get("principal");
  const id = publicId("sl");
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO stock_ledger_entries
         (id, variant_id, warehouse_id, quantity_delta, reason, reference_type,
          reference_id, actor_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'manual_adjustment', ?, ?, ?)`,
    )
      .bind(id, variantId, warehouseId, input.quantityDelta, input.reason, id, principal.id, now)
      .run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("inventory_adjustment_invalid")) {
      throw new ApiError(
        409,
        "inventory_adjustment_conflict",
        "Inventory changed before this adjustment could be applied.",
      );
    }
    throw error;
  }
  await recordAuditEvent(context.env.DB, {
    action: "inventory.adjust",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: publicId("aud"),
    metadata: { quantityDelta: input.quantityDelta, warehouseId },
    reason: input.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: variantId,
    targetType: "inventory_item",
  });
  return getInventoryHistory(context, variantId, warehouseId);
}
