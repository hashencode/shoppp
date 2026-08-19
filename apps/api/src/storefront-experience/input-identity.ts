export interface PreviewInputIdentityRow {
  catalog_release_id: string | null;
  experience_version: number | null;
  platform_contract_version: string | null;
  snapshot_id: string;
  theme_id: string | null;
  theme_version: string | null;
}

export function toPreviewInputIdentity(row: PreviewInputIdentityRow) {
  return row.catalog_release_id
    ? {
        catalogReleaseId: row.catalog_release_id,
        experienceSnapshotId: row.snapshot_id,
        experienceVersion: row.experience_version,
        platformContractVersion: row.platform_contract_version,
        themeId: row.theme_id,
        themeVersion: row.theme_version,
      }
    : null;
}
