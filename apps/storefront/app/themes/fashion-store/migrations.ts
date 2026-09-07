import type { ThemeOverride, ThemeOverrideOperation } from "@shoppp/contracts";

import { fashionStoreHomeSections } from "./successor/composition";
import { fashionStoreManifest } from "./successor/manifest";

const SOURCE_CONFIGURATION_SCHEMA_VERSION = 1;
const SOURCE_HOME_INSTANCE_IDS = ["fashion-store-home"] as const;
const TARGET_HOME_INSTANCE_IDS = fashionStoreHomeSections.map(({ id }) => id);
const TARGET_BEST_SELLERS_INSTANCE_ID = fashionStoreHomeSections.find(
  ({ fixtureResource }) => fixtureResource === "best-sellers",
)!.id;
const TARGET_PRODUCT_MERCHANDISING_INSTANCE_ID = fashionStoreHomeSections.find(
  ({ fixtureResource }) => fixtureResource === "product-merchandising",
)!.id;

function isCompleteSourceHomeOrder(instanceIds: readonly string[]): boolean {
  return (
    instanceIds.length === SOURCE_HOME_INSTANCE_IDS.length &&
    SOURCE_HOME_INSTANCE_IDS.every((id) => instanceIds.includes(id))
  );
}

function targetHomeOrder(merchandisingOrder: number): string[] {
  const instanceIds = TARGET_HOME_INSTANCE_IDS.filter(
    (id) =>
      id !== TARGET_BEST_SELLERS_INSTANCE_ID && id !== TARGET_PRODUCT_MERCHANDISING_INSTANCE_ID,
  );
  const insertionIndex = Math.min(Math.max(merchandisingOrder - 1, 0), instanceIds.length);
  instanceIds.splice(insertionIndex, 0, TARGET_BEST_SELLERS_INSTANCE_ID);
  return [...instanceIds, TARGET_PRODUCT_MERCHANDISING_INSTANCE_ID];
}

export function migrateFashionStoreV1Overrides(
  overrides: readonly ThemeOverride[],
): ThemeOverride[] {
  return overrides.map((override) => {
    const migrated = structuredClone(override);
    let merchandisingOrder: number | undefined;
    let merchandisingOrderTouched = false;
    const migratedOperations: ThemeOverrideOperation[] = [];
    for (const operation of migrated.operations) {
      if (
        migrated.templateId === "fashion-store-home" &&
        (operation.kind === "set-setting" || operation.kind === "reset-setting") &&
        operation.instanceId === "fashion-store-home"
      ) {
        if (operation.settingId === "merchandising-order") {
          merchandisingOrderTouched = true;
          merchandisingOrder =
            operation.kind === "set-setting" && typeof operation.value === "number"
              ? operation.value
              : 1;
          continue;
        }
        if (operation.settingId === "merchandising-visible") {
          if (operation.kind === "reset-setting") {
            migratedOperations.push({
              instanceId: TARGET_BEST_SELLERS_INSTANCE_ID,
              kind: "set-visibility",
              visible: true,
            });
          } else if (typeof operation.value === "boolean") {
            migratedOperations.push({
              instanceId: TARGET_BEST_SELLERS_INSTANCE_ID,
              kind: "set-visibility",
              visible: operation.value,
            });
          } else {
            migratedOperations.push(operation);
          }
          continue;
        }
      }
      migratedOperations.push(
        migrated.templateId === "fashion-store-home" &&
          operation.kind === "reorder-sections" &&
          isCompleteSourceHomeOrder(operation.instanceIds)
          ? { ...operation, instanceIds: [...TARGET_HOME_INSTANCE_IDS] }
          : operation,
      );
    }
    const operations: ThemeOverrideOperation[] = merchandisingOrderTouched
      ? [
          ...migratedOperations.filter(({ kind }) => kind !== "reorder-sections"),
          {
            instanceIds: targetHomeOrder(merchandisingOrder ?? 1),
            kind: "reorder-sections" as const,
          },
        ]
      : migratedOperations;
    return {
      ...migrated,
      operations,
      schemaVersion: fashionStoreManifest.configurationSchemaVersion,
    };
  });
}

export const fashionStoreConfigurationMigrations = [
  {
    fromConfigurationSchemaVersion: SOURCE_CONFIGURATION_SCHEMA_VERSION,
    migrate: migrateFashionStoreV1Overrides,
    themeId: fashionStoreManifest.id,
    toConfigurationSchemaVersion: fashionStoreManifest.configurationSchemaVersion,
  },
] as const;
