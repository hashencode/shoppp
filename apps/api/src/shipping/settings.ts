import type {
  ShippingMethodConfiguration,
  ShippingZoneConfiguration,
  UpsertShippingZoneRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent } from "../iam/audit";

interface ZoneRow {
  id: string;
  name: string;
  status: "active" | "disabled";
}

interface CountryRow {
  country_code: string;
  zone_id: string;
}

interface MethodRow {
  calculation_type: "flat" | "weight";
  currency: string;
  free_threshold_amount: number | null;
  id: string;
  max_weight_grams: number | null;
  min_weight_grams: number | null;
  name: string;
  price_amount: number;
  status: "active" | "disabled";
  zone_id: string;
}

function publicId(prefix: "ship" | "zone"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").toUpperCase().slice(0, 26)}`;
}

function mapMethod(row: MethodRow): ShippingMethodConfiguration {
  return {
    calculationType: row.calculation_type,
    currency: row.currency,
    freeThresholdAmount: row.free_threshold_amount,
    id: row.id,
    maxWeightGrams: row.max_weight_grams,
    minWeightGrams: row.min_weight_grams,
    name: row.name,
    priceAmount: row.price_amount,
    status: row.status,
  };
}

function groupByZone<Row extends { zone_id: string }>(rows: readonly Row[]): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const group = grouped.get(row.zone_id);
    if (group) group.push(row);
    else grouped.set(row.zone_id, [row]);
  }
  return grouped;
}

export async function listShippingZones(db: D1Database): Promise<ShippingZoneConfiguration[]> {
  const [zones, countries, methods] = await Promise.all([
    db.prepare("SELECT id, name, status FROM shipping_zones ORDER BY name, id").all<ZoneRow>(),
    db
      .prepare("SELECT zone_id, country_code FROM shipping_zone_countries ORDER BY country_code")
      .all<CountryRow>(),
    db
      .prepare(
        `SELECT id, zone_id, name, calculation_type, price_amount, currency,
                free_threshold_amount, min_weight_grams, max_weight_grams, status
           FROM shipping_methods
          ORDER BY name, id`,
      )
      .all<MethodRow>(),
  ]);
  const countriesByZone = groupByZone(countries.results);
  const methodsByZone = groupByZone(methods.results);
  return zones.results.map((zone) => ({
    countries: (countriesByZone.get(zone.id) ?? []).map((country) => country.country_code),
    id: zone.id,
    methods: (methodsByZone.get(zone.id) ?? []).map(mapMethod),
    name: zone.name,
    status: zone.status,
  }));
}

export async function upsertShippingZone(
  context: Context<ApiEnvironment>,
  input: UpsertShippingZoneRequest,
): Promise<ShippingZoneConfiguration> {
  const zoneId = input.zone.id ?? publicId("zone");
  if (input.zone.status === "active") {
    const placeholders = input.zone.countries.map(() => "?").join(", ");
    const conflict = await context.env.DB.prepare(
      `SELECT sz.name, szc.country_code
         FROM shipping_zone_countries szc
         JOIN shipping_zones sz ON sz.id = szc.zone_id
        WHERE sz.status = 'active' AND sz.id <> ?
          AND szc.country_code IN (${placeholders})
        LIMIT 1`,
    )
      .bind(zoneId, ...input.zone.countries)
      .first<{ country_code: string; name: string }>();
    if (conflict) {
      throw new ApiError(
        409,
        "shipping_country_zone_conflict",
        `${conflict.country_code} is already assigned to active zone ${conflict.name}.`,
      );
    }
  }

  const suppliedMethodIds = input.zone.methods.flatMap((method) => (method.id ? [method.id] : []));
  if (suppliedMethodIds.length) {
    const placeholders = suppliedMethodIds.map(() => "?").join(", ");
    const conflict = await context.env.DB.prepare(
      `SELECT id, zone_id FROM shipping_methods
        WHERE id IN (${placeholders}) AND zone_id <> ? LIMIT 1`,
    )
      .bind(...suppliedMethodIds, zoneId)
      .first<{ id: string; zone_id: string }>();
    if (conflict) {
      throw new ApiError(
        409,
        "shipping_method_zone_conflict",
        `Shipping method ${conflict.id} belongs to another zone.`,
      );
    }
  }

  const now = new Date().toISOString();
  const principal = context.get("principal");
  const methods = input.zone.methods.map((method) => ({
    ...method,
    id: method.id ?? publicId("ship"),
  }));
  const statements = [
    context.env.DB.prepare("DELETE FROM shipping_zone_countries WHERE zone_id = ?").bind(zoneId),
    context.env.DB.prepare(
      `INSERT INTO shipping_zones (id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, status = excluded.status, updated_at = excluded.updated_at`,
    ).bind(zoneId, input.zone.name, input.zone.status, now, now),
    ...input.zone.countries.map((country) =>
      context.env.DB.prepare(
        "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES (?, ?)",
      ).bind(zoneId, country),
    ),
    context.env.DB.prepare(
      "UPDATE shipping_methods SET status = 'disabled', updated_at = ? WHERE zone_id = ?",
    ).bind(now, zoneId),
    ...methods.map((method) =>
      context.env.DB.prepare(
        `INSERT INTO shipping_methods
          (id, zone_id, name, calculation_type, price_amount, currency,
           free_threshold_amount, min_weight_grams, max_weight_grams, status,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           calculation_type = excluded.calculation_type,
           price_amount = excluded.price_amount,
           currency = excluded.currency,
           free_threshold_amount = excluded.free_threshold_amount,
           min_weight_grams = excluded.min_weight_grams,
           max_weight_grams = excluded.max_weight_grams,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      ).bind(
        method.id,
        zoneId,
        method.name,
        method.calculationType,
        method.priceAmount,
        method.currency,
        method.freeThresholdAmount,
        method.minWeightGrams,
        method.maxWeightGrams,
        method.status,
        now,
        now,
      ),
    ),
    prepareAuditEvent(context.env.DB, {
      action: input.zone.id ? "shipping.zone.update" : "shipping.zone.create",
      actorId: principal.id,
      actorType: "admin",
      id: crypto.randomUUID(),
      metadata: {
        countries: input.zone.countries,
        methodIds: methods.map((method) => method.id),
        status: input.zone.status,
      },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: zoneId,
      targetType: "shipping_zone",
    }),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes("shipping_country_zone_conflict")) {
      throw new ApiError(
        409,
        "shipping_country_zone_conflict",
        "A country is already assigned to another active shipping zone.",
      );
    }
    throw error;
  }
  const stored = (await listShippingZones(context.env.DB)).find((zone) => zone.id === zoneId);
  if (!stored) throw new Error("Shipping zone was not persisted.");
  return stored;
}
