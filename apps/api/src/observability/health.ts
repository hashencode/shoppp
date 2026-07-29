import type { OperationalHealth } from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";

async function count(db: D1Database, sql: string): Promise<number> {
  return (await db.prepare(sql).first<{ count: number }>())?.count ?? 0;
}

export async function getOperationalHealth(env: ApiBindings): Promise<OperationalHealth> {
  const [paymentEvents, deadLetterJobs, catalogBuilds, reportExports] = await Promise.all([
    count(env.DB, "SELECT COUNT(*) AS count FROM payment_events WHERE last_error_code IS NOT NULL"),
    count(env.DB, "SELECT COUNT(*) AS count FROM notification_jobs WHERE status = 'dead_letter'"),
    count(env.DB, "SELECT COUNT(*) AS count FROM catalog_releases WHERE status = 'failed'"),
    count(env.DB, "SELECT COUNT(*) AS count FROM report_exports WHERE status = 'failed'"),
  ]);
  const failures = { catalogBuilds, deadLetterJobs, paymentEvents, reportExports };
  return {
    checkedAt: new Date().toISOString(),
    environment: env.ENVIRONMENT,
    failures,
    status: Object.values(failures).some((value) => value > 0) ? "degraded" : "ok",
  };
}
