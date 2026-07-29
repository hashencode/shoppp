import * as z from "zod";

import { isoDateTimeSchema, publicIdSchema } from "./common";

export const reservationStatusSchema = z.enum(["active", "confirmed", "expired", "released"]);
export const reservationLineSchema = z
  .object({
    id: publicIdSchema,
    quantity: z.int().positive(),
    variantId: publicIdSchema,
    warehouseId: publicIdSchema,
  })
  .strict();
export const inventoryReservationSchema = z
  .object({
    expiresAt: isoDateTimeSchema,
    id: publicIdSchema,
    lines: z.array(reservationLineSchema).min(1),
    status: reservationStatusSchema,
  })
  .strict();
export const createInventoryReservationRequestSchema = z.object({}).strict();
export const inventoryAdjustmentRequestSchema = z
  .object({
    quantityDelta: z
      .int()
      .safe()
      .refine((value) => value !== 0, {
        message: "Quantity delta must not be zero.",
      }),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type InventoryAdjustmentRequest = z.infer<typeof inventoryAdjustmentRequestSchema>;
export type InventoryReservation = z.infer<typeof inventoryReservationSchema>;
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
