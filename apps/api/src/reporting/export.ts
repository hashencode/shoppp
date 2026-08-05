import type { ReportExport, ReportExportRequest, ReportOrderRow } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { addCalendarDays, resolveReportingWindow } from "./revenue-metrics";
import { listReportOrders } from "./order-metrics";

const EXPORT_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_EXPORT_ROWS = 50_000;
const ASYNC_RANGE_DAYS = 31;

interface ReportExportRow {
  created_at: string;
  currency: string;
  end_date: string;
  environment: string;
  expires_at: string;
  id: string;
  object_key: string | null;
  query_json: string;
  requested_by: string;
  row_count: number | null;
  start_date: string;
  status: ReportExport["status"];
  time_zone: string;
}

function publicId(): string {
  return `rex_${crypto.randomUUID().replaceAll("-", "")}`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const CSV_HEADER = [
  "order_reference",
  "created_at",
  "email",
  "currency",
  "payment_status",
  "order_status",
  "fulfillment_status",
  "gross_minor_units",
  "refund_minor_units",
  "net_minor_units",
];

function orderCsvLine(row: ReportOrderRow): string {
  return [
    row.publicReference,
    row.createdAt,
    row.email,
    row.currency,
    row.paymentStatus,
    row.orderStatus,
    row.fulfillmentStatus,
    row.grossContribution,
    row.refundContribution,
    row.netContribution,
  ]
    .map(csvCell)
    .join(",");
}

export function orderRowsCsv(rows: readonly ReportOrderRow[]): string {
  return [CSV_HEADER.map(csvCell).join(","), ...rows.map(orderCsvLine)].join("\r\n") + "\r\n";
}

export function orderRowsCsvStream(rows: readonly ReportOrderRow[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let rowIndex = -1;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (rowIndex === -1) {
        controller.enqueue(encoder.encode(`${CSV_HEADER.map(csvCell).join(",")}\r\n`));
        rowIndex = 0;
        return;
      }
      const row = rows[rowIndex];
      if (!row) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`${orderCsvLine(row)}\r\n`));
      rowIndex += 1;
    },
  });
}

function orderRowsCsvByteLength(rows: readonly ReportOrderRow[]): number {
  const encoder = new TextEncoder();
  let length = encoder.encode(`${CSV_HEADER.map(csvCell).join(",")}\r\n`).byteLength;
  for (const row of rows) {
    length += encoder.encode(`${orderCsvLine(row)}\r\n`).byteLength;
  }
  return length;
}

function dayCount(startDate: string, endDate: string): number {
  let date = startDate;
  let count = 1;
  while (date !== endDate) {
    date = addCalendarDays(date, 1);
    count += 1;
  }
  return count;
}

function dto(row: ReportExportRow): ReportExport {
  return {
    createdAt: row.created_at,
    currency: row.currency,
    endDate: row.end_date,
    expiresAt: row.expires_at,
    id: row.id,
    rowCount: row.row_count,
    startDate: row.start_date,
    status: row.status,
    timeZone: row.time_zone,
  };
}

async function loadExport(db: D1Database, id: string): Promise<ReportExportRow | null> {
  return db
    .prepare(
      `SELECT id, environment, currency, time_zone, start_date, end_date,
              query_json, status, row_count, object_key, requested_by,
              expires_at, created_at
         FROM report_exports WHERE id = ?`,
    )
    .bind(id)
    .first<ReportExportRow>();
}

export async function processReportExport(
  db: D1Database,
  bucket: R2Bucket,
  exportId: string,
): Promise<void> {
  const job = await loadExport(db, exportId);
  if (!job || job.status !== "pending") return;
  const now = new Date().toISOString();
  const claim = await db
    .prepare(
      `UPDATE report_exports
          SET status = 'processing', updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    )
    .bind(now, exportId)
    .run();
  if ((claim.meta.changes ?? 0) !== 1) return;
  try {
    const stored = JSON.parse(job.query_json) as { query?: string };
    const page = await listReportOrders(db, job.environment, {
      currency: job.currency,
      endDate: job.end_date,
      page: 1,
      pageSize: MAX_EXPORT_ROWS + 1,
      ...(stored.query ? { query: stored.query } : {}),
      startDate: job.start_date,
      timeZone: job.time_zone,
    });
    if (page.total > MAX_EXPORT_ROWS) throw new Error("report_export_too_large");
    const objectKey = `reports/${job.environment}/${job.id}.csv`;
    const fixedLength = new FixedLengthStream(orderRowsCsvByteLength(page.data));
    await Promise.all([
      orderRowsCsvStream(page.data).pipeTo(fixedLength.writable),
      bucket.put(objectKey, fixedLength.readable, {
        customMetadata: {
          currency: job.currency,
          endDate: job.end_date,
          environment: job.environment,
          startDate: job.start_date,
          timeZone: job.time_zone,
        },
        httpMetadata: {
          contentDisposition: `attachment; filename="orders-${job.id}.csv"`,
          contentType: "text/csv; charset=utf-8",
        },
      }),
    ]);
    await db
      .prepare(
        `UPDATE report_exports
            SET status = 'ready', row_count = ?, object_key = ?,
                error_code = NULL, updated_at = ?
          WHERE id = ? AND status = 'processing'`,
      )
      .bind(page.total, objectKey, new Date().toISOString(), exportId)
      .run();
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 100) : "report_export_failed";
    await db
      .prepare(
        `UPDATE report_exports
            SET status = 'failed', error_code = ?, updated_at = ?
          WHERE id = ? AND status = 'processing'`,
      )
      .bind(code, new Date().toISOString(), exportId)
      .run();
    console.error(
      JSON.stringify({ errorCode: code, exportId, operation: "report.export.process" }),
    );
  }
}

export async function createReportExport(
  context: Context<ApiEnvironment>,
  input: ReportExportRequest,
): Promise<ReportExport> {
  resolveReportingWindow(input);
  const id = publicId();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_MS).toISOString();
  const principal = context.get("principal");
  await context.env.DB.prepare(
    `INSERT INTO report_exports
       (id, environment, currency, time_zone, start_date, end_date, query_json,
        status, requested_by, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      context.env.ENVIRONMENT,
      input.currency,
      input.timeZone,
      input.startDate,
      input.endDate,
      JSON.stringify({ ...(input.query ? { query: input.query } : {}) }),
      principal.id,
      expiresAt,
      createdAt,
      createdAt,
    )
    .run();
  await recordAuditEvent(context.env.DB, {
    action: "report.export.create",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: {
      currency: input.currency,
      endDate: input.endDate,
      environment: context.env.ENVIRONMENT,
      startDate: input.startDate,
      timeZone: input.timeZone,
    },
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "report_export",
  });

  const work = processReportExport(context.env.DB, context.env.REPORT_EXPORTS, id);
  if (dayCount(input.startDate, input.endDate) > ASYNC_RANGE_DAYS) {
    try {
      context.executionCtx.waitUntil(work);
    } catch {
      await work;
    }
  } else {
    await work;
  }
  const stored = await loadExport(context.env.DB, id);
  if (!stored) throw new Error("report_export_missing");
  return dto(stored);
}

export async function getReportExport(
  context: Context<ApiEnvironment>,
  id: string,
): Promise<ReportExport> {
  const row = await loadExport(context.env.DB, id);
  if (!row) throw new ApiError(404, "report_export_not_found", "The report export was not found.");
  const principal = context.get("principal");
  if (row.requested_by !== principal.id && principal.role.key !== "admin") {
    throw new ApiError(403, "report_export_forbidden", "This report belongs to another operator.");
  }
  if (row.environment !== context.env.ENVIRONMENT) {
    throw new ApiError(404, "report_export_not_found", "The report export was not found.");
  }
  if (row.status !== "expired" && row.expires_at <= new Date().toISOString()) {
    await context.env.DB.prepare(
      "UPDATE report_exports SET status = 'expired', updated_at = ? WHERE id = ?",
    )
      .bind(new Date().toISOString(), id)
      .run();
    return dto({ ...row, status: "expired" });
  }
  return dto(row);
}

export async function downloadReportExport(
  context: Context<ApiEnvironment>,
  id: string,
): Promise<Response> {
  const summary = await getReportExport(context, id);
  if (summary.status === "expired") {
    throw new ApiError(410, "report_export_expired", "The report export has expired.");
  }
  if (summary.status !== "ready") {
    throw new ApiError(409, "report_export_not_ready", "The report export is not ready.");
  }
  const row = await loadExport(context.env.DB, id);
  if (!row?.object_key) throw new Error("report_export_object_missing");
  const object = await context.env.REPORT_EXPORTS.get(row.object_key);
  if (!object) throw new ApiError(410, "report_export_missing", "The report file is unavailable.");
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "report.export.download",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: {
      currency: row.currency,
      environment: row.environment,
      rowCount: row.row_count,
    },
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "report_export",
  });
  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="orders-${id}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
