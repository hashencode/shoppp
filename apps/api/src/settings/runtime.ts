import { launchConfigurationSchema, type LaunchConfiguration } from "@shoppp/contracts";

export async function loadRuntimeLaunchConfiguration(
  db: D1Database,
): Promise<LaunchConfiguration | null> {
  const row = await db
    .prepare("SELECT value_json FROM settings WHERE key = 'launch_configuration'")
    .first<{ value_json: string }>();
  if (!row) return null;
  const parsed = launchConfigurationSchema.safeParse(JSON.parse(row.value_json));
  if (!parsed.success) throw new Error("launch_configuration_invalid");
  return parsed.data;
}
