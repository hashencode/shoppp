import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
const iamMigrationIndex = env.TEST_MIGRATIONS.findIndex(({ name }) =>
  name.endsWith("0012_admin_iam.sql"),
);
if (iamMigrationIndex < 1) throw new Error("0012_admin_iam.sql migration is required");
await applyD1Migrations(env.LEGACY_DB, env.TEST_MIGRATIONS.slice(0, iamMigrationIndex));
await applyD1Migrations(env.INVALID_LEGACY_DB, env.TEST_MIGRATIONS.slice(0, iamMigrationIndex));
const validationCatalogMigrationIndex = env.TEST_MIGRATIONS.findIndex(({ name }) =>
  name.endsWith("0019_storefront_validation_catalog_identity.sql"),
);
if (validationCatalogMigrationIndex < 1) {
  throw new Error("0019_storefront_validation_catalog_identity.sql migration is required");
}
await applyD1Migrations(
  env.STOREFRONT_VALIDATION_UPGRADE_DB,
  env.TEST_MIGRATIONS.slice(0, validationCatalogMigrationIndex),
);
