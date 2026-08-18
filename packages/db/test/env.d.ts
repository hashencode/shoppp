import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      LEGACY_DB: D1Database;
      INVALID_LEGACY_DB: D1Database;
      STOREFRONT_VALIDATION_UPGRADE_DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
