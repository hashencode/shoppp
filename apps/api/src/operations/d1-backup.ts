import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { ApiBindings } from "../http/context";

interface ExportApiResult {
  at_bookmark?: string;
  error?: string;
  result?: {
    filename?: string;
    signed_url?: string;
  };
  status?: "complete" | "error";
}

interface ExportApiResponse {
  errors?: Array<{ code?: number; message?: string }>;
  result?: ExportApiResult;
  success?: boolean;
}

interface BackupRequest {
  readonly accountId: string;
  readonly apiToken: string;
  readonly databaseId: string;
  readonly fetcher?: typeof fetch;
}

function endpoint(request: BackupRequest): string {
  return `https://api.cloudflare.com/client/v4/accounts/${request.accountId}/d1/database/${request.databaseId}/export`;
}

async function postExport(
  request: BackupRequest,
  payload: Record<string, string>,
): Promise<ExportApiResponse> {
  const response = await (request.fetcher ?? fetch)(endpoint(request), {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${request.apiToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error(`d1_export_http_${response.status}`);
  return response.json<ExportApiResponse>();
}

export async function startD1Export(request: BackupRequest): Promise<string> {
  const response = await postExport(request, { output_format: "polling" });
  if (!response.success || !response.result?.at_bookmark) {
    throw new Error("d1_export_bookmark_missing");
  }
  return response.result.at_bookmark;
}

export async function finishD1Export(
  request: BackupRequest,
  bookmark: string,
  bucket: R2Bucket,
  objectKey: string,
): Promise<void> {
  const response = await postExport(request, {
    current_bookmark: bookmark,
    output_format: "polling",
  });
  const signedUrl = response.result?.result?.signed_url;
  if (response.result?.status === "error" || response.result?.error) {
    throw new Error("d1_export_error");
  }
  if (!response.success || response.result?.status !== "complete" || !signedUrl) {
    throw new Error("d1_export_not_ready");
  }
  const dump = await (request.fetcher ?? fetch)(signedUrl);
  if (!dump.ok || !dump.body) throw new Error(`d1_export_download_${dump.status}`);
  await bucket.put(objectKey, dump.body, {
    customMetadata: {
      bookmark,
      databaseId: request.databaseId,
    },
    httpMetadata: { contentType: "application/sql; charset=utf-8" },
  });
}

export interface RestoreReconciliation {
  readonly foreignKeyViolations: number;
  readonly inventoryViolations: number;
  readonly orderTotalViolations: number;
  readonly quickCheck: string;
}

export async function startScheduledD1Backup(
  workflow: Workflow | undefined,
  scheduledTime: number,
): Promise<WorkflowInstance | undefined> {
  if (!workflow) return undefined;
  const date = new Date(scheduledTime).toISOString().slice(0, 10);
  const id = `scheduled-${date}`;
  try {
    return await workflow.create({ id });
  } catch (createError) {
    try {
      return await workflow.get(id);
    } catch {
      throw createError;
    }
  }
}

export async function reconcileRestoredDatabase(db: D1Database): Promise<RestoreReconciliation> {
  const [quickCheck, foreignKeys, inventory, orderTotals] = await Promise.all([
    db.prepare("PRAGMA quick_check").first<{ quick_check: string }>(),
    db.prepare("PRAGMA foreign_key_check").all(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM inventory_items
          WHERE reserved_quantity + backordered_quantity >
                on_hand_quantity + oversell_limit`,
      )
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM orders o
          WHERE o.grand_total_amount !=
                o.subtotal_amount - o.discount_amount + o.shipping_amount + o.tax_amount
             OR EXISTS (
               SELECT 1
                 FROM order_lines ol
                WHERE ol.order_id = o.id AND ol.currency != o.currency
             )`,
      )
      .first<{ count: number }>(),
  ]);
  const result = {
    foreignKeyViolations: foreignKeys.results.length,
    inventoryViolations: inventory?.count ?? 0,
    orderTotalViolations: orderTotals?.count ?? 0,
    quickCheck: quickCheck?.quick_check ?? "missing",
  };
  if (
    result.quickCheck !== "ok" ||
    result.foreignKeyViolations > 0 ||
    result.inventoryViolations > 0 ||
    result.orderTotalViolations > 0
  ) {
    throw new Error(`d1_restore_reconciliation_failed:${JSON.stringify(result)}`);
  }
  return result;
}

export class D1BackupWorkflow extends WorkflowEntrypoint<ApiBindings> {
  override async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep) {
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = this.env.D1_DATABASE_ID;
    const apiToken = this.env.D1_REST_API_TOKEN;
    if (!accountId || !databaseId || !apiToken) throw new Error("d1_backup_not_configured");
    const runId = event.instanceId;
    const startedAt = new Date().toISOString();
    const objectKey = `d1/${this.env.ENVIRONMENT}/${startedAt.slice(0, 10)}/${runId}.sql`;
    await step.do("record-backup-start", async () => {
      await this.env.DB.prepare(
        `INSERT OR IGNORE INTO d1_backup_runs
           (id, environment, database_id, status, started_at)
         VALUES (?, ?, ?, 'started', ?)`,
      )
        .bind(runId, this.env.ENVIRONMENT, databaseId, startedAt)
        .run();
    });
    const request = { accountId, apiToken, databaseId };
    try {
      const bookmark = await step.do(
        "start-d1-export",
        { retries: { backoff: "exponential", delay: "10 seconds", limit: 5 } },
        () => startD1Export(request),
      );
      await step.do(
        "store-d1-export",
        { retries: { backoff: "constant", delay: "15 seconds", limit: 40 } },
        async () => {
          try {
            await finishD1Export(request, bookmark, this.env.BACKUP_BUCKET, objectKey);
          } catch (error) {
            if (error instanceof Error && error.message === "d1_export_error") {
              throw new NonRetryableError(error.message);
            }
            throw error;
          }
        },
      );
      await step.do("record-backup-ready", async () => {
        await this.env.DB.prepare(
          `UPDATE d1_backup_runs
              SET status = 'ready', object_key = ?, completed_at = ?
            WHERE id = ? AND status = 'started'`,
        )
          .bind(objectKey, new Date().toISOString(), runId)
          .run();
      });
      return { objectKey, status: "ready" };
    } catch (error) {
      const errorCode =
        error instanceof Error && /^d1_export_[a-z0-9_]+$/.test(error.message)
          ? error.message
          : "d1_export_failed";
      await step.do("record-backup-failed", async () => {
        await this.env.DB.prepare(
          `UPDATE d1_backup_runs
              SET status = 'failed', error_code = ?, completed_at = ?
            WHERE id = ? AND status = 'started'`,
        )
          .bind(errorCode, new Date().toISOString(), runId)
          .run();
      });
      throw new Error(errorCode, { cause: error });
    }
  }
}
